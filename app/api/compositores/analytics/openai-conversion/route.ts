import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PIXEL_ID = '7P9kR7YDnZBmFo76pXpiAq'
const EVENT_URL = 'https://bzr.openai.com/v1/events'

/**
 * Only sends purchases verified in the database for the authenticated composer.
 * The browser and server share exactly the same event ID for OpenAI deduplication.
 * Does not affect checkout, Google Ads or Meta CAPI.
 */
export async function POST(request: NextRequest) {
  const composer = getComposerFromRequest(request)
  if (!composer) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const apiKey = process.env.OPENAI_CONVERSIONS_API_KEY?.trim()
  if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  let body: { kind?: string; id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const id = String(body.id || '').trim()
  if (!id || id.length > 128) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  let eventId: string
  let value: number
  let currency: string
  let occurredAt: string | null = null
  let sourceUrl: string

  if (body.kind === 'plan') {
    const { data, error } = await supabaseAdmin.from('dccmusic_payments')
      .select('id,amount,currency,status,paid_at')
      .eq('id', id).eq('composer_id', composer.composerId)
      .eq('status', 'paid').not('paid_at', 'is', null).maybeSingle()
    if (error) return NextResponse.json({ error: 'verification_unavailable' }, { status: 503 })
    if (!data) return NextResponse.json({ error: 'not_paid' }, { status: 404 })
    eventId = 'dcc_order_plan_' + data.id
    value = Number(data.amount)
    currency = String(data.currency || '').toUpperCase()
    occurredAt = data.paid_at
    sourceUrl = 'https://www.dccmusic.online/compositores/pagamento/sucesso'
  } else if (body.kind === 'topup') {
    const { data, error } = await supabaseAdmin.from('studio_credit_topups')
      .select('id,amount,currency,status,updated_at')
      .eq('id', id).eq('composer_id', composer.composerId)
      .eq('status', 'paid').maybeSingle()
    if (error) return NextResponse.json({ error: 'verification_unavailable' }, { status: 503 })
    if (!data) return NextResponse.json({ error: 'not_paid' }, { status: 404 })
    eventId = 'dcc_order_topup_' + data.id
    value = Number(data.amount)
    currency = String(data.currency || '').toUpperCase()
    occurredAt = data.updated_at
    sourceUrl = 'https://www.dccmusic.online/compositores/admin/studio-ia/recarga/sucesso'
  } else {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 })
  }

  if (!Number.isFinite(value) || value <= 0 || !/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ error: 'invalid_payment' }, { status: 422 })
  }

  try {
    // Preserve the Pixel's opaque references exactly as received in first-party cookies.
    const readRawCookie = (name: string) => {
      const entry = (request.headers.get('cookie') || '').split(';')
        .map((part) => part.trimStart()).find((part) => part.startsWith(name + '='))
      return entry ? entry.slice(name.length + 1) : undefined
    }
    const oppref = readRawCookie('__oppref')
    const obref = readRawCookie('__obref')
    const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')
    const email = String(composer.email || '').trim().toLowerCase()
    const userAgent = request.headers.get('user-agent')

    const parsedTime = occurredAt ? Date.parse(occurredAt) : NaN
    const timestamp_ms = Number.isFinite(parsedTime) ? parsedTime : Date.now()
    const event = {
      id: eventId,
      type: 'order_created',
      timestamp_ms,
      action_source: 'web',
      source_url: sourceUrl,
      ...(oppref ? { oppref } : {}),
      user: {
        external_ids_sha256: [hash(String(composer.composerId).trim())],
        ...(email ? { emails_sha256: [hash(email)] } : {}),
        ...(userAgent ? { user_agent: userAgent } : {}),
        ...(obref ? { obref } : {}),
      },
      data: { type: 'contents', amount: Math.round(value * 100), currency },
    }

    const response = await fetch(EVENT_URL + '?pid=' + encodeURIComponent(PIXEL_ID), {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [event] }),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!response.ok) {
      console.error('[OpenAI CAPI] rejected purchase event', response.status, eventId)
      return NextResponse.json({ error: 'provider_rejected' }, { status: 502 })
    }
    return NextResponse.json({ sent: true, eventId })
  } catch {
    return NextResponse.json({ error: 'provider_unavailable' }, { status: 502 })
  }
}
