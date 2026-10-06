import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest, resolveComposerToken } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Touch = {
  source?: string | null
  medium?: string | null
  campaign?: string | null
  content?: string | null
  term?: string | null
  partner_code?: string | null
  landing_path?: string | null
  referrer?: string | null
  click_ids?: Record<string, string>
  captured_at?: string | null
}

type Attribution = {
  first_touch?: Touch | null
  last_touch?: Touch | null
}

function cleanTouch(value: any): Touch | null {
  if (!value || typeof value !== 'object') return null

  const clickIds =
    value.click_ids && typeof value.click_ids === 'object'
      ? Object.fromEntries(
          Object.entries(value.click_ids)
            .filter(([, v]) => typeof v === 'string' && String(v).trim())
            .map(([k, v]) => [String(k).slice(0, 40), String(v).trim().slice(0, 500)])
        )
      : undefined

  const touch: Touch = {
    source: typeof value.source === 'string' ? value.source.slice(0, 120) : null,
    medium: typeof value.medium === 'string' ? value.medium.slice(0, 120) : null,
    campaign: typeof value.campaign === 'string' ? value.campaign.slice(0, 240) : null,
    content: typeof value.content === 'string' ? value.content.slice(0, 240) : null,
    term: typeof value.term === 'string' ? value.term.slice(0, 240) : null,
    partner_code: typeof value.partner_code === 'string' ? value.partner_code.slice(0, 120) : null,
    landing_path: typeof value.landing_path === 'string' ? value.landing_path.slice(0, 500) : null,
    referrer: typeof value.referrer === 'string' ? value.referrer.slice(0, 300) : null,
    click_ids: clickIds && Object.keys(clickIds).length ? clickIds : undefined,
    captured_at: typeof value.captured_at === 'string' ? value.captured_at : null,
  }

  if (!touch.source && !touch.medium && !touch.campaign && !touch.partner_code && !touch.click_ids) {
    return null
  }

  return touch
}

function normalizeAttribution(value: any): Attribution | null {
  if (!value || typeof value !== 'object') return null
  const first = cleanTouch(value.first_touch)
  const last = cleanTouch(value.last_touch)
  if (!first && !last) return null
  return { first_touch: first, last_touch: last }
}

function mergeAttribution(existing: any, incoming: Attribution): Attribution {
  const current = normalizeAttribution(existing)
  return {
    first_touch: current?.first_touch || incoming.first_touch || incoming.last_touch || null,
    last_touch: incoming.last_touch || current?.last_touch || incoming.first_touch || current?.first_touch || null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const tokenComposer = getComposerFromRequest(request)
    if (!tokenComposer) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const composer = await resolveComposerToken(tokenComposer)
    if (!composer) {
      return NextResponse.json({ error: 'sessionExpired' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const incoming = normalizeAttribution(body?.attribution)
    if (!incoming) {
      return NextResponse.json({ error: 'invalidAttribution' }, { status: 400 })
    }

    const { data: current, error: currentError } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('marketing_attribution')
      .eq('id', composer.composerId)
      .maybeSingle()

    if (currentError) throw currentError

    const merged = mergeAttribution(current?.marketing_attribution, incoming)

    const { error: updateError } = await supabaseAdmin
      .from('dccmusic_composers')
      .update({
        marketing_attribution: merged,
        updated_at: new Date().toISOString(),
      })
      .eq('id', composer.composerId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[ATTRIBUTION] Erro ao salvar atribuição:', error?.message || error)
    return NextResponse.json({ error: 'saveFailed' }, { status: 500 })
  }
}
