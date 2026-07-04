import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { STUDIO_MUSIC_CREDITS } from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function normalizeCode(value: unknown) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

async function composerAlreadyUsedCoupon(composerId: string, couponId: string, isFree: boolean) {
  if (isFree) {
    const { data } = await supabaseAdmin
      .from('studio_credit_transactions')
      .select('id')
      .eq('composer_id', composerId)
      .eq('action', 'manual_credit')
      .contains('metadata', { couponId })
      .limit(1)

    return Boolean(data?.length)
  }

  const { data } = await supabaseAdmin
    .from('studio_credit_topups')
    .select('id')
    .eq('composer_id', composerId)
    .in('status', ['pending', 'paid'])
    .contains('metadata', { couponId })
    .limit(1)

  return Boolean(data?.length)
}

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const code = normalizeCode(body.code)
    if (code.length < 3) {
      return NextResponse.json({ error: 'Digite um código de cupom válido.' }, { status: 400 })
    }

    const { data: coupon, error: couponError } = await supabaseAdmin
      .from('studio_coupons')
      .select('*')
      .eq('code', code)
      .maybeSingle()

    if (couponError) throw couponError
    if (!coupon) {
      return NextResponse.json({ error: 'Cupom não encontrado. Confira o código.' }, { status: 404 })
    }
    if (!coupon.active) {
      return NextResponse.json({ error: 'Este cupom não está mais ativo.' }, { status: 400 })
    }
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Este cupom expirou.' }, { status: 400 })
    }
    if (Number(coupon.used_count) >= Number(coupon.max_uses)) {
      return NextResponse.json({ error: 'Este cupom já atingiu o limite de usos.' }, { status: 400 })
    }

    const musicQuantity = Math.floor(Number(coupon.music_quantity) || 0)
    const price = Number(coupon.price) || 0
    const isFree = price <= 0
    const credits = musicQuantity * STUDIO_MUSIC_CREDITS

    const alreadyRedeemed = await composerAlreadyUsedCoupon(composer.composerId, coupon.id, isFree)

    return NextResponse.json({
      valid: true,
      code: coupon.code,
      type: isFree ? 'free' : 'paid',
      musicQuantity,
      credits,
      price: Number(price.toFixed(2)),
      unitPrice: musicQuantity > 0 ? Number((price / musicQuantity).toFixed(2)) : 0,
      expiresAt: coupon.expires_at,
      alreadyRedeemed,
    })
  } catch (error: any) {
    console.error('[CUPOM] Erro ao validar:', error)
    return NextResponse.json({ error: error.message || 'Erro ao validar cupom' }, { status: 500 })
  }
}
