import * as db from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'
import { slugify } from '@/lib/utils'

export const STUDIO_PLAN_SLUGS = ['studio-start', 'studio-pro', 'studio-elite', 'dcc-studio-ia']
export const STUDIO_MUSIC_CREDITS = 10
export const STUDIO_VOICE_CREDITS = 2
export const STUDIO_PREMIUM_COVER_CREDITS = 2
export const FREE_STUDIO_LYRIC_LIMIT = 3
export const FREE_STUDIO_MUSIC_LIMIT = 1

export function canCreateStudioMusicWithCredits(usage: { remaining: number }) {
  return usage.remaining >= STUDIO_MUSIC_CREDITS
}

function dedupePaidStudioTopups(topups: any[]) {
  const byKey = new Map<string, any>()

  for (const topup of topups || []) {
    const key = topup.payment_id
      ? `payment:${topup.payment_id}`
      : `topup:${topup.id || topup.external_reference || topup.created_at}`
    const existing = byKey.get(key)

    if (!existing) {
      byKey.set(key, topup)
      continue
    }

    const currentDate = new Date(topup.paid_at || topup.created_at || 0).getTime()
    const existingDate = new Date(existing.paid_at || existing.created_at || 0).getTime()
    if (currentDate > existingDate) {
      byKey.set(key, topup)
    }
  }

  return Array.from(byKey.values())
}

function isPaidStatus(status?: string | null) {
  return status === 'paid' || status === 'approved' || status === 'active'
}

function studioPlanCreditsFromIdentity(name?: string | null, slug?: string | null) {
  const identity = `${name || ''} ${slug || ''}`.toLowerCase()

  if (identity.includes('elite')) return 300
  if (identity.includes('pro')) return 130
  if (identity.includes('studio')) return 80
  return 0
}

function isStudioPlanIdentity(name?: string | null, slug?: string | null) {
  const identity = `${name || ''} ${slug || ''}`.toLowerCase()
  return STUDIO_PLAN_SLUGS.includes(slug || '') || identity.includes('dcc studio') || identity.includes('studio ia') || identity.includes('studio')
}

function dedupePlanCreditMovements<T extends { sourceKey: string; date?: string | null }>(movements: T[]) {
  const byKey = new Map<string, T>()

  for (const movement of movements) {
    const existing = byKey.get(movement.sourceKey)
    if (!existing) {
      byKey.set(movement.sourceKey, movement)
      continue
    }

    const currentDate = new Date(movement.date || 0).getTime()
    const existingDate = new Date(existing.date || 0).getTime()
    if (currentDate > existingDate) {
      byKey.set(movement.sourceKey, movement)
    }
  }

  return Array.from(byKey.values())
}

function calculateNonNegativeCreditBalance(movements: Array<{
  id?: string
  amount: number
  direction: 'credit' | 'debit'
  date?: string | null
}>) {
  let balance = 0
  const chronologicalMovements = [...movements].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0
    const dateB = b.date ? new Date(b.date).getTime() : 0
    if (dateA !== dateB) return dateA - dateB
    return String(a.id || '').localeCompare(String(b.id || ''))
  })

  for (const movement of chronologicalMovements) {
    const amount = Math.max(0, Number(movement.amount) || 0)
    balance = Math.max(0, balance + (movement.direction === 'credit' ? amount : -amount))
  }

  return balance
}

export async function getStudioPlanCreditMovements(composerId: string) {
  const [{ data: payments, error: paymentsError }, { data: manualSubscriptions, error: manualSubscriptionsError }] = await Promise.all([
    supabaseAdmin
      .from('dccmusic_payments')
      .select('id, subscription_id, status, gateway_payment_id, paid_at, created_at')
      .eq('composer_id', composerId),
    supabaseAdmin
      .from('dccmusic_subscriptions')
      .select(`
        id,
        payment_method,
        payment_id,
        start_date,
        created_at,
        plan:dccmusic_plans(name, slug)
      `)
      .eq('composer_id', composerId)
      .eq('status', 'active')
      .or('payment_method.eq.manual,payment_id.ilike.admin-free-%'),
  ])

  if (paymentsError) throw paymentsError
  if (manualSubscriptionsError) throw manualSubscriptionsError

  const subscriptionIds = (payments || [])
    .map((payment: any) => payment.subscription_id)
    .filter(Boolean)

  const subscriptions = subscriptionIds.length > 0
    ? await supabaseAdmin
        .from('dccmusic_subscriptions')
        .select('id, plan_id')
        .in('id', subscriptionIds)
    : { data: [], error: null }

  if (subscriptions.error) throw subscriptions.error

  const planIds = (subscriptions.data || [])
    .map((subscription: any) => subscription.plan_id)
    .filter(Boolean)

  const plans = planIds.length > 0
    ? await supabaseAdmin
        .from('dccmusic_plans')
        .select('id, name, slug')
        .in('id', planIds)
    : { data: [], error: null }

  if (plans.error) throw plans.error

  const subscriptionsById = new Map((subscriptions.data || []).map((subscription: any) => [subscription.id, subscription]))
  const plansById = new Map((plans.data || []).map((plan: any) => [plan.id, plan]))

  const paidMovements = (payments || [])
    .filter((payment: any) => isPaidStatus(payment.status))
    .map((payment: any) => {
      const subscription: any = subscriptionsById.get(payment.subscription_id)
      const plan: any = subscription ? plansById.get(subscription.plan_id) : null
      const credits = studioPlanCreditsFromIdentity(plan?.name, plan?.slug)

      if (!credits || !isStudioPlanIdentity(plan?.name, plan?.slug)) return null

      return {
        id: `plan-payment-${payment.gateway_payment_id || payment.id}`,
        source: 'payment',
        sourceKey: payment.gateway_payment_id
          ? `payment:${payment.gateway_payment_id}`
          : `payment:${payment.id}`,
        subscriptionId: payment.subscription_id || null,
        planName: plan?.name || 'Plano Studio IA',
        planSlug: plan?.slug || null,
        credits,
        date: payment.paid_at || payment.created_at || null,
      }
    })
    .filter(Boolean)

  const manualMovements = (manualSubscriptions || [])
    .map((subscription: any) => {
      const plan = Array.isArray(subscription.plan) ? subscription.plan[0] : subscription.plan
      const credits = studioPlanCreditsFromIdentity(plan?.name, plan?.slug)

      if (!credits || !isStudioPlanIdentity(plan?.name, plan?.slug)) return null

      return {
        id: `plan-manual-${subscription.id}`,
        source: 'manual',
        sourceKey: `manual:${subscription.id}`,
        subscriptionId: subscription.id,
        planName: plan?.name || 'Plano Studio IA',
        planSlug: plan?.slug || null,
        credits,
        date: subscription.start_date || subscription.created_at || null,
      }
    })
    .filter(Boolean)

  return dedupePlanCreditMovements([...paidMovements, ...manualMovements] as any[])
    .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
}

export type StudioProjectRow = {
  id: string
  composer_id: string
  title: string
  slug: string
  style: string | null
  mood: string | null
  structure: string | null
  line_count: string | null
  status: 'draft' | 'generating' | 'ready' | 'published' | 'archived'
  favorite: boolean
  description: string | null
  public_slug: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export function studioMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value || String(date.getUTCFullYear())
  const month = parts.find((part) => part.type === 'month')?.value || String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function studioMonthRange(monthKey = studioMonthKey()) {
  const [year, month] = monthKey.split('-').map(Number)
  // O saldo do Studio IA é mensal pelo calendário brasileiro, não por UTC.
  const start = new Date(Date.UTC(year, month - 1, 1, 3))
  const end = new Date(Date.UTC(year, month, 1, 3))

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

function addMonths(date: Date, months: number) {
  const result = new Date(date)
  const originalDay = result.getUTCDate()
  result.setUTCMonth(result.getUTCMonth() + months)

  if (result.getUTCDate() !== originalDay) {
    result.setUTCDate(0)
  }

  return result
}

async function getStudioCreditPeriod(composerId: string, monthKey = studioMonthKey()) {
  const now = new Date()
  const { data, error } = await supabaseAdmin
    .from('dccmusic_subscriptions')
    .select(`
      id,
      start_date,
      end_date,
      created_at,
      plan:dccmusic_plans(name, slug)
    `)
    .eq('composer_id', composerId)
    .eq('status', 'active')
    .gte('end_date', now.toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error

  const studioSubscription = (data || []).find((subscription: any) => {
    const plan = Array.isArray(subscription.plan) ? subscription.plan[0] : subscription.plan
    const identity = `${plan?.name || ''} ${plan?.slug || ''}`.toLowerCase()
    return STUDIO_PLAN_SLUGS.includes(plan?.slug) || identity.includes('dcc studio') || identity.includes('studio ia')
  })

  if (!studioSubscription?.start_date) {
    const fallbackRange = studioMonthRange(monthKey)
    return {
      start: fallbackRange.start,
      queryStart: fallbackRange.start,
      end: fallbackRange.end,
      key: monthKey,
    }
  }

  let start = new Date(studioSubscription.start_date)
  let end = addMonths(start, 1)

  while (end <= now) {
    start = end
    end = addMonths(start, 1)
  }
  const key = studioMonthKey(start)
  const queryStart = studioMonthRange(key).start

  return {
    start: start.toISOString(),
    queryStart,
    end: end.toISOString(),
    key,
  }
}

export function isStudioPlan(plan: db.Plan | null) {
  if (!plan || !plan.isActive) return false
  const identity = `${plan.name || ''} ${plan.slug || ''}`.toLowerCase()
  return STUDIO_PLAN_SLUGS.includes(plan.slug) || identity.includes('dcc studio') || identity.includes('studio ia')
}

export function getStudioPlanLimits(plan: db.Plan | null) {
  const identity = `${plan?.name || ''} ${plan?.slug || ''}`.toLowerCase()

  if (identity.includes('elite')) {
    return {
      monthlyCredits: 300,
      musicLimit: 30,
      premiumCoverLimit: 30,
    }
  }

  if (identity.includes('pro')) {
    return {
      monthlyCredits: 130,
      musicLimit: 13,
      premiumCoverLimit: 10,
    }
  }

  return {
    monthlyCredits: 80,
    musicLimit: 8,
    premiumCoverLimit: 0,
  }
}

export async function getStudioAccess(composerId: string) {
  const plan = await db.getComposerActivePlan(composerId)
  const hasAccess = isStudioPlan(plan)
  return {
    plan,
    hasAccess,
    limits: hasAccess
      ? getStudioPlanLimits(plan)
      : {
          monthlyCredits: 0,
          musicLimit: 0,
          premiumCoverLimit: 0,
        },
  }
}

export async function getComposerPremiumAccess(composerId: string) {
  const [composerResult, activeSubscription] = await Promise.all([
    supabaseAdmin
      .from('dccmusic_composers')
      .select('is_premium, has_active_subscription, subscription_expires_at')
      .eq('id', composerId)
      .maybeSingle(),
    db.getComposerActiveSubscription(composerId),
  ])

  if (composerResult.error) throw composerResult.error

  const expiresAt = composerResult.data?.subscription_expires_at
    ? new Date(composerResult.data.subscription_expires_at)
    : null
  const composerFlagsActive = Boolean(
    composerResult.data?.is_premium &&
    composerResult.data?.has_active_subscription &&
    expiresAt &&
    expiresAt > new Date()
  )

  return composerFlagsActive || Boolean(activeSubscription)
}

export async function getStudioCreditUsage(composerId: string, limits = getStudioPlanLimits(null), monthKey = studioMonthKey()) {
  const [
    { data, error },
    { count: generationCount, error: generationError },
    { data: generationRows, error: generationRowsError },
    { data: paidTopups, error: paidTopupsError },
    { data: topupMusicTransactions, error: topupMusicTransactionsError },
    { data: manualCreditTransactions, error: manualCreditTransactionsError },
    planCreditMovements,
  ] = await Promise.all([
    supabaseAdmin
      .from('studio_credit_transactions')
      .select('amount, action, metadata, created_at')
      .eq('composer_id', composerId),
    supabaseAdmin
      .from('studio_generations')
      .select('*', { count: 'exact', head: true })
      .eq('composer_id', composerId)
      .neq('status', 'failed'),
    supabaseAdmin
      .from('studio_generations')
      .select('provider_task_id, status')
      .eq('composer_id', composerId),
    supabaseAdmin
      .from('studio_credit_topups')
      .select('id, credits, payment_id, external_reference, paid_at, created_at')
      .eq('composer_id', composerId)
      .eq('status', 'paid'),
    supabaseAdmin
      .from('studio_credit_transactions')
      .select('amount, action, metadata, created_at')
      .eq('composer_id', composerId)
      .eq('action', 'music_generation'),
    supabaseAdmin
      .from('studio_credit_transactions')
      .select('amount, action, created_at')
      .eq('composer_id', composerId)
      .eq('action', 'manual_credit'),
    getStudioPlanCreditMovements(composerId),
  ])

  if (error) throw error
  if (generationError) throw generationError
  if (generationRowsError) throw generationRowsError
  if (paidTopupsError) throw paidTopupsError
  if (topupMusicTransactionsError) throw topupMusicTransactionsError
  if (manualCreditTransactionsError) throw manualCreditTransactionsError

  const failedGenerationTaskIds = new Set(
    (generationRows || [])
      .filter((generation: any) => generation.status === 'failed' && generation.provider_task_id)
      .map((generation: any) => generation.provider_task_id)
  )
  const transactions = (data || []).filter((transaction: any) => (
    !failedGenerationTaskIds.has(transaction.metadata?.taskId)
  ))
  const planCredits = (planCreditMovements || [])
    .reduce((sum: number, movement: any) => sum + Math.max(0, Number(movement.credits) || 0), 0)
  const paidTopupCredits = dedupePaidStudioTopups(paidTopups || [])
    .reduce((sum: number, topup: any) => sum + Math.max(0, Number(topup.credits) || 0), 0)
  const manualCredits = (manualCreditTransactions || [])
    .reduce((sum: number, transaction: any) => sum + Math.max(0, Number(transaction.amount) || 0), 0)
  const usedTopupCredits = (topupMusicTransactions || [])
    .filter((transaction: any) => !failedGenerationTaskIds.has(transaction.metadata?.taskId))
    .filter((transaction: any) => transaction.metadata?.topup === true)
    .reduce((sum: number, transaction: any) => sum + Math.max(0, Number(transaction.amount) || 0), 0)
  const topupCredits = Math.max(0, paidTopupCredits + manualCredits - usedTopupCredits)
  const musicGenerationTransactions = transactions.filter((transaction: any) => transaction.action === 'music_generation')
  const planMusicGenerationTransactions = musicGenerationTransactions.filter((transaction: any) => transaction.metadata?.topup !== true)
  const freeMusicGenerationTransactions = transactions.filter((transaction: any) => transaction.action === 'free_music_generation')
  const musicCreditTransactions = planMusicGenerationTransactions.reduce((sum: number, transaction: any) => sum + Math.max(0, Number(transaction.amount) || 0), 0)
  const otherUsed = transactions
    .filter((transaction: any) => (
      transaction.action !== 'music_generation' &&
      transaction.action !== 'free_music_generation' &&
      transaction.action !== 'credit_topup' &&
      transaction.action !== 'credit_topup_refund' &&
      transaction.action !== 'manual_credit'
    ))
    .reduce((sum: number, transaction: any) => sum + Math.max(0, Number(transaction.amount) || 0), 0)
  const trackedMusicGenerations = musicGenerationTransactions.length + freeMusicGenerationTransactions.length
  const untrackedMusicGenerations = Math.max(0, (generationCount || 0) - trackedMusicGenerations)
  const freeSlotsNotTracked = Math.max(0, FREE_STUDIO_MUSIC_LIMIT - freeMusicGenerationTransactions.length)
  const billableUntrackedMusicGenerations = Math.max(0, untrackedMusicGenerations - freeSlotsNotTracked)
  const billableMusicGenerations = planMusicGenerationTransactions.length + billableUntrackedMusicGenerations
  const musicCreditsUsed = Math.max(musicCreditTransactions, billableMusicGenerations * STUDIO_MUSIC_CREDITS)
  const used = otherUsed + musicCreditsUsed
  const monthlyCredits = planCredits + topupCredits
  const premiumCoverGenerations = (data || []).filter((transaction: any) => transaction.action === 'premium_cover').length
  const balanceMovements = [
    ...(planCreditMovements || []).map((movement: any) => ({
      id: movement.id,
      amount: Number(movement.credits) || 0,
      direction: 'credit' as const,
      date: movement.date || null,
    })),
    ...dedupePaidStudioTopups(paidTopups || []).map((topup: any) => ({
      id: `topup-${topup.id}`,
      amount: Number(topup.credits) || 0,
      direction: 'credit' as const,
      date: topup.paid_at || topup.created_at || null,
    })),
    ...(manualCreditTransactions || []).map((transaction: any) => ({
      id: transaction.id,
      amount: Number(transaction.amount) || 0,
      direction: 'credit' as const,
      date: transaction.created_at || null,
    })),
    ...transactions
      .filter((transaction: any) => (
        transaction.action !== 'credit_topup' &&
        transaction.action !== 'manual_credit'
      ))
      .map((transaction: any) => ({
        id: transaction.id,
        amount: Number(transaction.amount) || 0,
        direction: 'debit' as const,
        date: transaction.created_at || null,
      })),
  ]
  const remaining = calculateNonNegativeCreditBalance(balanceMovements)
  const effectiveUsed = Math.max(0, monthlyCredits - remaining)

  return {
    used: effectiveUsed,
    remaining,
    musicGenerations: generationCount || 0,
    billableMusicGenerations,
    premiumCoverGenerations,
    musicLimit: limits.musicLimit + Math.floor(topupCredits / STUDIO_MUSIC_CREDITS),
    premiumCoverLimit: limits.premiumCoverLimit,
    monthlyCredits,
    baseMonthlyCredits: planCredits,
    topupCredits,
    monthKey,
    periodStart: planCreditMovements?.[0]?.date || null,
    periodEnd: null,
    planCreditMovements,
  }
}

export async function getFreeLyricUsage(composerId: string, monthKey = studioMonthKey()) {
  const { count, error } = await supabaseAdmin
    .from('studio_credit_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('composer_id', composerId)
    .eq('month_key', monthKey)
    .eq('action', 'lyric_generation_free')

  if (error) throw error

  return {
    used: count || 0,
    limit: FREE_STUDIO_LYRIC_LIMIT,
    remaining: Math.max(0, FREE_STUDIO_LYRIC_LIMIT - (count || 0)),
    monthKey,
  }
}

export async function getFreeMusicUsage(composerId: string) {
  const [{ data: generations, error }, { data: versions, error: versionsError }, { data: composer, error: composerError }] = await Promise.all([
    supabaseAdmin
      .from('studio_generations')
      .select('project_id')
      .eq('composer_id', composerId)
      .neq('status', 'failed'),
    supabaseAdmin
      .from('studio_versions')
      .select('project_id, audio_url, stream_audio_url')
      .eq('composer_id', composerId),
    supabaseAdmin
      .from('dccmusic_composers')
      .select('created_at')
      .eq('id', composerId)
      .maybeSingle(),
  ])

  if (error) throw error
  if (versionsError) throw versionsError
  if (composerError) throw composerError

  const usedProjectIds = new Set<string>()
  ;(generations || []).forEach((generation: any) => {
    if (generation.project_id) usedProjectIds.add(generation.project_id)
  })
  ;(versions || []).forEach((version: any) => {
    if (version.project_id && (version.audio_url || version.stream_audio_url)) {
      usedProjectIds.add(version.project_id)
    }
  })

  const used = usedProjectIds.size
  const remaining = Math.max(0, FREE_STUDIO_MUSIC_LIMIT - used)

  return {
    used,
    limit: FREE_STUDIO_MUSIC_LIMIT,
    remaining,
    disabledByCampaign: false,
  }
}

export async function addStudioCreditTransaction(input: {
  composerId: string
  projectId?: string | null
  action: string
  amount: number
  description?: string
  metadata?: any
}) {
  const { error } = await supabaseAdmin
    .from('studio_credit_transactions')
    .insert({
      composer_id: input.composerId,
      project_id: input.projectId || null,
      action: input.action,
      amount: input.amount,
      month_key: studioMonthKey(),
      description: input.description || null,
      metadata: input.metadata || null,
    })

  if (error) throw error
}

export async function chargeStudioVoiceCreationOnce(input: {
  composerId: string
  voiceProfileId: string
  voiceName?: string | null
  taskId?: string | null
}) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('studio_credit_transactions')
    .select('id, metadata')
    .eq('composer_id', input.composerId)
    .eq('action', 'custom_voice_creation')

  if (existingError) throw existingError

  const alreadyCharged = (existing || []).some((transaction: any) => (
    transaction.metadata?.voiceProfileId === input.voiceProfileId
  ))

  if (alreadyCharged) return { charged: false }

  await addStudioCreditTransaction({
    composerId: input.composerId,
    action: 'custom_voice_creation',
    amount: STUDIO_VOICE_CREDITS,
    description: input.voiceName
      ? `Criação de voz IA: ${input.voiceName}`
      : 'Criação de voz IA',
    metadata: {
      voiceProfileId: input.voiceProfileId,
      taskId: input.taskId || null,
    },
  })

  return { charged: true }
}

export async function creditStudioTopupOnce(input: {
  topup: any
  paymentId: string | number
  paymentData?: any
  metadata?: any
}) {
  const paymentId = String(input.paymentId)
  const { data: claimedTopup, error: claimError } = await supabaseAdmin
    .from('studio_credit_topups')
    .update({
      status: 'paid',
      payment_id: paymentId,
      paid_at: new Date().toISOString(),
      metadata: {
        ...(input.topup.metadata || {}),
        ...(input.metadata || {}),
        mercadopago_payment: input.paymentData || input.topup.metadata?.mercadopago_payment || null,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.topup.id)
    .neq('status', 'paid')
    .select('*')
    .maybeSingle()

  if (claimError) throw claimError

  if (!claimedTopup) {
    return {
      credited: false,
      topup: input.topup,
      reason: 'already_paid_or_claimed',
    }
  }

  const { data: existingCredit, error: existingCreditError } = await supabaseAdmin
    .from('studio_credit_transactions')
    .select('id')
    .eq('composer_id', claimedTopup.composer_id)
    .eq('action', 'credit_topup')
    .contains('metadata', { topupId: claimedTopup.id })
    .maybeSingle()

  if (existingCreditError) throw existingCreditError

  if (existingCredit) {
    return {
      credited: false,
      topup: claimedTopup,
      reason: 'credit_already_exists',
    }
  }

  await addStudioCreditTransaction({
    composerId: claimedTopup.composer_id,
    action: 'credit_topup',
    amount: Number(claimedTopup.credits) || 0,
    description: `Recarga avulsa Studio IA: ${claimedTopup.music_quantity} músicas`,
    metadata: {
      topupId: claimedTopup.id,
      paymentId,
      packageSlug: claimedTopup.package_slug,
      amount: claimedTopup.amount,
      ...(input.metadata || {}),
    },
  })

  // Se a recarga veio de um cupom pago, conta o uso do cupom (apenas após o pagamento confirmado).
  const couponId = claimedTopup.metadata?.couponId
  if (couponId) {
    try {
      const { data: coupon } = await supabaseAdmin
        .from('studio_coupons')
        .select('used_count')
        .eq('id', couponId)
        .maybeSingle()

      if (coupon) {
        await supabaseAdmin
          .from('studio_coupons')
          .update({ used_count: Number(coupon.used_count || 0) + 1, updated_at: new Date().toISOString() })
          .eq('id', couponId)
      }
    } catch (couponError) {
      console.error('[STUDIO] Erro ao contar uso de cupom pago:', couponError)
    }
  }

  return {
    credited: true,
    topup: claimedTopup,
    reason: 'credited',
  }
}

export async function revokeStudioTopupCreditOnce(input: {
  topup: any
  paymentId: string | number
  paymentData?: any
  reason?: string
}) {
  const paymentId = String(input.paymentId)
  const { data: existingReversal, error: existingReversalError } = await supabaseAdmin
    .from('studio_credit_transactions')
    .select('id')
    .eq('composer_id', input.topup.composer_id)
    .eq('action', 'credit_topup_refund')
    .contains('metadata', { topupId: input.topup.id })
    .maybeSingle()

  if (existingReversalError) throw existingReversalError

  if (existingReversal) {
    return {
      reversed: false,
      reason: 'reversal_already_exists',
    }
  }

  await addStudioCreditTransaction({
    composerId: input.topup.composer_id,
    action: 'credit_topup_refund',
    amount: Number(input.topup.credits) || 0,
    description: `Estorno/contestação de recarga Studio IA: ${input.topup.music_quantity} músicas`,
    metadata: {
      topupId: input.topup.id,
      paymentId,
      packageSlug: input.topup.package_slug,
      amount: input.topup.amount,
      reason: input.reason || 'payment_refunded_or_charged_back',
      mercadopagoPayment: input.paymentData || null,
    },
  })

  return {
    reversed: true,
    reason: 'reversed',
  }
}

export async function createUniqueProjectSlug(composerId: string, title: string) {
  const base = slugify(title || 'musica')
  let slug = `${base}-${Date.now().toString(36)}`

  const { data } = await supabaseAdmin
    .from('studio_projects')
    .select('id')
    .eq('composer_id', composerId)
    .eq('slug', slug)
    .maybeSingle()

  if (data) {
    slug = `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  }

  return slug
}

export function mapStudioProject(project: any, extras?: any) {
  return {
    id: project.id,
    title: project.title,
    slug: project.slug,
    style: project.style,
    mood: project.mood,
    structure: project.structure,
    lineCount: project.line_count,
    status: project.status,
    favorite: Boolean(project.favorite),
    description: project.description,
    publicSlug: project.public_slug,
    publishedAt: project.published_at,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    ...extras,
  }
}

export async function getCurrentProjectAssets(projectId: string) {
  const [{ data: lyric }, { data: version }, { data: cover }] = await Promise.all([
    supabaseAdmin
      .from('studio_lyrics')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('studio_versions')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('studio_covers')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return { lyric, version, cover }
}

export async function getProjectForComposer(projectId: string, composerId: string) {
  const { data, error } = await supabaseAdmin
    .from('studio_projects')
    .select('*')
    .eq('id', projectId)
    .eq('composer_id', composerId)
    .maybeSingle()

  if (error) throw error
  return data
}

export function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'https://www.dccmusic.online'
  ).replace(/\/$/, '')
}

/**
 * Monta uma URL de callback do Studio (Suno) já com o segredo, quando configurado.
 * O provedor externo (Suno) chama exatamente esta URL de volta, então o segredo retorna
 * na query string e conseguimos validar que a chamada veio de uma solicitação nossa.
 */
export function getStudioCallbackUrl(path: string) {
  const base = getSiteUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${base}${normalizedPath}`
  const secret = process.env.STUDIO_CALLBACK_SECRET?.trim()
  if (!secret) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}secret=${encodeURIComponent(secret)}`
}

/**
 * Valida o segredo recebido em um callback do Studio (Suno).
 * - Se STUDIO_CALLBACK_SECRET não estiver configurado, não bloqueia (compatibilidade).
 * - Se estiver configurado, exige o segredo via query string (?secret=) ou header (x-callback-secret).
 */
export function isValidStudioCallback(request: Request): boolean {
  const secret = process.env.STUDIO_CALLBACK_SECRET?.trim()
  if (!secret) return true

  let providedFromQuery: string | null = null
  try {
    providedFromQuery = new URL(request.url).searchParams.get('secret')
  } catch {
    providedFromQuery = null
  }
  const providedFromHeader = request.headers.get('x-callback-secret')

  return providedFromQuery === secret || providedFromHeader === secret
}
