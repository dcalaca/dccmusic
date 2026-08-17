import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const topupId = String(request.nextUrl.searchParams.get('topupId') || '').trim()
    if (!topupId) {
      return NextResponse.json({ error: 'topupId obrigatório' }, { status: 400 })
    }

    const { data: topup, error } = await supabaseAdmin
      .from('studio_credit_topups')
      .select('id, status, payment_id, amount, currency, credits, music_quantity')
      .eq('id', topupId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (error) throw error
    if (!topup) return NextResponse.json({ error: 'Recarga não encontrada' }, { status: 404 })

    return NextResponse.json({
      success: true,
      status: topup.status,
      pending: topup.status !== 'paid',
      paymentId: topup.payment_id || null,
      amount: Number(topup.amount) || 0,
      currency: topup.currency || 'BRL',
      credits: Number(topup.credits) || 0,
      topupId: topup.id,
      musicQuantity: Number(topup.music_quantity) || 0,
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro ao consultar status da recarga:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar recarga' },
      { status: 500 }
    )
  }
}
