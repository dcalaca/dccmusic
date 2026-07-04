import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { paymentClient } from '@/lib/mercadopago'
import { supabaseAdmin } from '@/lib/supabase'
import { creditStudioTopupOnce, revokeStudioTopupCreditOnce } from '@/lib/studio'
import { sendMetaPurchaseEvent } from '@/lib/meta-conversions'
import { sendTikTokPurchaseEvent } from '@/lib/tiktok-events'
import { recordPartnerPurchase } from '@/lib/partners'
import {
  getComposerEmailIdentity,
  sendAdminPaymentNotificationEmail,
  sendPaymentConfirmationEmail,
} from '@/lib/dcc-emails'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const topupId = String(body.topupId || '').trim()
    const paymentId = String(body.paymentId || body.collectionId || '').trim()

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
        credits: Number(currentTopup.credits) || 0,
        amount: Number(currentTopup.amount) || 0,
        currency: currentTopup.currency || 'BRL',
        paymentId: paymentId || currentTopup.payment_id || null,
        topupId: currentTopup.id,
        musicQuantity: Number(currentTopup.music_quantity) || 0,
      })
    }

    if (!paymentId) {
      return NextResponse.json({ success: true, status: currentTopup.status, pending: true })
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'Mercado Pago não configurado no servidor' }, { status: 500 })
    }

    const payment = await paymentClient.get({ id: paymentId })
    const paymentReference = payment.external_reference || payment.metadata?.external_reference
    const paymentStatus = payment.status

    if (paymentReference && paymentReference !== currentTopup.external_reference) {
      return NextResponse.json(
        { error: 'Pagamento não pertence a esta recarga' },
        { status: 400 }
      )
    }

    if (paymentStatus !== 'approved') {
      const topupStatusMap: Record<string, string> = {
        pending: 'pending',
        in_process: 'pending',
        rejected: 'failed',
        cancelled: 'cancelled',
        refunded: 'refunded',
        charged_back: 'refunded',
      }
      const nextTopupStatus = topupStatusMap[String(paymentStatus)] || currentTopup.status

      await supabaseAdmin
        .from('studio_credit_topups')
        .update({
          status: nextTopupStatus,
          payment_id: paymentId,
          metadata: {
            ...(currentTopup.metadata || {}),
            mercadopago_payment: payment,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentTopup.id)

      if (
        currentTopup.status === 'paid' &&
        (paymentStatus === 'refunded' || paymentStatus === 'charged_back' || paymentStatus === 'cancelled')
      ) {
        await revokeStudioTopupCreditOnce({
          topup: currentTopup,
          paymentId,
          paymentData: payment,
          reason: String(paymentStatus),
        })
      }

      return NextResponse.json({ success: true, status: paymentStatus || currentTopup.status, pending: true })
    }

    const creditResult = await creditStudioTopupOnce({
      topup: currentTopup,
      paymentId,
      paymentData: payment,
      metadata: {
        syncedFromReturnUrl: true,
      },
    })

    const creditedTopup = creditResult.topup

    const composerEmail = await getComposerEmailIdentity(creditedTopup.composer_id)
    if (composerEmail && creditResult.credited) {
      await recordPartnerPurchase({
        composerId: creditedTopup.composer_id,
        purchaseId: paymentId,
        amount: Number(creditedTopup.amount) || 0,
        productType: 'studio_topup',
      })
      await Promise.allSettled([
        sendMetaPurchaseEvent({
          request,
          eventId: paymentId,
          eventSourceUrl: request.headers.get('referer') || request.url,
          email: composerEmail.email,
          externalId: creditedTopup.composer_id,
          value: Number(creditedTopup.amount) || 0,
          currency: creditedTopup.currency || 'BRL',
          contentName: 'Recarga Studio IA',
          contentId: 'studio_topup',
          quantity: Number(creditedTopup.music_quantity) || 1,
        }),
        sendTikTokPurchaseEvent({
          request,
          eventId: paymentId,
          eventSourceUrl: request.headers.get('referer') || request.url,
          email: composerEmail.email,
          externalId: creditedTopup.composer_id,
          value: Number(creditedTopup.amount) || 0,
          currency: creditedTopup.currency || 'BRL',
          contentName: 'Recarga Studio IA',
          contentId: 'studio_topup',
          quantity: Number(creditedTopup.music_quantity) || 1,
        }),
        sendPaymentConfirmationEmail({
          ...composerEmail,
          paymentId,
          productType: 'studio_topup',
          description: `Recarga avulsa Studio IA - ${creditedTopup.music_quantity} música(s)`,
          amount: creditedTopup.amount,
          paidAt: new Date(),
        }),
        sendAdminPaymentNotificationEmail({
          composerName: composerEmail.name,
          composerEmail: composerEmail.email,
          paymentId,
          productType: 'studio_topup',
          description: `Recarga avulsa Studio IA - ${creditedTopup.music_quantity} música(s)`,
          amount: creditedTopup.amount,
        }),
      ])
    }

    return NextResponse.json({
      success: true,
      status: 'paid',
      credited: creditResult.credited,
      credits: Number(creditedTopup.credits) || 0,
      amount: Number(creditedTopup.amount) || 0,
      currency: creditedTopup.currency || 'BRL',
      paymentId,
      topupId: creditedTopup.id,
      musicQuantity: Number(creditedTopup.music_quantity) || 0,
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro ao sincronizar recarga:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao sincronizar recarga' },
      { status: 500 }
    )
  }
}
