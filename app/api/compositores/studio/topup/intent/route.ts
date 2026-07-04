import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getStudioTopupQuote } from '@/lib/studio-topups'
import { studioMonthKey } from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMetaInitiateCheckoutEvent } from '@/lib/meta-conversions'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'Mercado Pago não está configurado no servidor.' }, { status: 500 })
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
          checkout_type: 'payment_brick',
        },
      })
      .select('*')
      .single()

    if (topupError) throw topupError

    const metaInitiateCheckoutEventId = `initiate_checkout:studio_topup:${topup.id}`
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
      publicKey: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || null,
      topupId: topup.id,
      externalReference: reference,
      amount: quote.totalPrice,
      currency: 'BRL',
      credits: quote.credits,
      musicQuantity: quote.musicQuantity,
      unitPrice: quote.unitPrice,
      tierLabel: quote.tierLabel,
      packageName,
      composerEmail: composerData?.email || null,
      metaInitiateCheckoutEventId,
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro ao criar intenção de recarga:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao preparar recarga avulsa' },
      { status: 500 }
    )
  }
}
