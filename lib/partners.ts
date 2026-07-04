import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from './supabase'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export const PARTNER_COOKIE = 'dcc_partner_id'
export const PARTNER_EXPIRES_COOKIE = 'dcc_partner_expires_at'
export const PARTNER_SESSION_COOKIE = 'dcc_partner_session_id'

export const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 15
export const DEFAULT_CUSTOMER_LIFETIME_MONTHS = 6
export const DEFAULT_CPA_STUDIO_TOPUP_AMOUNT = 25
export const DEFAULT_CPA_SUBSCRIPTION_AMOUNT = 35
export const DEFAULT_COMMISSION_CAP_AMOUNT = 3000

export type TrackingEventType =
  | 'page_view'
  | 'scroll'
  | 'button_click'
  | 'signup_started'
  | 'signup'
  | 'checkout_started'
  | 'purchase'
  | 'studio_access'
  | 'music_generated'
  | 'mouse_movement'

export interface PartnerToken {
  partnerId: string
  email: string
  displayName: string
  requiresPasswordChange?: boolean
}

function normalizeCommissionModel(value: any) {
  return String(value || 'percentage') === 'cpa' ? 'cpa' : 'percentage'
}

function normalizeCommissionPaymentScope(value: any) {
  return String(value || 'lifetime') === 'first_purchase' ? 'first_purchase' : 'lifetime'
}

function isSubscriptionProduct(productType: string) {
  return ['composer_plan', 'plan', 'subscription', 'composer_subscription'].includes(String(productType || ''))
}

function isStudioTopupProduct(productType: string) {
  return ['studio_topup', 'music_topup', 'single_music'].includes(String(productType || ''))
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100
}

function calculateBasePartnerCommission(partner: any, input: { amount: number; productType: string }) {
  const model = normalizeCommissionModel(partner?.commission_model)
  const amount = Number(input.amount) || 0

  if (model === 'cpa') {
    if (isStudioTopupProduct(input.productType)) {
      return roundMoney(Number(partner?.cpa_studio_topup_amount) || DEFAULT_CPA_STUDIO_TOPUP_AMOUNT)
    }

    if (isSubscriptionProduct(input.productType)) {
      return roundMoney(Number(partner?.cpa_subscription_amount) || DEFAULT_CPA_SUBSCRIPTION_AMOUNT)
    }

    return 0
  }

  return roundMoney(amount * ((Number(partner?.commission_percentage) || 0) / 100))
}

async function applyPartnerCommissionCap(partner: any, purchaseId: string, baseCommission: number) {
  const capAmount = Number(partner?.commission_cap_amount) || 0
  if (capAmount <= 0) {
    return {
      commissionAmount: baseCommission,
      capped: false,
      capAmount: null as number | null,
      paidBefore: null as number | null,
      remainingBefore: null as number | null,
    }
  }

  const { data, error } = await supabaseAdmin
    .from('partner_commissions')
    .select('commission_amount')
    .eq('partner_id', partner.id)
    .in('status', ['approved', 'paid'])
    .neq('purchase_id', purchaseId)

  if (error) throw error

  const paidBefore = roundMoney((data || []).reduce((total: number, row: any) => (
    total + (Number(row.commission_amount) || 0)
  ), 0))
  const remainingBefore = Math.max(0, roundMoney(capAmount - paidBefore))
  const commissionAmount = roundMoney(Math.min(baseCommission, remainingBefore))

  return {
    commissionAmount,
    capped: commissionAmount < baseCommission,
    capAmount,
    paidBefore,
    remainingBefore,
  }
}

async function hasPreviousCommissionForComposer(input: {
  partnerId: string
  composerId: string
  purchaseId: string
}) {
  const { data, error } = await supabaseAdmin
    .from('partner_commissions')
    .select('id')
    .eq('partner_id', input.partnerId)
    .neq('purchase_id', input.purchaseId)
    .eq('metadata->>composer_id', input.composerId)
    .limit(1)

  if (error) throw error
  return Boolean(data?.length)
}

async function resolvePartnerCommissionAmount(partner: any, input: {
  composerId: string
  purchaseId: string
  amount: number
  productType: string
}) {
  const paymentScope = normalizeCommissionPaymentScope(partner?.commission_payment_scope)
  const baseCommissionAmount = calculateBasePartnerCommission(partner, {
    amount: input.amount,
    productType: input.productType,
  })

  if (paymentScope === 'first_purchase') {
    const alreadyCommissioned = await hasPreviousCommissionForComposer({
      partnerId: partner.id,
      composerId: input.composerId,
      purchaseId: input.purchaseId,
    })

    if (alreadyCommissioned) {
      return {
        commissionAmount: 0,
        baseCommissionAmount,
        paymentScope,
        skippedByPaymentScope: true,
        capAmount: null as number | null,
        paidBefore: null as number | null,
        remainingBefore: null as number | null,
        capped: false,
      }
    }
  }

  const capResult = await applyPartnerCommissionCap(partner, input.purchaseId, baseCommissionAmount)
  return {
    ...capResult,
    baseCommissionAmount,
    paymentScope,
    skippedByPaymentScope: false,
  }
}

export function signPartnerToken(input: PartnerToken) {
  return jwt.sign(input, JWT_SECRET, { expiresIn: '30d' })
}

export function verifyPartnerToken(token: string): PartnerToken | null {
  try {
    return jwt.verify(token, JWT_SECRET) as PartnerToken
  } catch {
    return null
  }
}

export function getPartnerFromRequest(request: NextRequest | Request): PartnerToken | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return verifyPartnerToken(authHeader.substring(7))
}

export function isPartnerSchemaMissing(error: any) {
  const message = String(error?.message || error?.details || '')
  return (
    error?.code === 'PGRST205' ||
    error?.code === 'PGRST204' ||
    error?.code === '42P01' ||
    error?.code === '42703' ||
    message.includes('partners') ||
    message.includes('tracking_sessions') ||
    message.includes('tracking_events') ||
    message.includes('partner_id') ||
    message.includes('email') ||
    message.includes('password_hash') ||
    message.includes('requires_password_change') ||
    message.includes('customer_lifetime_months') ||
    message.includes('commission_model') ||
    message.includes('cpa_studio_topup_amount') ||
    message.includes('cpa_subscription_amount') ||
    message.includes('commission_cap_amount') ||
    message.includes('partner_lifetime_expires_at') ||
    message.includes('commission_payment_scope') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  )
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

function addMonths(months: number) {
  const date = new Date()
  date.setMonth(date.getMonth() + months)
  return date
}

export function getClientIp(request: NextRequest | Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
}

export function getPartnerSessionId(request: NextRequest) {
  return request.cookies.get(PARTNER_SESSION_COOKIE)?.value || randomUUID()
}

export function setPartnerCookies(response: NextResponse, input: {
  partnerId: string
  expiresAt: Date
  sessionId: string
}) {
  const maxAge = Math.max(60, Math.floor((input.expiresAt.getTime() - Date.now()) / 1000))

  response.cookies.set(PARTNER_COOKIE, input.partnerId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  })

  response.cookies.set(PARTNER_EXPIRES_COOKIE, input.expiresAt.toISOString(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  })

  response.cookies.set(PARTNER_SESSION_COOKIE, input.sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  })
}

export function hasValidPartnerCookie(request: NextRequest) {
  const partnerId = request.cookies.get(PARTNER_COOKIE)?.value
  const expiresAt = request.cookies.get(PARTNER_EXPIRES_COOKIE)?.value
  if (!partnerId || !expiresAt) return false
  return new Date(expiresAt).getTime() > Date.now()
}

export async function findPartnerByCode(partnerCode: string) {
  const code = String(partnerCode || '').trim()
  if (!code) return null

  const { data, error } = await supabaseAdmin
    .from('partners')
    .select('*')
    .eq('partner_code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function recordPartnerEvent(input: {
  sessionId: string
  partnerId?: string | null
  userId?: string | null
  eventType: TrackingEventType
  metadata?: Record<string, any>
}) {
  const { error } = await supabaseAdmin.from('tracking_events').insert({
    session_id: input.sessionId,
    partner_id: input.partnerId || null,
    user_id: input.userId || null,
    event_type: input.eventType,
    metadata: input.metadata || {},
  })

  if (error) throw error
}

export async function upsertPartnerSession(input: {
  sessionId: string
  partnerId?: string | null
  linkId?: string | null
  ip?: string | null
  userAgent?: string | null
  scoreDelta?: number
}) {
  const now = new Date().toISOString()
  const scoreDelta = Number(input.scoreDelta) || 0

  const { data: existing } = await supabaseAdmin
    .from('tracking_sessions')
    .select('id, human_score')
    .eq('session_id', input.sessionId)
    .maybeSingle()

  const humanScore = Math.min(100, Math.max(0, (Number(existing?.human_score) || 0) + scoreDelta))

  const payload = {
    session_id: input.sessionId,
    partner_id: input.partnerId || null,
    link_id: input.linkId || null,
    ip: input.ip && input.ip !== 'unknown' ? input.ip : null,
    user_agent: input.userAgent || null,
    human_score: humanScore,
    is_human: humanScore >= 60,
    last_activity_at: now,
  }

  const { error } = await supabaseAdmin
    .from('tracking_sessions')
    .upsert(payload, { onConflict: 'session_id' })

  if (error) throw error
}

export function scoreForEvent(eventType: TrackingEventType) {
  if (eventType === 'mouse_movement') return 10
  if (eventType === 'scroll') return 10
  if (eventType === 'button_click') return 20
  if (eventType === 'signup_started') return 20
  if (eventType === 'signup') return 50
  if (eventType === 'purchase') return 50
  return 0
}

export async function applyComposerPartnerAttribution(input: {
  composerId: string
  partnerCode?: string | null
  sessionId?: string | null
}) {
  if (!input.partnerCode) return { attributed: false, reason: 'no_partner_code' }

  try {
    const partner = await findPartnerByCode(input.partnerCode)
    if (!partner) return { attributed: false, reason: 'partner_not_found' }

    const { data: composer, error: composerError } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, partner_id, partner_expires_at')
      .eq('id', input.composerId)
      .maybeSingle()

    if (composerError) throw composerError
    if (!composer) return { attributed: false, reason: 'composer_not_found' }

    if (composer.partner_id && composer.partner_expires_at && new Date(composer.partner_expires_at).getTime() > Date.now()) {
      return { attributed: false, reason: 'first_click_active' }
    }

    const expiresAt = addDays(Number(partner.attribution_window_days) || DEFAULT_ATTRIBUTION_WINDOW_DAYS)
    const lifetimeExpiresAt = addMonths(Number(partner.customer_lifetime_months) || DEFAULT_CUSTOMER_LIFETIME_MONTHS)
    const attributedAt = new Date().toISOString()

    const { error: updateError } = await supabaseAdmin
      .from('dccmusic_composers')
      .update({
        partner_id: partner.id,
        partner_attributed_at: attributedAt,
        partner_expires_at: expiresAt.toISOString(),
        partner_lifetime_expires_at: lifetimeExpiresAt.toISOString(),
      })
      .eq('id', input.composerId)

    if (updateError) throw updateError

    return { attributed: true, partnerId: partner.id, expiresAt: expiresAt.toISOString(), lifetimeExpiresAt: lifetimeExpiresAt.toISOString() }
  } catch (error: any) {
    if (isPartnerSchemaMissing(error)) return { attributed: false, reason: 'setup_required' }
    throw error
  }
}

export async function recordConfirmedPartnerSignup(composerId: string) {
  try {
    const { data: composer, error: composerError } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, partner_id, partner_lifetime_expires_at')
      .eq('id', composerId)
      .maybeSingle()

    if (composerError) throw composerError
    if (!composer?.partner_id) return { recorded: false, reason: 'no_partner' }
    if (composer.partner_lifetime_expires_at && new Date(composer.partner_lifetime_expires_at).getTime() < Date.now()) {
      return { recorded: false, reason: 'lifetime_expired' }
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('tracking_events')
      .select('id')
      .eq('partner_id', composer.partner_id)
      .eq('user_id', composerId)
      .eq('event_type', 'signup')
      .eq('metadata->>confirmed', 'true')
      .maybeSingle()

    if (existingError) throw existingError
    if (existing) return { recorded: false, reason: 'already_recorded' }

    await recordPartnerEvent({
      sessionId: `email-confirmed:${composerId}`,
      partnerId: composer.partner_id,
      userId: composerId,
      eventType: 'signup',
      metadata: {
        confirmed: true,
        source: 'email_verification',
      },
    })

    return { recorded: true, partnerId: composer.partner_id }
  } catch (error: any) {
    if (isPartnerSchemaMissing(error)) return { recorded: false, reason: 'setup_required' }
    console.error('[Partners] Erro ao registrar cadastro confirmado:', error)
    return { recorded: false, reason: 'error' }
  }
}

export async function recordPartnerPurchase(input: {
  composerId: string
  purchaseId: string
  amount: number
  productType: string
  sessionId?: string | null
}) {
  try {
    const { data: composer, error: composerError } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, partner_id, partner_lifetime_expires_at')
      .eq('id', input.composerId)
      .maybeSingle()

    if (composerError) throw composerError
    if (!composer?.partner_id) return { recorded: false, reason: 'no_partner' }
    if (composer.partner_lifetime_expires_at && new Date(composer.partner_lifetime_expires_at).getTime() < Date.now()) {
      return { recorded: false, reason: 'lifetime_expired' }
    }

    const { data: partner, error: partnerError } = await supabaseAdmin
      .from('partners')
      .select('*')
      .eq('id', composer.partner_id)
      .maybeSingle()

    if (partnerError) throw partnerError
    if (!partner) return { recorded: false, reason: 'partner_not_found' }

    const amount = Number(input.amount) || 0
    const commissionResult = await resolvePartnerCommissionAmount(partner, {
      composerId: input.composerId,
      purchaseId: input.purchaseId,
      amount,
      productType: input.productType,
    })
    const commissionAmount = commissionResult.commissionAmount

    await supabaseAdmin.from('partner_commissions').upsert({
      partner_id: partner.id,
      purchase_id: input.purchaseId,
      amount,
      commission_amount: commissionAmount,
      status: 'approved',
      metadata: {
        composer_id: input.composerId,
        product_type: input.productType,
        commission_model: normalizeCommissionModel(partner.commission_model),
        commission_payment_scope: commissionResult.paymentScope,
        base_commission_amount: commissionResult.baseCommissionAmount,
        commission_cap_amount: commissionResult.capAmount,
        commission_paid_before: commissionResult.paidBefore,
        commission_remaining_before: commissionResult.remainingBefore,
        commission_capped: commissionResult.capped,
        commission_skipped_by_payment_scope: commissionResult.skippedByPaymentScope,
      },
    }, { onConflict: 'partner_id,purchase_id' })

    if (input.sessionId) {
      await recordPartnerEvent({
        sessionId: input.sessionId,
        partnerId: partner.id,
        userId: input.composerId,
        eventType: 'purchase',
        metadata: {
          purchase_id: input.purchaseId,
          amount,
          product_type: input.productType,
        },
      }).catch(() => null)
    }

    return { recorded: true, partnerId: partner.id }
  } catch (error: any) {
    if (isPartnerSchemaMissing(error)) return { recorded: false, reason: 'setup_required' }
    console.error('[Partners] Erro ao registrar compra:', error)
    return { recorded: false, reason: 'error' }
  }
}

