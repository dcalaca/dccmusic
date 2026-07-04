import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import * as db from '@/lib/db'
import { getComposerFromRequest } from '@/lib/composer-middleware'

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
  options: { timeout: 5000 },
})

const preferenceClient = new Preference(client)

function getReturnUrls(contentType: 'music' | 'video', contentId: string) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://dccmusic.online'
  return {
    success: `${baseUrl}/compositores/featured/sucesso?contentType=${contentType}&contentId=${contentId}`,
    failure: `${baseUrl}/compositores/featured/falha?contentType=${contentType}&contentId=${contentId}`,
    pending: `${baseUrl}/compositores/featured/pendente?contentType=${contentType}&contentId=${contentId}`,
  }
}

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { contentType, contentId } = body

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: 'contentType e contentId são obrigatórios' },
        { status: 400 }
      )
    }

    if (contentType !== 'music' && contentType !== 'video') {
      return NextResponse.json(
        { error: 'contentType deve ser "music" ou "video"' },
        { status: 400 }
      )
    }

    // Verificar se o conteúdo existe e pertence ao compositor
    let content: any = null
    if (contentType === 'music') {
      content = await db.getMusicById(contentId)
    } else {
      content = await db.getVideoById(contentId)
    }

    if (!content) {
      return NextResponse.json(
        { error: 'Conteúdo não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o compositor tem permissão (se o conteúdo tem o compositor associado)
    // Por enquanto, vamos permitir qualquer compositor premium

    // Verificar se já tem destaque ativo
    const hasActive = await db.hasActiveFeatured(contentType, contentId)
    if (hasActive) {
      return NextResponse.json(
        { error: 'Este conteúdo já possui destaque ativo' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'https://dccmusic.online'
    const returnUrls = getReturnUrls(contentType, contentId)

    // Criar preferência de pagamento
    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: `${contentType}-${contentId}`,
            title: `Destaque - ${content.title}`,
            description: `Destaque por 10 dias para ${contentType === 'music' ? 'música' : 'vídeo'}: ${content.title}`,
            quantity: 1,
            unit_price: 9.90,
            currency_id: 'BRL',
          },
        ],
        payer: {
          email: composer.email || '',
        },
        back_urls: returnUrls,
        auto_return: 'approved',
        notification_url: `${baseUrl}/api/compositores/featured/webhook`,
        statement_descriptor: 'DCC Music Destaque',
        metadata: {
          composer_id: composer.composerId,
          composer_name: composer.name,
          content_type: contentType,
          content_id: contentId,
          content_title: content.title,
        },
        payment_methods: {
          excluded_payment_types: [],
          excluded_payment_methods: [],
          installments: 1, // Apenas à vista para destaque
        },
        binary_mode: true, // Apenas pagamentos aprovados
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
      },
    })

    // Criar registro de destaque pago
    const featuredPayment = await db.createFeaturedPayment(
      contentType,
      contentId,
      composer.composerId,
      preference.id!
    )

    return NextResponse.json({
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      featuredPaymentId: featuredPayment.id,
    })
  } catch (error: any) {
    console.error('[FEATURED PREFERENCE] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao criar preferência de pagamento' },
      { status: 500 }
    )
  }
}
