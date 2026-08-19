import { NextRequest, NextResponse } from 'next/server'
import { creditStudioTopupOnce, revokeStudioTopupCreditOnce } from '@/lib/studio'
import { sendApprovedStudioTopupSideEffects } from '@/lib/studio-topup-side-effects'
import { sanitizeStripeObject, verifyStripeWebhookSignature } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const verification = verifyStripeWebhookSignature(rawBody, request.headers.get('stripe-signature'))
    if (!verification.ok) {
      console.error('[STRIPE WEBHOOK] Assinatura inválida:', verification.reason)
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }
    const event = JSON.parse(rawBody)
    const object = event?.data?.object || {}
    const topupId = String(object?.metadata?.topup_id || '').trim()

    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      if (!topupId || object.payment_status !== 'paid') return NextResponse.json({ received: true })
      const { data: topup, error } = await supabaseAdmin.from('studio_credit_topups').select('*').eq('id', topupId).maybeSingle()
      if (error) throw error
      if (!topup || object.metadata?.external_reference !== topup.external_reference) return NextResponse.json({ received: true })
      const paymentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id
      if (!paymentId) return NextResponse.json({ received: true })
      const result = await creditStudioTopupOnce({ topup, paymentId, paymentData: sanitizeStripeObject(object), provider: 'stripe', metadata: { stripe_event_id: event.id, stripe_session_id: object.id } })
      if (result.credited) await sendApprovedStudioTopupSideEffects(request, result.topup, paymentId)
    } else if (event.type === 'checkout.session.expired' && topupId) {
      await supabaseAdmin.from('studio_credit_topups').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', topupId).neq('status', 'paid')
    } else if (event.type === 'payment_intent.payment_failed' && topupId) {
      await supabaseAdmin.from('studio_credit_topups').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', topupId).neq('status', 'paid')
    } else if (event.type === 'charge.refunded') {
      const paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id
      if (paymentIntentId) {
        const { data: topup } = await supabaseAdmin.from('studio_credit_topups').select('*').eq('payment_id', paymentIntentId).maybeSingle()
        if (topup?.status === 'paid') await revokeStudioTopupCreditOnce({ topup, paymentId: paymentIntentId, paymentData: sanitizeStripeObject(object), reason: 'refunded', provider: 'stripe' })
      }
    }
    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[STRIPE WEBHOOK] Erro:', error?.message)
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 })
  }
}
