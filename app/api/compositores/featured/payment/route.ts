import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import { paymentClient } from '@/lib/mercadopago'
import { reconcileFeaturedPayment } from '@/lib/featured-payment-brick'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return NextResponse.json({ error: 'Pagamento indisponível' }, { status: 503 })
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const { featuredId, formData } = await request.json()
    if (!featuredId || !formData?.payment_method_id) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    const { data: featured, error } = await supabaseAdmin.from('dccmusic_featured_payments').select('*')
      .eq('id', featuredId).eq('composer_id', composer.composerId).maybeSingle()
    if (error) throw error
    if (!featured) return NextResponse.json({ error: 'Destaque não encontrado' }, { status: 404 })
    if (featured.payment_status === 'approved') return NextResponse.json({ status: 'paid', featuredId })
    if (featured.payment_status !== 'pending') return NextResponse.json({ error: 'Pagamento indisponível' }, { status: 409 })
    if (featured.mercado_pago_payment_id) {
      const prior = await reconcileFeaturedPayment(featured.id, String(featured.mercado_pago_payment_id))
      return NextResponse.json({ status: prior.status, featuredId, paymentId: featured.mercado_pago_payment_id, pending: prior.status !== 'paid' })
    }
    const { data: owner } = await supabaseAdmin.from('dccmusic_composers').select('email').eq('id', composer.composerId).maybeSingle()
    const payment: any = await paymentClient.create({
      body: {
        transaction_amount: Number(featured.amount),
        token: formData.token || undefined,
        description: 'DCC Music - Destaque por 10 dias',
        installments: Number(formData.installments || 1),
        payment_method_id: formData.payment_method_id,
        issuer_id: formData.issuer_id || undefined,
        payer: {
          email: formData.payer?.email || owner?.email,
          identification: formData.payer?.identification || undefined,
        },
        external_reference: `featured:${featured.id}`,
        metadata: { type: 'featured', featured_id: featured.id, composer_id: featured.composer_id,
          content_id: featured.content_id, content_type: featured.content_type },
        notification_url: `${process.env.NEXTAUTH_URL || 'https://www.dccmusic.online'}/api/compositores/featured/webhook`,
        statement_descriptor: 'DCC Music',
      },
      requestOptions: { idempotencyKey: `featured-payment-${featured.id}` },
    })
    if (!payment?.id) throw new Error('Pagamento sem identificador')
    const result = await reconcileFeaturedPayment(featured.id, String(payment.id))
    return NextResponse.json({ status: result.status, featuredId, paymentId: String(payment.id),
      pending: result.status !== 'paid', payment })
  } catch (error) {
    console.error('[FEATURED PAYMENT] Erro ao processar pagamento:', error)
    return NextResponse.json({ error: 'Não foi possível processar o pagamento' }, { status: 500 })
  }
}
