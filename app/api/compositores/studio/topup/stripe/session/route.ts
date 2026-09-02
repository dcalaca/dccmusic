import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getComposerFromRequest, resolveComposerToken } from '@/lib/composer-middleware'
import { getStripeMinorUnitAmount, type StudioTopupCurrency } from '@/lib/studio-topups'
import { isStripeConfigured, stripeRequest } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeCountry } from '@/lib/localization'
import { reportPaymentFailure } from '@/lib/payment-failure-alert'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      await reportPaymentFailure({ provider: 'stripe', stage: 'configuracao_recarga', error: 'Stripe não configurada no servidor', requestUrl: request.url })
      return NextResponse.json({ error: 'Stripe não configurada no servidor' }, { status: 503 })
    }
    const tokenComposer = getComposerFromRequest(request)
    if (!tokenComposer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const composer = await resolveComposerToken(tokenComposer)
    if (!composer) return NextResponse.json({ error: 'Sua sessão está desatualizada. Entre novamente na sua conta.' }, { status: 401 })

    const { topupId } = await request.json()
    if (!topupId) return NextResponse.json({ error: 'topupId obrigatório' }, { status: 400 })

    const { data: topup, error } = await supabaseAdmin.from('studio_credit_topups').select('*').eq('id', topupId).eq('composer_id', composer.composerId).maybeSingle()
    if (error) throw error
    if (!topup) return NextResponse.json({ error: 'Recarga não encontrada' }, { status: 404 })
    if (topup.status === 'paid') return NextResponse.json({ error: 'Esta recarga já foi paga' }, { status: 409 })
    if (topup.payment_gateway === 'mercadopago' && topup.payment_id) {
      return NextResponse.json({ error: 'Já existe um pagamento Mercado Pago em andamento. Aguarde a confirmação antes de tentar outra forma.' }, { status: 409 })
    }

    const customerCountry = normalizeCountry(String(topup.metadata?.customer_country || 'BR'))
    const customerCountryCode = String(customerCountry)
    const amount = Number(topup.amount)
    const currency = String(topup.currency || '').toUpperCase() as StudioTopupCurrency
    if (!(amount > 0)) return NextResponse.json({ error: 'Valor da recarga inválido' }, { status: 400 })
    if (!['BRL','PYG','COP','EUR','MXN','USD'].includes(currency)) return NextResponse.json({ error: 'Moeda da recarga inválida' }, { status: 400 })

    const params = new URLSearchParams()
    params.set('mode', 'payment')
    params.set('ui_mode', 'embedded_page')
    params.set('redirect_on_completion', 'never')
    params.set('adaptive_pricing[enabled]', 'true')
    const integrationSuffix = crypto.createHash('sha256').update(topup.id).digest().subarray(0, 8)
      .toString('hex').replace(/[0-9]/g, (digit) => String.fromCharCode(97 + Number(digit))).slice(0, 8)
    params.set('integration_identifier', `dccmusic_${integrationSuffix}`)
    params.set('line_items[0][price_data][currency]', currency.toLowerCase())
    params.set('line_items[0][price_data][unit_amount]', String(getStripeMinorUnitAmount(amount, currency)))
    const isSpanish = customerCountryCode === 'PY' || customerCountryCode === 'CO' || customerCountryCode === 'MX'
    params.set('line_items[0][price_data][product_data][name]', customerCountryCode === 'US'
      ? `DCC Music Credits - ${topup.music_quantity} song(s)`
      : isSpanish
        ? `Recarga DCC Music - ${topup.music_quantity} canción(es)`
        : topup.metadata?.package_name || `Recarga DCC Music - ${topup.music_quantity} música(s)`)
    if (isSpanish) params.set('locale', 'es')
    if (customerCountryCode === 'PT') params.set('locale', 'pt')
    if (customerCountryCode === 'US') params.set('locale', 'en')
    params.set('line_items[0][quantity]', '1')
    params.set('metadata[topup_id]', topup.id)
    params.set('metadata[external_reference]', topup.external_reference)
    params.set('payment_intent_data[metadata][topup_id]', topup.id)
    params.set('payment_intent_data[metadata][external_reference]', topup.external_reference)
    if (composer.email) params.set('customer_email', composer.email)

    const session = await stripeRequest<any>('/checkout/sessions', {
      method: 'POST',
      body: params,
      headers: { 'Idempotency-Key': `studio-topup-stripe-${topup.id}` },
    })
    await supabaseAdmin.from('studio_credit_topups').update({
      payment_gateway: 'stripe',
      metadata: { ...(topup.metadata || {}), checkout_type: 'stripe_embedded', stripe_session_id: session.id },
      updated_at: new Date().toISOString(),
    }).eq('id', topup.id)

    return NextResponse.json({ success: true, sessionId: session.id, clientSecret: session.client_secret, publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY })
  } catch (error: any) {
    console.error('[Studio IA] Erro ao criar sessão Stripe:', error?.message)
    await reportPaymentFailure({ provider: 'stripe', stage: 'criacao_checkout_recarga', error, requestUrl: request.url, composerId: getComposerFromRequest(request)?.composerId })
    return NextResponse.json({ error: error?.message || 'Erro ao abrir pagamento alternativo' }, { status: 500 })
  }
}
