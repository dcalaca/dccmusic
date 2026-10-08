import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/** Returns a verified, paid plan payment belonging to the authenticated composer. */
export async function GET(request: NextRequest) {
  const composer = getComposerFromRequest(request)
  if (!composer) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const subscriptionId = request.nextUrl.searchParams.get('subscription_id')?.trim() || ''
  const paymentId = request.nextUrl.searchParams.get('payment_id')?.trim() || ''
  if (!subscriptionId && !paymentId) {
    return NextResponse.json({ error: 'payment_reference_required' }, { status: 400 })
  }

  let query = supabaseAdmin
    .from('dccmusic_payments')
    .select('id, subscription_id, gateway_payment_id, amount, currency, status, paid_at')
    .eq('composer_id', composer.composerId)
    .eq('status', 'paid')
    .not('paid_at', 'is', null)

  // A payment reference must resolve to an actual database payment, never to a
  // URL-only identifier (such as a Mercado Pago preference or checkout session).
  if (paymentId) {
    query = query.eq('gateway_payment_id', paymentId)
  } else {
    query = query.eq('subscription_id', subscriptionId)
  }

  const { data, error } = await query.order('paid_at', { ascending: false }).limit(1).maybeSingle()
  if (error) {
    console.error('[Ads purchase verification] Database query failed')
    return NextResponse.json({ error: 'verification_unavailable' }, { status: 503 })
  }
  if (!data) return NextResponse.json({ status: 'unverified' }, { status: 404 })
  if (subscriptionId && data.subscription_id !== subscriptionId) {
    return NextResponse.json({ status: 'unverified' }, { status: 404 })
  }

  const amount = Number(data.amount)
  const currency = String(data.currency || '').toUpperCase()
  if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ error: 'invalid_payment_value' }, { status: 422 })
  }

  return NextResponse.json({
    status: 'paid',
    transactionId: 'plan_' + data.id,
    value: amount,
    currency,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
