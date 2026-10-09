import { NextResponse } from 'next/server'
import { verifyMercadoPagoWebhookSignature, isMercadoPagoLegacyIpnNotification, paymentClient } from '@/lib/mercadopago'
import { supabaseAdmin } from '@/lib/supabase'
import { reconcileFeaturedPayment } from '@/lib/featured-payment-brick'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const url = new URL(request.url)
    const type = String(body?.type || body?.topic || url.searchParams.get('topic') || url.searchParams.get('type') || '')
    if (type !== 'payment') return NextResponse.json({ received: true, processed: false })
    const paymentId = String(body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id') || '')
    if (!/^\d+$/.test(paymentId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    const legacyIpn = isMercadoPagoLegacyIpnNotification(request, body)
    const signature = verifyMercadoPagoWebhookSignature(request, paymentId)
    if (!legacyIpn && signature.configured && !signature.ok) {
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }
    // Never trust status or metadata delivered inside webhook. Obtain it from MP using server token.
    const payment: any = await paymentClient.get({ id: paymentId })
    const metadata = payment?.metadata || {}
    let featuredId = String(metadata.featured_id || '')
    if (!featuredId && String(payment?.external_reference || '').startsWith('featured:')) {
      featuredId = String(payment.external_reference).slice('featured:'.length)
    }
    if (!featuredId) {
      // Legacy Checkout Pro: resolve by preference only when returned by authenticated MP API.
      const preferenceId = String(payment?.preference_id || metadata.preference_id || '')
      if (preferenceId) {
        const { data } = await supabaseAdmin.from('dccmusic_featured_payments')
          .select('id').eq('mercado_pago_preference_id', preferenceId).maybeSingle()
        featuredId = data?.id || ''
      }
    }
    if (!featuredId) {
      console.warn('[FEATURED WEBHOOK] Pagamento não conciliado:', paymentId)
      return NextResponse.json({ received: true, processed: false })
    }
    const result = await reconcileFeaturedPayment(featuredId, paymentId)
    return NextResponse.json({ received: true, processed: true, status: result.status })
  } catch (error) {
    console.error('[FEATURED WEBHOOK] Falha:', error)
    return NextResponse.json({ received: false }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
