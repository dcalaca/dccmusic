import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { paymentClient } from '@/lib/mercadopago'
import { supabaseAdmin } from '@/lib/supabase'
import { creditStudioTopupOnce, revokeStudioTopupCreditOnce } from '@/lib/studio'
import { sendStudioTopupPurchaseEvents } from '@/lib/studio-topup-meta'
import { recordPartnerPurchase } from '@/lib/partners'
import {
  getComposerEmailIdentity,
  sendAdminPaymentNotificationEmail,
  sendPaymentConfirmationEmail,
} from '@/lib/dcc-emails'
import { sanitizeStripeObject, stripeRequest } from '@/lib/stripe'
import { sendApprovedStudioTopupSideEffects } from '@/lib/studio-topup-side-effects'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const topupId = String(body.topupId || '').trim()
    const requestedPaymentId = String(body.paymentId || body.collectionId || '').trim()

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

    const paymentId = requestedPaymentId || String(currentTopup.payment_id || '').trim()

    if (currentTopup.status === 'paid') {
      const paidPaymentId = paymentId
      const composerEmail = await getComposerEmailIdentity(currentTopup.composer_id)
      if (composerEmail && paidPaymentId) {
        // Se o webhook creditou antes, ainda assim reforça o Purchase (mesmo event_id = dedupe na Meta).
        await sendStudioTopupPurchaseEvents({
          request,
          topup: currentTopup,
          paymentId: paidPaymentId,
          email: composerEmail.email,
          eventSourceUrl: request.headers.get('referer') || request.url,
        })
      }

      return NextResponse.json({
        success: true,
        status: 'paid',
        alreadyPaid: true,
        credits: Number(currentTopup.credits) || 0,
        amount: Number(currentTopup.amount) || 0,
        currency: currentTopup.currency || 'BRL',
        paymentId: paidPaymentId || null,
        topupId: currentTopup.id,
        musicQuantity: Number(currentTopup.music_quantity) || 0,
      })
    }

    if (!paymentId) {
      return NextResponse.json({ success: true, status: currentTopup.status, pending: true })
    }

    if (currentTopup.payment_gateway === 'stripe') {
      const sessionId = paymentId.startsWith('cs_') ? paymentId : String(currentTopup.metadata?.stripe_session_id || '')
      if (!sessionId) return NextResponse.json({ success: true, status: currentTopup.status, pending: true })
      const session = await stripeRequest<any>(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`, { method: 'GET' })
      if (session.metadata?.external_reference !== currentTopup.external_reference || session.metadata?.topup_id !== currentTopup.id) {
        return NextResponse.json({ error: 'Pagamento não pertence a esta recarga' }, { status: 400 })
      }
      const stripePaymentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
      if (session.payment_status !== 'paid' || !stripePaymentId) {
        const nextStatus = session.status === 'expired' ? 'cancelled' : 'pending'
        await supabaseAdmin.from('studio_credit_topups').update({
          status: nextStatus,
          metadata: { ...(currentTopup.metadata || {}), stripe_session: sanitizeStripeObject(session) },
          updated_at: new Date().toISOString(),
        }).eq('id', currentTopup.id)
        return NextResponse.json({ success: true, status: nextStatus, pending: nextStatus === 'pending' })
      }
      const result = await creditStudioTopupOnce({
        topup: currentTopup,
        paymentId: stripePaymentId,
        paymentData: sanitizeStripeObject(session),
        provider: 'stripe',
        metadata: { syncedFromStripeSession: true, stripe_session_id: session.id },
      })
      if (result.credited) await sendApprovedStudioTopupSideEffects(request, result.topup, stripePaymentId)
      return NextResponse.json({ success: true, status: 'paid', credited: result.credited, paymentId: stripePaymentId, topupId: currentTopup.id })
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
    if (composerEmail) {
      await sendStudioTopupPurchaseEvents({
        request,
        topup: creditedTopup,
        paymentId,
        email: composerEmail.email,
        paymentMetadata: payment?.metadata,
        eventSourceUrl: request.headers.get('referer') || request.url,
      })
    }

    if (composerEmail && creditResult.credited) {
      await recordPartnerPurchase({
        composerId: creditedTopup.composer_id,
        purchaseId: paymentId,
        amount: Number(creditedTopup.amount) || 0,
        productType: 'studio_topup',
      })

      await Promise.allSettled([
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
