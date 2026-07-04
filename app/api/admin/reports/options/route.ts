import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET - Buscar opções para filtros
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    // Buscar links para filtro
    const { data: links } = await supabaseAdmin
      .from('dccmusic_tracked_links')
      .select('id, title, short_code')
      .order('title')

    // Buscar valores únicos para filtros
    const [
      { data: clickTypes },
      { data: deviceTypes },
      { data: browsers },
      { data: sources },
      { data: countries },
    ] = await Promise.all([
      supabaseAdmin
        .from('dccmusic_link_clicks')
        .select('click_type')
        .not('click_type', 'is', null),
      supabaseAdmin
        .from('dccmusic_link_clicks')
        .select('device_type')
        .not('device_type', 'is', null),
      supabaseAdmin
        .from('dccmusic_link_clicks')
        .select('browser')
        .not('browser', 'is', null),
      supabaseAdmin
        .from('dccmusic_link_clicks')
        .select('inferred_source')
        .not('inferred_source', 'is', null),
      supabaseAdmin
        .from('dccmusic_link_clicks')
        .select('country')
        .not('country', 'is', null),
    ])

    // Extrair valores únicos
    const uniqueClickTypes = Array.from(new Set((clickTypes || []).map((c: any) => c.click_type).filter(Boolean)))
    const uniqueDeviceTypes = Array.from(new Set((deviceTypes || []).map((d: any) => d.device_type).filter(Boolean)))
    const uniqueBrowsers = Array.from(new Set((browsers || []).map((b: any) => b.browser).filter(Boolean)))
    const uniqueSources = Array.from(new Set((sources || []).map((s: any) => s.inferred_source).filter(Boolean)))
    const uniqueCountries = Array.from(new Set((countries || []).map((c: any) => c.country).filter(Boolean)))

    return NextResponse.json({
      links: links || [],
      clickTypes: uniqueClickTypes,
      deviceTypes: uniqueDeviceTypes,
      browsers: uniqueBrowsers,
      sources: uniqueSources,
      countries: uniqueCountries.sort(),
    })
  } catch (error: any) {
    console.error('Erro ao buscar opções:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar opções', details: error.message },
      { status: 500 }
    )
  }
}
