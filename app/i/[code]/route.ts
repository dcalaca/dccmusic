import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { REFERRAL_COOKIE, REFERRAL_VISITOR_COOKIE, REFERRAL_WINDOW_SECONDS, isReferralUuid } from '@/lib/referrals'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  // Keep ad click IDs and existing UTM values intact, including through redirects.
  const destination = new URL('/studio-ia', request.url)
  request.nextUrl.searchParams.forEach((value, key) => destination.searchParams.append(key, value))
  const response = NextResponse.redirect(destination, 302)
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  if (!/^[a-f0-9]{16}$/.test(params.code)) return response
  // Link previews and crawlers do not count as people clicking.
  if (/bot|crawler|spider|facebookexternalhit|whatsapp|telegrambot|slackbot|preview/i.test(request.headers.get('user-agent') || '') || request.headers.get('purpose') === 'prefetch' || request.headers.get('sec-purpose')?.includes('prefetch')) return response
  try {
    const { data: link, error: linkError } = await supabaseAdmin.from('dcc_referral_links').select('composer_id').eq('code', params.code).maybeSingle()
    if (linkError) throw linkError
    if (!link) return response
    const existingVisitor = request.cookies.get(REFERRAL_VISITOR_COOKIE)?.value || ''
    const visitorId = isReferralUuid(existingVisitor) ? existingVisitor : randomUUID()
    const bucket = new Date(Math.floor(Date.now() / 1_800_000) * 1_800_000).toISOString()
    const { data: visit, error } = await supabaseAdmin.from('dcc_referral_visits').upsert({ referrer_id: link.composer_id, visitor_id: visitorId, bucket }, { onConflict: 'referrer_id,visitor_id,bucket', ignoreDuplicates: true }).select('id').maybeSingle()
    if (error) throw error
    let visitId = visit?.id
    if (!visitId) {
      const { data, error: lookupError } = await supabaseAdmin.from('dcc_referral_visits').select('id').eq('referrer_id', link.composer_id).eq('visitor_id', visitorId).eq('bucket', bucket).single()
      if (lookupError) throw lookupError
      visitId = data.id
    }
    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: REFERRAL_WINDOW_SECONDS }
    response.cookies.set(REFERRAL_VISITOR_COOKIE, visitorId, cookieOptions)
    // First valid referral wins for 30 days. A later link still counts its click.
    const previousId = request.cookies.get(REFERRAL_COOKIE)?.value || ''
    const { data: previous } = isReferralUuid(previousId)
      ? await supabaseAdmin.from('dcc_referral_visits').select('id').eq('id', previousId).gte('created_at', new Date(Date.now() - REFERRAL_WINDOW_SECONDS * 1000).toISOString()).maybeSingle()
      : { data: null }
    if (!previous) response.cookies.set(REFERRAL_COOKIE, visitId, cookieOptions)
  } catch (error) {
    console.error('[REFERRALS] Could not record click', error)
  }
  return response
}

export async function HEAD(request: NextRequest) {
  return NextResponse.redirect(new URL('/studio-ia', request.url), 302)
}
