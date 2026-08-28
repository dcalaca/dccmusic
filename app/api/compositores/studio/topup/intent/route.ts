import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getStudioTopupQuote } from '@/lib/studio-topups'
import { studioMonthKey } from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'
import { buildMetaCapiMetadata, sendMetaInitiateCheckoutEvent } from '@/lib/meta-conversions'
import { isStripeConfigured } from '@/lib/stripe'
import { COUNTRY_COOKIE, normalizeCountry } from '@/lib/localization'
import { reportPaymentFailure } from '@/lib/payment-failure-alert'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const requestCountry = normalizeCountry(
      request.cookies.get(COUNTRY_COOKIE)?.value ||
      request.headers.get('x-dcc-country') ||
      request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cf-ipcountry')
    )
    const stripeRequested = requestCountry !== 'BR' || body?.provider === 'stripe'
    const provider = stripeRequested && isStripeConfigured()
      ? 'stripe'
      : process.env.MERCADOPAGO_ACCESS_TOKEN
        ? 'mercadopago'
        : isStripeConfigured()
          ? 'stripe'
          : null

    if (!provider) {
      await reportPaymentFailure({
        provider: 'checkout',
        stage: 'configuracao_recarga',
        error: 'Nenhum provedor de pagamento está configurado',
        requestUrl: request.url,
      })
      return NextResponse.json({ error: 'Nenhum meio de pagamento está configurado no servidor.' }, { status: 500 })
    }

    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const musicQuantity = Math.floor(Number(body.musicQuantity) || 0)

    if (musicQuantity <= 0) {
      return NextResponse.json({ error: 'Informe uma quantidade válida de músicas.' }, { status: 400 })
    }

    if (musicQuantity > 500) {
      return NextResponse.json({ error: 'A recarga avulsa permite no máximo 500 músicas por compra.' }, { status: 400 })
    }

    const quote = getStudioTopupQuote(musicQuantity, requestCountry)
    const packageName = `Recarga avulsa ${quote.musicQuantity} músicas`

    const { data: composerData } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('email, name')
      .eq('id', composer.composerId)
      .maybeSingle()

    const reference = `studio-topup:${composer.composerId}:${quote.musicQuantity}:${Date.now()}`
    const metaCapi = buildMetaCapiMetadata(request, {
      email: composerData?.email || null,
      externalId: composer.composerId,
      eventSourceUrl: request.headers.get('referer') || request.url,
    })
    const { data: topup, error: topupError } = await supabaseAdmin
      .from('studio_credit_topups')
      .insert({
        composer_id: composer.composerId,
        package_slug: `custom-${quote.musicQuantity}`,
        music_quantity: quote.musicQuantity,
        credits: quote.credits,
        amount: quote.totalPrice,
        currency: quote.currency,
        status: 'pending',
        payment_gateway: provider,
        external_reference: reference,
        month_key: studioMonthKey(),
        metadata: {
          package_name: packageName,
          unit_price: quote.unitPrice,
          tier_label: quote.tierLabel,
          composer_name: composerData?.name || null,
          checkout_type: provider === 'stripe' ? 'stripe_embedded' : 'payment_brick',
          customer_country: requestCountry,
          customer_locale: requestCountry === 'PY'
            ? 'es-PY'
            : requestCountry === 'CO'
              ? 'es-CO'
              : requestCountry === 'PT'
                ? 'pt-PT'
                : requestCountry === 'MX'
                  ? 'es-MX'
                  : 'pt-BR',
          meta_capi: metaCapi,
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
      currency: quote.currency,
      contentName: packageName,
      contentId: 'studio_topup',
      quantity: quote.musicQuantity,
    }).catch((metaError) => {
      console.error('[Studio IA] Erro ao enviar início de checkout para Meta:', metaError)
    })

    return NextResponse.json({
      success: true,
      provider,
      publicKey: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || null,
      stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
      topupId: topup.id,
      externalReference: reference,
      amount: quote.totalPrice,
      currency: quote.currency,
      credits: quote.credits,
      musicQuantity: quote.musicQuantity,
      unitPrice: quote.unitPrice,
      tierLabel: quote.tierLabel,
      packageName,
      composerEmail: composerData?.email || null,
      metaInitiateCheckoutEventId,
      country: requestCountry,
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro ao criar intenção de recarga:', error)
    await reportPaymentFailure({
      provider: 'checkout',
      stage: 'preparacao_recarga',
      error,
      requestUrl: request.url,
      composerId: getComposerFromRequest(request)?.composerId,
    })
    return NextResponse.json(
      { error: error.message || 'Erro ao preparar recarga avulsa' },
      { status: 500 }
    )
  }
}
