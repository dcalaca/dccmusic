import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const subscriptionId = String(request.nextUrl.searchParams.get('subscriptionId') || '').trim()
    if (!subscriptionId) {
      return NextResponse.json({ error: 'subscriptionId obrigatório' }, { status: 400 })
    }

    const { data: subscription, error } = await supabaseAdmin
      .from('dccmusic_subscriptions')
      .select('id, status, payment_id, plan_id')
      .eq('id', subscriptionId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (error) throw error
    if (!subscription) return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })

    const paid = subscription.status === 'active'
    return NextResponse.json({
      success: true,
      status: paid ? 'paid' : subscription.status,
      pending: !paid,
      paymentId: subscription.payment_id || null,
      subscriptionId: subscription.id,
    })
  } catch (error: any) {
    console.error('[PLAN STATUS] Erro ao consultar status do plano:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar assinatura' },
      { status: 500 }
    )
  }
}
