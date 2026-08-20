import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getStudioTopupQuote } from '@/lib/studio-topups'
import { isStripeConfigured, stripeRequest } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    if (!isStripeConfigured()) return NextResponse.json({ error: 'Stripe não configurada no servidor' }, { status: 503 })
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const { topupId } = await request.json()
    if (!topupId) return NextResponse.json({ error: 'topupId obrigatório' }, { status: 400 })

    const { data: topup, error } = await supabaseAdmin.from('studio_credit_topups').select('*').eq('id', topupId).eq('composer_id', composer.composerId).maybeSingle()
    if (error) throw error
    if (!topup) return NextResponse.json({ error: 'Recarga não encontrada' }, { status: 404 })
    if (topup.status === 'paid') return NextResponse.json({ error: 'Esta recarga já foi paga' }, { status: 409 })
    if (topup.payment_gateway === 'mercadopago' && topup.payment_id) {
      return NextResponse.json({ error: 'Já existe um pagamento Mercado Pago em andamento. Aguarde a confirmação antes de tentar outra forma.' }, { status: 409 })
    }

    const quote = getStudioTopupQuote(Number(topup.music_quantity) || 0)
    if (Math.abs(Number(topup.amount) - quote.totalPrice) > 0.01) return NextResponse.json({ error: 'Valor da recarga não confere' }, { status: 400 })
    const { data: composerData } = await supabaseAdmin.from('dccmusic_composers').select('email').eq('id', composer.composerId).maybeSingle()
    const params = new URLSearchParams()
    params.set('mode', 'payment')
    params.set('ui_mode', 'embedded_page')
    params.set('redirect_on_completion', 'never')
    params.set('adaptive_pricing[enabled]', 'true')
    const integrationSuffix = crypto.createHash('sha256').update(topup.id).digest().subarray(0, 8)
      .toString('hex').replace(/[0-9]/g, (digit) => String.fromCharCode(97 + Number(digit)))
      .slice(0, 8)
    params.set('integration_identifier', `dccmusic_${integrationSuffix}`)
    params.set('line_items[0][price_data][currency]', 'brl')
    params.set('line_items[0][price_data][unit_amount]', String(Math.round(quote.totalPrice * 100)))
    const customerCountry = String(topup.metadata?.customer_country || 'BR')
    const isInternational = customerCountry === 'PY' || customerCountry === 'CO'
    params.set(
      'line_items[0][price_data][product_data][name]',
      isInternational
        ? `Recarga DCC Music - ${topup.music_quantity} canción(es)`
        : topup.metadata?.package_name || `Recarga DCC Music - ${topup.music_quantity} música(s)`
    )
    if (isInternational) params.set('locale', 'es')
    params.set('line_items[0][quantity]', '1')
    params.set('metadata[topup_id]', topup.id)
    params.set('metadata[external_reference]', topup.external_reference)
    params.set('payment_intent_data[metadata][topup_id]', topup.id)
    params.set('payment_intent_data[metadata][external_reference]', topup.external_reference)
    if (composerData?.email) params.set('customer_email', composerData.email)

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

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      clientSecret: session.client_secret,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro ao criar sessão Stripe:', error?.message)
    return NextResponse.json({ error: error?.message || 'Erro ao abrir pagamento alternativo' }, { status: 500 })
  }
}
