import { NextRequest, NextResponse } from 'next/server'
import { preferenceClient } from '@/lib/mercadopago'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import {
  addStudioCreditTransaction,
  getSiteUrl,
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
      return NextResponse.json({ error: 'Cupom não encontrado.' }, { status: 404 })
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
    const credits = musicQuantity * STUDIO_MUSIC_CREDITS
    const price = Number(coupon.price) || 0
    const isFree = price <= 0
    const alreadyUsedByComposer = await composerAlreadyUsedCoupon(composer.composerId, coupon.id, isFree)

    // ----- CUPOM GRÁTIS: credita na hora -----
    if (isFree) {
      if (alreadyUsedByComposer) {
        return NextResponse.json({ error: 'Você já usou este cupom.' }, { status: 400 })
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
        return NextResponse.json({ error: 'Este cupom já atingiu o limite de usos.' }, { status: 400 })
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
        message: `Cupom aplicado! Você ganhou ${musicQuantity} música(s).`,
      })
    }

    // ----- CUPOM PAGO: cria recarga e manda pro Mercado Pago -----
    if (alreadyUsedByComposer) {
      return NextResponse.json(
        { error: 'Você já usou este cupom ou já iniciou uma compra com ele.' },
        { status: 400 }
      )
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'Pagamento não está configurado no servidor.' }, { status: 500 })
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

    const baseUrl = getSiteUrl()
    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: `studio-coupon-${coupon.code}`,
            title: packageName,
            description: `${musicQuantity} músicas (${credits} créditos) - cupom ${coupon.code}`,
            quantity: 1,
            unit_price: Number(price.toFixed(2)),
            currency_id: 'BRL',
          },
        ],
        payer: { email: composerData?.email || undefined },
        back_urls: {
          success: `${baseUrl}/compositores/admin/studio-ia/recarga/sucesso?topup_id=${topup.id}`,
          failure: `${baseUrl}/compositores/admin/studio-ia/recarga/falha?topup_id=${topup.id}`,
          pending: `${baseUrl}/compositores/admin/studio-ia/recarga/pendente?topup_id=${topup.id}`,
        },
        auto_return: 'approved',
        external_reference: reference,
        notification_url: `${baseUrl}/api/compositores/pagamento/webhook`,
        statement_descriptor: 'DCC Music',
        metadata: {
          type: 'studio_topup',
          topup_id: topup.id,
          composer_id: composer.composerId,
          package_slug: `coupon-${coupon.code}`,
          credits,
          music_quantity: musicQuantity,
          coupon_id: coupon.id,
          coupon_code: coupon.code,
        },
        payment_methods: {
          excluded_payment_types: [],
          excluded_payment_methods: [],
          installments: 6,
        },
        binary_mode: false,
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        additional_info: `Cupom DCC Studio IA ${coupon.code} para ${composerData?.name || 'compositor'}`,
      },
    })

    await supabaseAdmin
      .from('studio_credit_topups')
      .update({ payment_preference_id: preference.id, updated_at: new Date().toISOString() })
      .eq('id', topup.id)

    return NextResponse.json({
      success: true,
      type: 'paid',
      topupId: topup.id,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      musicQuantity,
      amount: Number(price.toFixed(2)),
    })
  } catch (error: any) {
    console.error('[CUPOM] Erro ao resgatar:', error)
    return NextResponse.json({ error: error.message || 'Erro ao resgatar cupom' }, { status: 500 })
  }
}
