import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import { reconcileFeaturedPayment } from '@/lib/featured-payment-brick'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const featuredId = new URL(request.url).searchParams.get('featuredId')
    if (!featuredId) return NextResponse.json({ error: 'Identificador obrigatório' }, { status: 400 })
    const { data: featured, error } = await supabaseAdmin.from('dccmusic_featured_payments').select('*')
      .eq('id', featuredId).eq('composer_id', composer.composerId).maybeSingle()
    if (error) throw error
    if (!featured) return NextResponse.json({ error: 'Destaque não encontrado' }, { status: 404 })
    if (featured.payment_status === 'approved') return NextResponse.json({ status: 'paid', featuredId })
    if (!featured.mercado_pago_payment_id) return NextResponse.json({ status: 'pending', featuredId })
    const result = await reconcileFeaturedPayment(featured.id, String(featured.mercado_pago_payment_id))
    return NextResponse.json({ status: result.status, featuredId })
  } catch (error) {
    console.error('[FEATURED CHECK] Erro:', error)
    return NextResponse.json({ error: 'Não foi possível consultar o pagamento' }, { status: 500 })
  }
}
