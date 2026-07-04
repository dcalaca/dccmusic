import { NextRequest, NextResponse } from 'next/server'
import { preferenceClient } from '@/lib/mercadopago'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getSiteUrl, studioMonthKey } from '@/lib/studio'
import { getStudioTopupQuote } from '@/lib/studio-topups'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMetaInitiateCheckoutEvent } from '@/lib/meta-conversions'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Mercado Pago não está configurado no servidor.' },
        { status: 500 }
      )
    }

    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const musicQuantity = Math.floor(Number(body.musicQuantity) || 0)
    if (musicQuantity <= 0) {
      return NextResponse.json({ error: 'Informe uma quantidade válida de músicas.' }, { status: 400 })
    }
    if (musicQuantity > 500) {
      return NextResponse.json({ error: 'A recarga avulsa permite no máximo 500 músicas por compra.' }, { status: 400 })
    }
    const quote = getStudioTopupQuote(musicQuantity)
    const packageName = `Recarga avulsa ${quote.musicQuantity} músicas`

    const { data: composerData } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('email, name')
      .eq('id', composer.composerId)
      .maybeSingle()

    const reference = `studio-topup:${composer.composerId}:${quote.musicQuantity}:${Date.now()}`
    const { data: topup, error: topupError } = await supabaseAdmin
      .from('studio_credit_topups')
      .insert({
        composer_id: composer.composerId,
        package_slug: `custom-${quote.musicQuantity}`,
        music_quantity: quote.musicQuantity,
        credits: quote.credits,
        amount: quote.totalPrice,
        currency: 'BRL',
        status: 'pending',
        payment_gateway: 'mercadopago',
        external_reference: reference,
        month_key: studioMonthKey(),
        metadata: {
          package_name: packageName,
          unit_price: quote.unitPrice,
          tier_label: quote.tierLabel,
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
            id: `studio-topup-${quote.musicQuantity}`,
            title: packageName,
            description: `${quote.musicQuantity} músicas avulsas (${quote.credits} créditos)`,
            quantity: 1,
            unit_price: quote.totalPrice,
            currency_id: 'BRL',
          },
        ],
        payer: {
          email: composerData?.email || undefined,
        },
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
          package_slug: `custom-${quote.musicQuantity}`,
          credits: quote.credits,
          music_quantity: quote.musicQuantity,
          unit_price: quote.unitPrice,
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
        additional_info: `Recarga avulsa DCC Studio IA para ${composerData?.name || 'compositor'}`,
      },
    })

    await supabaseAdmin
      .from('studio_credit_topups')
      .update({
        payment_preference_id: preference.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', topup.id)

    const metaInitiateCheckoutEventId = `initiate_checkout:${preference.id}`
    await sendMetaInitiateCheckoutEvent({
      request,
      eventId: metaInitiateCheckoutEventId,
      eventSourceUrl: request.headers.get('referer') || request.url,
      email: composerData?.email || null,
      externalId: composer.composerId,
      value: quote.totalPrice,
      currency: 'BRL',
      contentName: packageName,
      contentId: 'studio_topup',
      quantity: quote.musicQuantity,
    }).catch((metaError) => {
      console.error('[Studio IA] Erro ao enviar início de checkout para Meta:', metaError)
    })

    return NextResponse.json({
      success: true,
      topupId: topup.id,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      metaInitiateCheckoutEventId,
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro ao criar recarga avulsa:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao criar recarga avulsa' },
      { status: 500 }
    )
  }
}
