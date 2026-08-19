import { NextRequest, NextResponse } from 'next/server'
import { asaasRequest, asaasStatusToTopupStatus, sanitizeAsaasPayment } from '@/lib/asaas'
import { supabaseAdmin } from '@/lib/supabase'
import { creditStudioTopupOnce, revokeStudioTopupCreditOnce } from '@/lib/studio'
import { sendApprovedStudioTopupSideEffects } from '@/lib/studio-topup-side-effects'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim()
    if (!expectedToken || request.headers.get('asaas-access-token')?.trim() !== expectedToken) return NextResponse.json({ error: 'Webhook não autorizado' }, { status: 401 })
    const body = await request.json()
    const paymentId = String(body?.payment?.id || '').trim()
    if (!paymentId) return NextResponse.json({ received: true })

    const payment = await asaasRequest<any>(`/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' })
    const externalReference = String(payment.externalReference || '').trim()
    if (!externalReference.startsWith('studio-topup:')) return NextResponse.json({ received: true })
    const { data: topup, error } = await supabaseAdmin.from('studio_credit_topups').select('*').eq('external_reference', externalReference).maybeSingle()
    if (error) throw error
    if (!topup) return NextResponse.json({ received: true })

    const nextStatus = asaasStatusToTopupStatus(payment.status)
    if (nextStatus === 'paid') {
      const result = await creditStudioTopupOnce({ topup, paymentId, paymentData: sanitizeAsaasPayment(payment), provider: 'asaas', metadata: { asaasWebhookEventId: body?.id || null } })
      if (result.credited) await sendApprovedStudioTopupSideEffects(request, result.topup, paymentId)
    } else {
      await supabaseAdmin.from('studio_credit_topups').update({ status: nextStatus, payment_id: paymentId, payment_gateway: 'asaas', metadata: { ...(topup.metadata || {}), asaas_payment: sanitizeAsaasPayment(payment), asaas_webhook_event_id: body?.id || null }, updated_at: new Date().toISOString() }).eq('id', topup.id)
      if (topup.status === 'paid' && ['refunded', 'cancelled'].includes(nextStatus)) await revokeStudioTopupCreditOnce({ topup, paymentId, paymentData: payment, reason: String(payment.status) })
    }
    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[ASAAS WEBHOOK] Erro:', { name: error?.name, message: error?.message, status: error?.status })
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 })
  }
}
