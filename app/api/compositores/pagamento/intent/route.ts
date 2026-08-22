import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import * as db from '@/lib/db'
import { getOrCreatePendingSubscription } from '@/lib/composer-plan-access'
import { buildMetaCapiMetadata, sendMetaInitiateCheckoutEvent } from '@/lib/meta-conversions'
import { isStripeConfigured } from '@/lib/stripe'
import { COUNTRY_COOKIE, normalizeCountry } from '@/lib/localization'
import { reportPaymentFailure } from '@/lib/payment-failure-alert'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const requestCountry = normalizeCountry(
      request.cookies.get(COUNTRY_COOKIE)?.value ||
      request.headers.get('x-dcc-country') ||
      request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cf-ipcountry')
    )
    const provider = requestCountry !== 'BR'
      ? (isStripeConfigured() ? 'stripe' : null)
      : process.env.MERCADOPAGO_ACCESS_TOKEN
        ? 'mercadopago'
        : isStripeConfigured()
          ? 'stripe'
          : null

    if (!provider) {
      await reportPaymentFailure({
        provider: 'checkout',
        stage: 'configuracao_plano',
        error: 'Nenhum provedor de pagamento está configurado',
        requestUrl: request.url,
      })
      return NextResponse.json(
        { error: 'Nenhum meio de pagamento está configurado. Entre em contato com o suporte.' },
        { status: 500 }
      )
    }

    const composerToken = getComposerFromRequest(request)
    if (!composerToken) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const planId = String(body.planId || '').trim()
    if (!planId) {
      return NextResponse.json({ error: 'Plano é obrigatório' }, { status: 400 })
    }

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

    if (!plan) {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

    const { data: composerData, error: composerError } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name, email')
      .eq('id', composerToken.composerId)
      .maybeSingle()

    if (composerError || !composerData) {
      return NextResponse.json({ error: 'Compositor não encontrado' }, { status: 404 })
    }

    const subscription = await getOrCreatePendingSubscription(composerData.id, plan.id)
    const amount = Number(plan.price) || 0
    if (amount <= 0) {
      return NextResponse.json({ error: 'Este plano não tem valor de pagamento configurado.' }, { status: 400 })
    }

    const metaCapi = buildMetaCapiMetadata(request, {
      email: composerData.email || null,
      externalId: composerData.id,
      eventSourceUrl: request.headers.get('referer') || request.url,
    })

    await supabaseAdmin
      .from('dccmusic_subscriptions')
      .update({
        metadata: {
          ...(subscription.metadata || {}),
          meta_capi: metaCapi,
          checkout_type: provider === 'stripe' ? 'stripe_embedded' : 'payment_brick',
          customer_country: requestCountry,
          customer_locale: requestCountry === 'PY' ? 'es-PY' : requestCountry === 'CO' ? 'es-CO' : 'pt-BR',
        },
      })
      .eq('id', subscription.id)

    const metaInitiateCheckoutEventId = `initiate_checkout:${plan.id}:${subscription.id}`
    await sendMetaInitiateCheckoutEvent({
      request,
      eventId: metaInitiateCheckoutEventId,
      eventSourceUrl: request.headers.get('referer') || request.url,
      email: composerData.email || null,
      externalId: composerData.id,
      value: amount,
      currency: 'BRL',
      contentName: plan.name,
      contentId: plan.id,
      quantity: 1,
    }).catch((metaError) => {
      console.error('[PLAN INTENT] Erro ao enviar início de checkout para Meta:', metaError)
    })

    return NextResponse.json({
      success: true,
      provider,
      publicKey: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || null,
      subscriptionId: subscription.id,
      planId: plan.id,
      planName: plan.name,
      planPrice: amount,
      amount,
      composerEmail: composerData.email || null,
      metaInitiateCheckoutEventId,
      country: requestCountry,
    })
  } catch (error: any) {
    console.error('[PLAN INTENT] Erro ao preparar pagamento do plano:', error)
    await reportPaymentFailure({
      provider: 'checkout',
      stage: 'preparacao_plano',
      error,
      requestUrl: request.url,
      composerId: getComposerFromRequest(request)?.composerId,
    })
    return NextResponse.json(
      { error: error.message || 'Erro ao preparar pagamento do plano' },
      { status: 500 }
    )
  }
}
