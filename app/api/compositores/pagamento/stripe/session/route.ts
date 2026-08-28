import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getOrCreatePendingSubscription } from '@/lib/composer-plan-access'
import { isStripeConfigured, stripeRequest } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import * as db from '@/lib/db'
import { COUNTRY_COOKIE, normalizeCountry } from '@/lib/localization'
import { getStripeMinorUnitAmount, getStudioPlanPriceQuote } from '@/lib/studio-topups'
import { reportPaymentFailure } from '@/lib/payment-failure-alert'

export const dynamic = 'force-dynamic'

function isStudioPlan(plan: db.Plan) {
  const identity = `${plan.name || ''} ${plan.slug || ''}`.toLowerCase()
  return ['studio-start', 'studio-pro', 'studio-elite', 'dcc-studio-ia'].includes(plan.slug) || identity.includes('studio ia') || identity.includes('dcc studio')
}

function getCustomerLocale(country: string) {
  if (country === 'PT') return 'pt-PT'
  if (country === 'MX') return 'es-MX'
  if (country === 'CO') return 'es-CO'
  if (country === 'PY') return 'es-PY'
  return 'pt-BR'
}

export async function POST(request: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      await reportPaymentFailure({
        provider: 'stripe',
        stage: 'configuracao_plano',
        error: 'Stripe não configurada no servidor',
        requestUrl: request.url,
      })
      return NextResponse.json({ error: 'Stripe não configurado no servidor' }, { status: 503 })
    }

    const composerToken = getComposerFromRequest(request)
    if (!composerToken) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const customerCountry = normalizeCountry(
      request.cookies.get(COUNTRY_COOKIE)?.value ||
      request.headers.get('x-dcc-country') ||
      request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cf-ipcountry')
    )
    if (customerCountry === 'BR') {
      return NextResponse.json({ error: 'Stripe internacional disponível apenas fora do Brasil' }, { status: 400 })
    }
    const customerLocale = getCustomerLocale(customerCountry)

    const body = await request.json()
    const planId = String(body.planId || '').trim()
    if (!planId) return NextResponse.json({ error: 'Plano é obrigatório' }, { status: 400 })

    let plan = await db.getPlanBySlug(planId)
    if (!plan) {
      const { data: planData } = await supabaseAdmin
        .from('dccmusic_plans')
        .select('*')
        .eq('id', planId)
        .eq('is_active', true)
        .maybeSingle()
      if (planData) plan = db.mapPlan(planData)
    }
    if (!plan) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })

    const { data: composer } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, email, name')
      .eq('id', composerToken.composerId)
      .maybeSingle()
    if (!composer) return NextResponse.json({ error: 'Compositor não encontrado' }, { status: 404 })

    const subscription = await getOrCreatePendingSubscription(composer.id, plan.id)
    const priceQuote = isStudioPlan(plan)
      ? getStudioPlanPriceQuote(Number(plan.price) || 0, customerCountry)
      : { amount: Number(plan.price) || 0, currency: 'BRL' as const }
    const amount = priceQuote.amount
    if (amount <= 0) return NextResponse.json({ error: 'Valor do plano inválido' }, { status: 400 })

    const params = new URLSearchParams()
    params.set('mode', 'payment')
    params.set('ui_mode', 'embedded_page')
    params.set('redirect_on_completion', 'never')
    params.set('adaptive_pricing[enabled]', 'true')
    params.set('locale', customerCountry === 'PT' ? 'pt' : 'es')
    const suffix = crypto.createHash('sha256').update(subscription.id).digest('hex')
      .replace(/[0-9]/g, (digit) => String.fromCharCode(97 + Number(digit))).slice(0, 8)
    params.set('integration_identifier', `dccplan_${suffix}`)
    params.set('line_items[0][price_data][currency]', priceQuote.currency.toLowerCase())
    params.set('line_items[0][price_data][unit_amount]', String(getStripeMinorUnitAmount(amount, priceQuote.currency)))
    params.set('line_items[0][price_data][product_data][name]', plan.name || 'Plan DCC Music')
    if (plan.description) params.set('line_items[0][price_data][product_data][description]', plan.description.slice(0, 500))
    params.set('line_items[0][quantity]', '1')
    params.set('metadata[subscription_id]', subscription.id)
    params.set('metadata[composer_id]', composer.id)
    params.set('metadata[plan_id]', plan.id)
    params.set('metadata[external_reference]', subscription.id)
    params.set('payment_intent_data[metadata][subscription_id]', subscription.id)
    params.set('payment_intent_data[metadata][composer_id]', composer.id)
    if (composer.email) params.set('customer_email', composer.email)

    const session = await stripeRequest<any>('/checkout/sessions', {
      method: 'POST',
      body: params,
      headers: { 'Idempotency-Key': `composer-plan-stripe-${subscription.id}` },
    })

    await supabaseAdmin
      .from('dccmusic_subscriptions')
      .update({
        metadata: {
          ...(subscription.metadata || {}),
          checkout_type: 'stripe_embedded',
          customer_country: customerCountry,
          customer_locale: customerLocale,
          checkout_currency: priceQuote.currency,
          checkout_amount: amount,
          stripe_session_id: session.id,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)

    return NextResponse.json({
      success: true,
      provider: 'stripe',
      subscriptionId: subscription.id,
      clientSecret: session.client_secret,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      sessionId: session.id,
      amount,
      currency: priceQuote.currency,
    })
  } catch (error: any) {
    console.error('[PLAN STRIPE] Erro ao criar sessão:', error?.message)
    await reportPaymentFailure({
      provider: 'stripe',
      stage: 'criacao_checkout_plano',
      error,
      requestUrl: request.url,
      composerId: getComposerFromRequest(request)?.composerId,
    })
    return NextResponse.json({ error: error?.message || 'Erro ao abrir pagamento Stripe' }, { status: 500 })
  }
}
