import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import {
  addStudioCreditTransaction,
  STUDIO_MUSIC_CREDITS,
  studioMonthKey,
} from '@/lib/studio'
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

  // Uma tentativa pendente não equivale a cupom utilizado.
  const { data } = await supabaseAdmin
    .from('studio_credit_topups')
    .select('id')
    .eq('composer_id', composerId)
    .eq('status', 'paid')
    .contains('metadata', { couponId })
    .limit(1)

  return Boolean(data?.length)
}

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 })

    const body = await request.json()
    const code = normalizeCode(body.code)
    if (code.length < 3) {
      return NextResponse.json({ errorCode: 'codeRequired' }, { status: 400 })
    }

    const { data: coupon, error: couponError } = await supabaseAdmin
      .from('studio_coupons')
      .select('*')
      .eq('code', code)
      .maybeSingle()

    if (couponError) throw couponError
    if (!coupon) {
      return NextResponse.json({ errorCode: 'notFound' }, { status: 404 })
    }
    if (!coupon.active) {
      return NextResponse.json({ errorCode: 'inactive' }, { status: 400 })
    }
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ errorCode: 'expired' }, { status: 400 })
    }
    if (Number(coupon.used_count) >= Number(coupon.max_uses)) {
      return NextResponse.json({ errorCode: 'usageLimit' }, { status: 400 })
    }

    const musicQuantity = Math.floor(Number(coupon.music_quantity) || 0)
    const credits = musicQuantity * STUDIO_MUSIC_CREDITS
    const price = Number(coupon.price) || 0
    const isFree = price <= 0
    const alreadyUsedByComposer = await composerAlreadyUsedCoupon(composer.composerId, coupon.id, isFree)

    // ----- CUPOM GRÁTIS: credita na hora -----
    if (isFree) {
      if (alreadyUsedByComposer) {
        return NextResponse.json({ errorCode: 'alreadyRedeemed' }, { status: 400 })
      }

      // Reserva atômica de 1 uso (impede passar do limite em acessos simultâneos).
      const { data: claimedCoupon, error: claimError } = await supabaseAdmin
        .from('studio_coupons')
        .update({ used_count: Number(coupon.used_count) + 1, updated_at: new Date().toISOString() })
        .eq('id', coupon.id)
        .lt('used_count', Number(coupon.max_uses))
        .select('*')
        .maybeSingle()

      if (claimError) throw claimError
      if (!claimedCoupon) {
        return NextResponse.json({ errorCode: 'usageLimit' }, { status: 400 })
      }

      try {
        await addStudioCreditTransaction({
          composerId: composer.composerId,
          action: 'manual_credit',
          amount: credits,
          description: `Cupom ${coupon.code}: ${musicQuantity} música(s) grátis`,
          metadata: {
            couponId: coupon.id,
            couponCode: coupon.code,
            musicQuantity,
            credits,
            source: 'coupon_free',
          },
        })
      } catch (creditError) {
        // desfaz a reserva se falhar ao creditar
        await supabaseAdmin
          .from('studio_coupons')
          .update({ used_count: Number(coupon.used_count), updated_at: new Date().toISOString() })
          .eq('id', coupon.id)
        throw creditError
      }

      return NextResponse.json({
        success: true,
        type: 'free',
        musicQuantity,
        credits,
      })
    }

    // ----- CUPOM PAGO: cria recarga e manda pro Mercado Pago -----
    if (alreadyUsedByComposer) {
      return NextResponse.json(
        { errorCode: 'alreadyUsedPaid' },
        { status: 400 }
      )
    }

    // Reaproveita a recarga pendente, inclusive as criadas pelo checkout antigo.
    // Não gera várias intenções para o mesmo cupom e permite retomar o pagamento.
    const { data: pendingTopups, error: pendingError } = await supabaseAdmin
      .from('studio_credit_topups')
      .select('id,amount,currency,music_quantity,credits,metadata,payment_id')
      .eq('composer_id', composer.composerId)
      .eq('status', 'pending')
      .contains('metadata', { couponId: coupon.id })
      .order('created_at', { ascending: false })
      .limit(1)
    if (pendingError) throw pendingError
    const pendingTopup = pendingTopups?.[0]
    if (pendingTopup) {
      if (Math.abs(Number(pendingTopup.amount) - price) > 0.01 ||
          pendingTopup.currency !== 'BRL' ||
          Number(pendingTopup.music_quantity) !== musicQuantity ||
          Number(pendingTopup.credits) !== credits ||
          pendingTopup.metadata?.couponCode !== coupon.code) {
        return NextResponse.json({ errorCode: 'paymentUnavailable' }, { status: 409 })
      }
      if (pendingTopup.payment_id) {
        return NextResponse.json({ errorCode: 'paymentPending' }, { status: 409 })
      }
      return NextResponse.json({
        success: true, type: 'paid', resumed: true,
        topupId: pendingTopup.id, musicQuantity,
        amount: price,
      })
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ errorCode: 'paymentUnavailable' }, { status: 500 })
    }

    const { data: composerData } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('email, name')
      .eq('id', composer.composerId)
      .maybeSingle()

    const packageName = `Cupom ${coupon.code} - ${musicQuantity} músicas`
    const reference = `studio-topup:${composer.composerId}:coupon-${coupon.code}:${Date.now()}`

    const { data: topup, error: topupError } = await supabaseAdmin
      .from('studio_credit_topups')
      .insert({
        composer_id: composer.composerId,
        package_slug: `coupon-${coupon.code}`,
        music_quantity: musicQuantity,
        credits,
        amount: Number(price.toFixed(2)),
        currency: 'BRL',
        status: 'pending',
        payment_gateway: 'mercadopago',
        external_reference: reference,
        month_key: studioMonthKey(),
        metadata: {
          package_name: packageName,
          source: 'coupon_paid',
          couponId: coupon.id,
          couponCode: coupon.code,
          composer_name: composerData?.name || null,
        },
      })
      .select('*')
      .single()

    if (topupError) throw topupError

    return NextResponse.json({
      success: true,
      type: 'paid',
      topupId: topup.id,
      musicQuantity,
      amount: Number(price.toFixed(2)),
      email: composerData?.email || null,
    })
  } catch (error: any) {
    console.error('[CUPOM] Erro ao resgatar:', error)
    return NextResponse.json({ errorCode: 'apply' }, { status: 500 })
  }
}
