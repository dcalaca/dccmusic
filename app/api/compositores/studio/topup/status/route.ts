import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest, resolveComposerToken } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const tokenComposer = getComposerFromRequest(request)
    if (!tokenComposer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const composer = await resolveComposerToken(tokenComposer)
    if (!composer) return NextResponse.json({ error: 'Sua sessão está desatualizada. Entre novamente na sua conta.' }, { status: 401 })

    const topupId = String(request.nextUrl.searchParams.get('topupId') || '').trim()
    if (!topupId) return NextResponse.json({ error: 'topupId obrigatório' }, { status: 400 })

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
    return NextResponse.json({ error: error.message || 'Erro ao consultar recarga' }, { status: 500 })
  }
}
