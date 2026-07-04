import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { paymentClient } from '@/lib/mercadopago'
import { getStudioTopupQuote } from '@/lib/studio-topups'
import { creditStudioTopupOnce } from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMetaPurchaseEvent } from '@/lib/meta-conversions'
import { sendTikTokPurchaseEvent } from '@/lib/tiktok-events'
import { recordPartnerPurchase } from '@/lib/partners'
import {
  getComposerEmailIdentity,
  sendAdminPaymentNotificationEmail,
  sendPaymentConfirmationEmail,
} from '@/lib/dcc-emails'

export const dynamic = 'force-dynamic'

function compactObject<T extends Record<string, any>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== '')
  )
}

async function sendApprovedTopupSideEffects(request: NextRequest, topup: any, paymentId: string) {
  const composerEmail = await getComposerEmailIdentity(topup.composer_id)
  if (!composerEmail) return

  await recordPartnerPurchase({
    composerId: topup.composer_id,
    purchaseId: paymentId,
    amount: Number(topup.amount) || 0,
    productType: 'studio_topup',
  })

  await Promise.allSettled([
    sendMetaPurchaseEvent({
      request,
      eventId: paymentId,
      eventSourceUrl: request.headers.get('referer') || request.url,
      email: composerEmail.email,
      externalId: topup.composer_id,
      value: Number(topup.amount) || 0,
      currency: topup.currency || 'BRL',
      contentName: 'Recarga Studio IA',
      contentId: 'studio_topup',
      quantity: Number(topup.music_quantity) || 1,
    }),
    sendTikTokPurchaseEvent({
      request,
      eventId: paymentId,
      eventSourceUrl: request.headers.get('referer') || request.url,
      email: composerEmail.email,
      externalId: topup.composer_id,
      value: Number(topup.amount) || 0,
      currency: topup.currency || 'BRL',
      contentName: 'Recarga Studio IA',
      contentId: 'studio_topup',
      quantity: Number(topup.music_quantity) || 1,
    }),
    sendPaymentConfirmationEmail({
      ...composerEmail,
      paymentId,
      productType: 'studio_topup',
      description: `Recarga avulsa Studio IA - ${topup.music_quantity} música(s)`,
      amount: topup.amount,
      paidAt: new Date(),
    }),
    sendAdminPaymentNotificationEmail({
      composerName: composerEmail.name,
      composerEmail: composerEmail.email,
      paymentId,
      productType: 'studio_topup',
      description: `Recarga avulsa Studio IA - ${topup.music_quantity} música(s)`,
      amount: topup.amount,
    }),
  ])
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'Mercado Pago não configurado no servidor' }, { status: 500 })
    }

    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const topupId = String(body.topupId || '').trim()
    const formData = body.formData || {}

    if (!topupId) {
      return NextResponse.json({ error: 'topupId obrigatório' }, { status: 400 })
    }

    const { data: currentTopup, error: topupError } = await supabaseAdmin
      .from('studio_credit_topups')
      .select('*')
      .eq('id', topupId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (topupError) throw topupError
    if (!currentTopup) return NextResponse.json({ error: 'Recarga não encontrada' }, { status: 404 })
    if (currentTopup.status === 'paid') {
      return NextResponse.json({
        success: true,
        status: 'paid',
        alreadyPaid: true,
        paymentId: currentTopup.payment_id,
        amount: Number(currentTopup.amount) || 0,
        currency: currentTopup.currency || 'BRL',
        topupId: currentTopup.id,
        musicQuantity: Number(currentTopup.music_quantity) || 0,
      })
    }

    const quote = getStudioTopupQuote(Number(currentTopup.music_quantity) || 0)
    const expectedAmount = Number(quote.totalPrice)
    const storedAmount = Number(currentTopup.amount) || 0

    if (expectedAmount <= 0 || Math.abs(expectedAmount - storedAmount) > 0.01) {
      return NextResponse.json({ error: 'Valor da recarga não confere. Recarregue a página e tente novamente.' }, { status: 400 })
    }

    const { data: composerData } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('email, name')
      .eq('id', composer.composerId)
      .maybeSingle()

    const payer = compactObject({
      email: formData.payer?.email || composerData?.email,
      identification: formData.payer?.identification,
    })

    const paymentBody = compactObject({
      transaction_amount: expectedAmount,
      token: formData.token,
      description: currentTopup.metadata?.package_name || `Recarga avulsa Studio IA - ${currentTopup.music_quantity} música(s)`,
      installments: formData.installments ? Number(formData.installments) : undefined,
      payment_method_id: formData.payment_method_id,
      issuer_id: formData.issuer_id,
      payer,
      external_reference: currentTopup.external_reference,
      metadata: {
        type: 'studio_topup',
        topup_id: currentTopup.id,
        composer_id: composer.composerId,
        package_slug: currentTopup.package_slug,
        credits: currentTopup.credits,
        music_quantity: currentTopup.music_quantity,
        unit_price: currentTopup.metadata?.unit_price,
      },
      statement_descriptor: 'DCC Music',
    })

    const payment = await paymentClient.create({
      body: paymentBody,
      requestOptions: {
        idempotencyKey: `studio-topup-${currentTopup.id}-${randomUUID()}`,
      },
    })

    const paymentId = String(payment.id || '')
    const paymentStatus = String(payment.status || currentTopup.status || 'pending')

    if (paymentStatus === 'approved') {
      const creditResult = await creditStudioTopupOnce({
        topup: currentTopup,
        paymentId,
        paymentData: payment,
        metadata: {
          syncedFromPaymentBrick: true,
        },
      })

      const creditedTopup = creditResult.topup
      if (creditResult.credited) {
        await sendApprovedTopupSideEffects(request, creditedTopup, paymentId)
      }

      return NextResponse.json({
        success: true,
        status: 'paid',
        credited: creditResult.credited,
        paymentId,
        amount: Number(creditedTopup.amount) || expectedAmount,
        currency: creditedTopup.currency || 'BRL',
        topupId: creditedTopup.id,
        musicQuantity: Number(creditedTopup.music_quantity) || quote.musicQuantity,
      })
    }

    const topupStatusMap: Record<string, string> = {
      pending: 'pending',
      in_process: 'pending',
      rejected: 'failed',
      cancelled: 'cancelled',
      refunded: 'refunded',
      charged_back: 'refunded',
    }
    const nextTopupStatus = topupStatusMap[paymentStatus] || 'pending'

    await supabaseAdmin
      .from('studio_credit_topups')
      .update({
        status: nextTopupStatus,
        payment_id: paymentId || currentTopup.payment_id,
        metadata: {
          ...(currentTopup.metadata || {}),
          mercadopago_payment: payment,
          syncedFromPaymentBrick: true,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentTopup.id)

    return NextResponse.json({
      success: true,
      status: paymentStatus,
      pending: nextTopupStatus === 'pending',
      paymentId,
      amount: expectedAmount,
      currency: currentTopup.currency || 'BRL',
      topupId: currentTopup.id,
      musicQuantity: quote.musicQuantity,
      payment,
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro ao processar pagamento embutido:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar pagamento' },
      { status: 500 }
    )
  }
}
