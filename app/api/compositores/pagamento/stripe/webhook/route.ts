import { NextRequest, NextResponse } from 'next/server'
import { creditStudioTopupOnce, revokeStudioTopupCreditOnce } from '@/lib/studio'
import { sendApprovedStudioTopupSideEffects } from '@/lib/studio-topup-side-effects'
import { sanitizeStripeObject, verifyStripeWebhookSignature } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { activateComposerPlanAccess, revokeComposerPlanAccess } from '@/lib/composer-plan-access'
import { recordPartnerPurchase } from '@/lib/partners'
import { sendAdminPaymentNotificationEmail, sendPaymentConfirmationEmail } from '@/lib/dcc-emails'
import { readMetaBrowserContextFromMetadata, sendMetaPurchaseEvent } from '@/lib/meta-conversions'
import { sendTikTokPurchaseEvent } from '@/lib/tiktok-events'
import { reportPaymentFailure } from '@/lib/payment-failure-alert'

export const dynamic = 'force-dynamic'

async function sendApprovedPlanSideEffects(request: NextRequest, subscription: any, plan: any, paymentId: string) {
  const { data: composer } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id, name, email')
    .eq('id', subscription.composer_id)
    .maybeSingle()
  if (!composer?.email) return

  const amount = Number(plan.price) || 0
  const description = plan.name || 'Plan DCC Music'
  const browserContext = readMetaBrowserContextFromMetadata(subscription.metadata)

  await recordPartnerPurchase({ composerId: composer.id, purchaseId: paymentId, amount, productType: 'composer_plan' })
  await Promise.allSettled([
    sendMetaPurchaseEvent({
      request,
      browserContext,
      eventId: paymentId,
      eventSourceUrl: browserContext?.event_source_url || process.env.NEXTAUTH_URL || 'https://www.dccmusic.online',
      email: composer.email,
      externalId: composer.id,
      value: amount,
      currency: 'BRL',
      contentName: description,
      contentId: 'composer_plan',
      quantity: 1,
    }),
    sendTikTokPurchaseEvent({
      request,
      eventId: paymentId,
      eventSourceUrl: process.env.NEXTAUTH_URL || 'https://www.dccmusic.online',
      email: composer.email,
      externalId: composer.id,
      value: amount,
      currency: 'BRL',
      contentName: description,
      contentId: 'composer_plan',
      quantity: 1,
    }),
    sendPaymentConfirmationEmail({
      composerId: composer.id,
      name: composer.name || 'Compositor',
      email: composer.email,
      paymentId,
      productType: 'plan',
      description,
      amount,
      paidAt: new Date(),
    }),
    sendAdminPaymentNotificationEmail({
      composerName: composer.name || 'Compositor',
      composerEmail: composer.email,
      paymentId,
      productType: 'plan',
      description,
      amount,
    }),
  ])
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const verification = verifyStripeWebhookSignature(rawBody, request.headers.get('stripe-signature'))
    if (!verification.ok) {
      console.error('[STRIPE WEBHOOK] Assinatura inválida:', verification.reason)
      if (!verification.configured) {
        await reportPaymentFailure({
          provider: 'stripe',
          stage: 'configuracao_webhook',
          error: 'STRIPE_WEBHOOK_SECRET não configurado; pagamentos aprovados não podem ser confirmados',
          requestUrl: request.url,
        })
      }
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }
    const event = JSON.parse(rawBody)
    const object = event?.data?.object || {}
    const topupId = String(object?.metadata?.topup_id || '').trim()
    const subscriptionId = String(object?.metadata?.subscription_id || '').trim()

    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      if (subscriptionId && object.payment_status === 'paid') {
        const { data: subscription, error: subscriptionError } = await supabaseAdmin
          .from('dccmusic_subscriptions')
          .select('*')
          .eq('id', subscriptionId)
          .maybeSingle()
        if (subscriptionError) throw subscriptionError
        if (!subscription || object.metadata?.external_reference !== subscription.id) {
          return NextResponse.json({ received: true })
        }

        const { data: plan, error: planError } = await supabaseAdmin
          .from('dccmusic_plans')
          .select('*')
          .eq('id', subscription.plan_id)
          .maybeSingle()
        if (planError) throw planError
        if (!plan) return NextResponse.json({ received: true })

        const paymentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id
        if (!paymentId) return NextResponse.json({ received: true })

        const { data: existingPayment } = await supabaseAdmin
          .from('dccmusic_payments')
          .select('id, status')
          .eq('gateway_payment_id', paymentId)
          .maybeSingle()

        let paymentJustConfirmed = false
        if (!existingPayment) {
          const { error: paymentError } = await supabaseAdmin.from('dccmusic_payments').insert({
            subscription_id: subscription.id,
            composer_id: subscription.composer_id,
            amount: Number(plan.price) || 0,
            currency: 'BRL',
            status: 'paid',
            payment_method: 'card',
            payment_gateway: 'stripe',
            gateway_payment_id: paymentId,
            gateway_response: sanitizeStripeObject(object),
            paid_at: new Date().toISOString(),
          })
          if (paymentError) throw paymentError
          paymentJustConfirmed = true
        } else if (existingPayment.status !== 'paid') {
          const { error: paymentError } = await supabaseAdmin
            .from('dccmusic_payments')
            .update({ status: 'paid', gateway_response: sanitizeStripeObject(object), paid_at: new Date().toISOString() })
            .eq('id', existingPayment.id)
          if (paymentError) throw paymentError
          paymentJustConfirmed = true
        }

        await activateComposerPlanAccess({ subscription, plan, paymentId })
        if (paymentJustConfirmed) await sendApprovedPlanSideEffects(request, subscription, plan, paymentId)
        return NextResponse.json({ received: true })
      }

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
    } else if (event.type === 'checkout.session.expired' && subscriptionId) {
      await supabaseAdmin.from('dccmusic_subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', subscriptionId).neq('status', 'active')
    } else if (event.type === 'payment_intent.payment_failed' && topupId) {
      await supabaseAdmin.from('studio_credit_topups').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', topupId).neq('status', 'paid')
    } else if (event.type === 'payment_intent.payment_failed' && subscriptionId) {
      await supabaseAdmin.from('dccmusic_subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', subscriptionId).neq('status', 'active')
    } else if (event.type === 'charge.refunded') {
      const paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id
      if (paymentIntentId) {
        const { data: topup } = await supabaseAdmin.from('studio_credit_topups').select('*').eq('payment_id', paymentIntentId).maybeSingle()
        if (topup?.status === 'paid') {
          await revokeStudioTopupCreditOnce({ topup, paymentId: paymentIntentId, paymentData: sanitizeStripeObject(object), reason: 'refunded', provider: 'stripe' })
        } else {
          const { data: payment } = await supabaseAdmin
            .from('dccmusic_payments')
            .select('subscription_id')
            .eq('gateway_payment_id', paymentIntentId)
            .maybeSingle()
          if (payment?.subscription_id) {
            const { data: subscription } = await supabaseAdmin
              .from('dccmusic_subscriptions')
              .select('*')
              .eq('id', payment.subscription_id)
              .maybeSingle()
            if (subscription?.status === 'active') {
              await revokeComposerPlanAccess({ subscription, paymentId: paymentIntentId })
              await supabaseAdmin.from('dccmusic_payments').update({ status: 'refunded' }).eq('gateway_payment_id', paymentIntentId)
            }
          }
        }
      }
    }
    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[STRIPE WEBHOOK] Erro:', error?.message)
    await reportPaymentFailure({
      provider: 'stripe',
      stage: 'processamento_webhook',
      error,
      requestUrl: request.url,
    })
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 })
  }
}
