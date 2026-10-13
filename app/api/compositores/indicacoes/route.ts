import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest, resolveComposerToken } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import { referralBounds, referralDateRange, REFERRAL_PAGE_SIZE } from '@/lib/referral-dates'
import { REFERRED_CREDITS, REFERRER_CREDITS, REFERRAL_MONTHLY_LIMIT } from '@/lib/referrals'

export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    const token = getComposerFromRequest(request)
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers })
    const composer = await resolveComposerToken(token)
    if (!composer) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers })
    const defaults = referralDateRange('month')
    let bounds
    try { bounds = referralBounds(request.nextUrl.searchParams.get('start') || defaults.start, request.nextUrl.searchParams.get('end') || defaults.end) }
    catch { return NextResponse.json({ error: 'invalid_dates' }, { status: 400, headers }) }
    const rawPage = request.nextUrl.searchParams.get('page') || '1'
    if (!/^\d{1,8}$/.test(rawPage) || Number(rawPage) < 1) return NextResponse.json({ error: 'invalid_page' }, { status: 400, headers })
    const { data, error } = await supabaseAdmin.rpc('dcc_referral_dashboard', { p_composer_id: composer.composerId, p_from: bounds.from, p_to: bounds.to, p_page: Number(rawPage), p_page_size: REFERRAL_PAGE_SIZE })
    if (error) throw error
    return NextResponse.json({ ...data, link: `https://www.dccmusic.online/i/${data.code}`, rules: { referrerCredits: REFERRER_CREDITS, referredCredits: REFERRED_CREDITS, monthlyLimit: REFERRAL_MONTHLY_LIMIT } }, { headers })
  } catch (error) {
    console.error('[REFERRALS] Dashboard failed', error)
    return NextResponse.json({ error: 'load' }, { status: 500, headers })
  }
}
