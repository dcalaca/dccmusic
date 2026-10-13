import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const REFERRAL_COOKIE = 'dcc_referral_visit'
export const REFERRAL_VISITOR_COOKIE = 'dcc_referral_visitor'
export const REFERRAL_WINDOW_SECONDS = 30 * 24 * 60 * 60
export const REFERRER_CREDITS = 10
export const REFERRED_CREDITS = 5
export const REFERRAL_MONTHLY_LIMIT = 5
export const isReferralUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

// The browser carries only an opaque visit ID. The server resolves its owner;
// signup JSON and marketing attribution cannot select or replace a referrer.
export async function attributeNewComposerReferral(request: NextRequest, composerId: string) {
  const visitId = request.cookies.get(REFERRAL_COOKIE)?.value || ''
  if (!isReferralUuid(visitId)) return
  const { error } = await supabaseAdmin.rpc('dcc_attribute_referral', { p_composer_id: composerId, p_visit_id: visitId })
  if (error) throw error
}
