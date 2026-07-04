import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET - Buscar cliques com filtros para relatório
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    
    // Filtros
    const linkId = searchParams.get('linkId')
    const clickType = searchParams.get('clickType') // BOT_PREVIEW, HUMAN_CLICK, UNKNOWN
    const deviceType = searchParams.get('deviceType')
    const browser = searchParams.get('browser')
    const inferredSource = searchParams.get('inferredSource')
    const country = searchParams.get('country')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '10000')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Construir query
    let query = supabaseAdmin
      .from('dccmusic_link_clicks')
      .select(`
        *,
        dccmusic_tracked_links (
          id,
          title,
          short_code,
          destination_url
        )
      `)
      .order('clicked_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Aplicar filtros
    if (linkId) {
      query = query.eq('link_id', linkId)
    }
    if (clickType) {
      query = query.eq('click_type', clickType)
    }
    if (deviceType) {
      query = query.eq('device_type', deviceType)
    }
    if (browser) {
      query = query.eq('browser', browser)
    }
    if (inferredSource) {
      query = query.eq('inferred_source', inferredSource)
    }
    if (country) {
      query = query.eq('country', country)
    }
    if (startDate) {
      query = query.gte('clicked_at', startDate)
    }
    if (endDate) {
      query = query.lte('clicked_at', endDate)
    }

    const { data: clicks, error } = await query

    if (error) {
      console.error('Erro ao buscar cliques:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar cliques', details: error.message },
        { status: 500 }
      )
    }

    // Buscar contagem total (sem paginação)
    let countQuery = supabaseAdmin
      .from('dccmusic_link_clicks')
      .select('*', { count: 'exact', head: true })

    if (linkId) countQuery = countQuery.eq('link_id', linkId)
    if (clickType) countQuery = countQuery.eq('click_type', clickType)
    if (deviceType) countQuery = countQuery.eq('device_type', deviceType)
    if (browser) countQuery = countQuery.eq('browser', browser)
    if (inferredSource) countQuery = countQuery.eq('inferred_source', inferredSource)
    if (country) countQuery = countQuery.eq('country', country)
    if (startDate) countQuery = countQuery.gte('clicked_at', startDate)
    if (endDate) countQuery = countQuery.lte('clicked_at', endDate)

    const { count } = await countQuery

    // Mapear dados
    const mappedClicks = (clicks || []).map((click: any) => ({
      id: click.id,
      linkId: click.link_id,
      linkTitle: click.dccmusic_tracked_links?.title || 'N/A',
      linkShortCode: click.dccmusic_tracked_links?.short_code || 'N/A',
      linkDestination: click.dccmusic_tracked_links?.destination_url || 'N/A',
      clickedAt: click.clicked_at,
      ipAddress: click.ip_address,
      ipMasked: click.ip_masked,
      userAgent: click.user_agent,
      referer: click.referer,
      clickType: click.click_type || 'UNKNOWN',
      classificationReason: click.classification_reason,
      inferredSource: click.inferred_source,
      deviceType: click.device_type,
      browser: click.browser,
      browserVersion: click.browser_version,
      operatingSystem: click.operating_system,
      osVersion: click.os_version,
      language: click.language,
      country: click.country,
      city: click.city,
      region: click.region,
      asn: click.asn,
      isp: click.isp,
      latitude: click.latitude,
      longitude: click.longitude,
      queryParams: click.query_params,
      relatedPreviewId: click.related_preview_id,
    }))

    return NextResponse.json({
      clicks: mappedClicks,
      total: count || 0,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error('Erro ao buscar cliques para relatório:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar cliques', details: error.message },
      { status: 500 }
    )
  }
}
