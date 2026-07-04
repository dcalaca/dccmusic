import { NextRequest, NextResponse } from 'next/server'
import * as db from '@/lib/db'
import { parseUserAgent } from '@/lib/user-agent-parser'
import { classifyClick, areRelated } from '@/lib/bot-detector'
import { getGeoLocation, maskIP } from '@/lib/geo-locator'

export async function GET(
  request: NextRequest,
  { params }: { params: { shortCode: string } }
) {
  try {
    const { shortCode } = params

    if (!shortCode) {
      return NextResponse.json(
        { error: 'Código do link não fornecido' },
        { status: 400 }
      )
    }

    // Buscar o link
    const link = await db.getTrackedLinkByShortCode(shortCode)

    if (!link) {
      return NextResponse.json(
        { error: 'Link não encontrado ou expirado' },
        { status: 404 }
      )
    }

    // Extrair informações do request para registrar o clique
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     request.ip ||
                     'unknown'
    
    const userAgent = request.headers.get('user-agent') || undefined
    const referer = request.headers.get('referer') || undefined
    const language = request.headers.get('accept-language')?.split(',')[0] || undefined
    const accept = request.headers.get('accept') || undefined
    const acceptEncoding = request.headers.get('accept-encoding') || undefined
    
    // Extrair query parameters da URL
    const url = new URL(request.url)
    const queryParams = url.search ? url.search.substring(1) : undefined

    // Parsear User Agent
    const parsedUA = parseUserAgent(userAgent)

    // Classificar o clique (BOT_PREVIEW, HUMAN_CLICK, UNKNOWN)
    const classification = classifyClick({
      userAgent,
      referer,
      accept,
      acceptLanguage: language,
      acceptEncoding,
      ipAddress,
    })

    // Buscar geolocalização (assíncrono, não bloquear)
    let geoLocation: Awaited<ReturnType<typeof getGeoLocation>> = null
    try {
      geoLocation = await getGeoLocation(ipAddress)
    } catch (error) {
      console.error('Erro ao buscar geolocalização:', error)
      // Continuar sem geolocalização
    }

    // Verificar se há preview relacionado (sequência preview -> clique humano)
    let relatedPreviewId: string | undefined = undefined
    if (classification.type === 'HUMAN_CLICK' && ipAddress && ipAddress !== 'unknown') {
      try {
        // Buscar previews recentes do mesmo IP (últimos 10 minutos)
        const { supabaseAdmin } = await import('@/lib/supabase')
        const { data: recentClicks } = await supabaseAdmin
          .from('dccmusic_link_clicks')
          .select('id, click_type, clicked_at, ip_address')
          .eq('link_id', link.id)
          .eq('ip_address', ipAddress)
          .eq('click_type', 'BOT_PREVIEW')
          .gte('clicked_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
          .order('clicked_at', { ascending: false })
          .limit(1)
        
        if (recentClicks && recentClicks.length > 0) {
          const preview = recentClicks[0]
          const currentClick = {
            ipAddress,
            clickedAt: new Date(),
            type: classification.type as 'HUMAN_CLICK',
          }
          const previewClick = {
            ipAddress: preview.ip_address,
            clickedAt: new Date(preview.clicked_at),
            type: 'BOT_PREVIEW' as const,
          }
          
          if (areRelated(previewClick, currentClick, 10)) {
            relatedPreviewId = preview.id
          }
        }
      } catch (error) {
        console.error('Erro ao verificar preview relacionado:', error)
        // Continuar sem relacionar
      }
    }

    // Mascarar IP para privacidade (LGPD)
    const ipMasked = ipAddress !== 'unknown' ? maskIP(ipAddress, 24) : undefined

    // Registrar o clique (não bloquear o redirecionamento se falhar)
    try {
      await db.registerLinkClick(link.id, {
        ipAddress,
        userAgent,
        referer,
        language,
        queryParams,
        browser: parsedUA?.browser,
        browserVersion: parsedUA?.browserVersion,
        operatingSystem: parsedUA?.os,
        osVersion: parsedUA?.osVersion,
        deviceType: parsedUA?.device,
        // Classificação
        clickType: classification.type,
        classificationReason: classification.reason,
        inferredSource: classification.inferredSource,
        relatedPreviewId,
        // Geolocalização
        country: geoLocation?.country,
        city: geoLocation?.city,
        region: geoLocation?.region,
        asn: geoLocation?.asn,
        isp: geoLocation?.isp,
        latitude: geoLocation?.latitude,
        longitude: geoLocation?.longitude,
        ipMasked,
      })
    } catch (error) {
      console.error('Erro ao registrar clique (continuando redirecionamento):', error)
      // Continuar mesmo se o registro falhar
    }

    // Redirecionar para a URL de destino
    return NextResponse.redirect(link.destinationUrl, 302)
  } catch (error: any) {
    console.error('Erro ao processar link rastreável:', error)
    return NextResponse.json(
      { error: 'Erro ao processar link', details: error.message },
      { status: 500 }
    )
  }
}
