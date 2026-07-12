import { supabaseAdmin } from '@/lib/supabase'
import { getStudioAccess, getStudioCreditUsage, STUDIO_MUSIC_CREDITS } from '@/lib/studio'

type QueryResult = {
  data: any[] | null
  error: any
}

function isMissingOptionalTableError(error: any) {
  const message = String(error?.message || error?.details || '')
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    message.includes('Could not find the table') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  )
}

async function optionalRows(query: PromiseLike<QueryResult>) {
  const result = await query
  if (result.error) {
    if (isMissingOptionalTableError(result.error)) return []
    throw result.error
  }
  return result.data || []
}

function sortByDateDesc<T extends { date?: string | null }>(rows: T[]) {
  return rows.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0
    const dateB = b.date ? new Date(b.date).getTime() : 0
    return dateB - dateA
  })
}

function paymentStatusPriority(status?: string | null) {
  if (status === 'paid' || status === 'approved' || status === 'active') return 5
  if (status === 'refunded') return 4
  if (status === 'cancelled') return 3
  if (status === 'pending' || status === 'in_process') return 2
  if (status === 'failed' || status === 'rejected') return 1
  return 0
}

function dedupePayments<T extends {
  id: string
  type: string
  amount: number
  status?: string | null
  paymentId?: string | null
  date?: string | null
}>(rows: T[]) {
  const byKey = new Map<string, T>()

  for (const row of rows) {
    const key = row.paymentId
      ? `${row.type}:gateway:${row.paymentId}`
      : `${row.type}:fallback:${row.amount}:${row.date || row.id}`
    const existing = byKey.get(key)

    if (!existing) {
      byKey.set(key, row)
      continue
    }

    const currentPriority = paymentStatusPriority(row.status)
    const existingPriority = paymentStatusPriority(existing.status)
    const currentDate = row.date ? new Date(row.date).getTime() : 0
    const existingDate = existing.date ? new Date(existing.date).getTime() : 0

    if (
      currentPriority > existingPriority ||
      (currentPriority === existingPriority && currentDate > existingDate)
    ) {
      byKey.set(key, row)
    }
  }

  return Array.from(byKey.values())
}

function statusLabel(status?: string | null) {
  if (status === 'paid' || status === 'approved' || status === 'active') return 'Pago'
  if (status === 'pending' || status === 'in_process') return 'Pendente'
  if (status === 'refunded') return 'Estornado'
  if (status === 'cancelled') return 'Cancelado'
  if (status === 'failed' || status === 'rejected') return 'Falhou'
  return status || 'Não informado'
}

function creditActionLabel(action?: string | null) {
  const labels: Record<string, string> = {
    credit_topup: 'Recarga de créditos',
    credit_topup_refund: 'Estorno de recarga',
    manual_credit: 'Crédito manual',
    music_generation: 'Geração de música',
    free_music_generation: 'Música grátis',
    custom_voice_creation: 'Criação de voz IA',
    premium_cover: 'Capa premium IA',
    studio_cover_art: 'Criação de capa IA',
    music_transcription: 'Partitura e cifra',
    lyric_generation_free: 'Letra grátis',
  }
  return labels[action || ''] || action || 'Movimentação'
}

function isCreditMovement(action?: string | null) {
  return action === 'credit_topup' || action === 'manual_credit'
}

function dedupeCreditMovements(rows: any[]) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = row.action === 'credit_topup'
      ? row.metadata?.paymentId
        ? `credit_topup:${row.metadata.paymentId}`
        : `credit_topup:${row.metadata?.topupId || row.id}`
      : row.id

    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function monthKeyStartIso(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toISOString()
}

function movementSignedAmount(movement: any) {
  if (movement.ignoredInBalance) return 0
  const amount = Math.abs(Number(movement.amount) || 0)
  return movement.direction === 'credit' ? amount : -amount
}

function withRunningBalance<T extends { date?: string | null; id?: string; direction?: string; amount?: number; ignoredInBalance?: boolean }>(movements: T[]) {
  let balance = 0
  const chronologicalMovements = [...movements].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0
    const dateB = b.date ? new Date(b.date).getTime() : 0
    if (dateA !== dateB) return dateA - dateB
    return String(a.id || '').localeCompare(String(b.id || ''))
  })

  return chronologicalMovements.map((movement) => {
    balance = Math.max(0, balance + movementSignedAmount(movement))
    return {
      ...movement,
      balanceAfter: balance,
    }
  })
}

export async function getComposerStatement(composerId: string) {
  const [payments, featuredPayments, topups, creditTransactions, generationRows] = await Promise.all([
    optionalRows(
      supabaseAdmin
        .from('dccmusic_payments')
        .select('id, subscription_id, amount, currency, status, payment_method, payment_gateway, gateway_payment_id, paid_at, created_at')
        .eq('composer_id', composerId)
        .order('created_at', { ascending: false })
    ),
    optionalRows(
      supabaseAdmin
        .from('dccmusic_featured_payments')
        .select('id, content_type, content_id, payment_status, mercado_pago_payment_id, amount, is_active, expires_at, created_at')
        .eq('composer_id', composerId)
        .order('created_at', { ascending: false })
    ),
    optionalRows(
      supabaseAdmin
        .from('studio_credit_topups')
        .select('id, package_slug, music_quantity, credits, amount, currency, status, payment_gateway, payment_preference_id, payment_id, external_reference, paid_at, created_at')
        .eq('composer_id', composerId)
        .order('created_at', { ascending: false })
    ),
    optionalRows(
      supabaseAdmin
        .from('studio_credit_transactions')
        .select('id, project_id, action, amount, month_key, description, metadata, created_at')
        .eq('composer_id', composerId)
        .order('created_at', { ascending: false })
        .limit(100)
    ),
    optionalRows(
      supabaseAdmin
        .from('studio_generations')
        .select('provider_task_id, status')
        .eq('composer_id', composerId)
    ),
  ])

  const subscriptionIds = payments.map((payment: any) => payment.subscription_id).filter(Boolean)
  const subscriptions = subscriptionIds.length > 0
    ? await optionalRows(
        supabaseAdmin
          .from('dccmusic_subscriptions')
          .select('id, plan_id')
          .in('id', subscriptionIds)
      )
    : []

  const planIds = subscriptions.map((subscription: any) => subscription.plan_id).filter(Boolean)
  const plans = planIds.length > 0
    ? await optionalRows(
        supabaseAdmin
          .from('dccmusic_plans')
          .select('id, name, slug')
          .in('id', planIds)
      )
    : []

  const subscriptionsById = new Map(subscriptions.map((subscription: any) => [subscription.id, subscription]))
  const plansById = new Map(plans.map((plan: any) => [plan.id, plan]))

  const planPayments = dedupePayments(payments.map((payment: any) => {
    const subscription = subscriptionsById.get(payment.subscription_id)
    const plan = subscription ? plansById.get(subscription.plan_id) : null
    return {
      id: payment.id,
      type: 'plan',
      label: 'Plano Premium',
      description: plan?.name || 'Pagamento de plano',
      amount: Number(payment.amount) || 0,
      currency: payment.currency || 'BRL',
      status: payment.status,
      statusLabel: statusLabel(payment.status),
      paymentId: payment.gateway_payment_id || null,
      gateway: payment.payment_gateway || null,
      date: payment.paid_at || payment.created_at || null,
    }
  }))

  const featured = dedupePayments(featuredPayments.map((payment: any) => ({
    id: payment.id,
    type: 'featured',
    label: 'Destaque',
    description: payment.content_type === 'video' ? 'Destaque de vídeo' : 'Destaque de música',
    amount: Number(payment.amount) || 0,
    currency: 'BRL',
    status: payment.payment_status,
    statusLabel: statusLabel(payment.payment_status),
    paymentId: payment.mercado_pago_payment_id || null,
    gateway: 'mercadopago',
    date: payment.created_at || null,
  })))

  const topupById = new Map(topups.map((topup: any) => [topup.id, topup]))
  const topupPayments = dedupePayments(topups.flatMap((topup: any) => {
    const isPaid = topup.status === 'paid'
    const isRefunded = topup.status === 'refunded'
    const isCancelled = topup.status === 'cancelled'
    const payment = {
      id: topup.id,
      type: 'studio_topup',
      label: isPaid
        ? 'Recarga Studio IA'
        : isRefunded
          ? 'Recarga estornada'
          : isCancelled
            ? 'Recarga cancelada'
            : 'Tentativa de recarga',
      description: isPaid
        ? `${topup.music_quantity || 0} música(s) extras - ${topup.credits || 0} créditos`
        : isRefunded
          ? `${topup.music_quantity || 0} música(s) estornada(s). Créditos removidos do saldo.`
          : `${topup.music_quantity || 0} música(s) solicitada(s), aguardando pagamento`,
      amount: Number(topup.amount) || 0,
      currency: topup.currency || 'BRL',
      status: topup.status,
      statusLabel: statusLabel(topup.status),
      paymentId: isPaid ? (topup.payment_id || null) : (topup.payment_preference_id || null),
      paymentIdLabel: isPaid ? 'ID pagamento' : 'ID preferência',
      gateway: topup.payment_gateway || null,
      credits: isPaid ? Number(topup.credits) || 0 : 0,
      pendingCredits: isPaid ? 0 : Number(topup.credits) || 0,
      musicQuantity: Number(topup.music_quantity) || 0,
      date: topup.paid_at || topup.created_at || null,
    }

    if (!isRefunded) return [payment]

    return [
      {
        ...payment,
        id: `${topup.id}-paid-history`,
        label: 'Recarga aprovada',
        description: `${topup.music_quantity || 0} música(s) liberada(s) - ${topup.credits || 0} créditos. Depois foi estornada.`,
        status: 'paid_then_refunded',
        statusLabel: 'Sucesso, depois estornada',
        paymentId: topup.payment_id || topup.payment_preference_id || null,
        paymentIdLabel: topup.payment_id ? 'ID pagamento' : 'ID preferência',
        credits: 0,
        pendingCredits: 0,
        date: topup.paid_at || topup.created_at || null,
      },
      payment,
    ]
  }))
  const visibleTopupPayments = topupPayments.filter((payment) => payment.status !== 'pending')
  const pendingTopupAttempts = topupPayments.filter((payment) => payment.status === 'pending')
  const failedGenerationTaskIds = new Set(
    (generationRows || [])
      .filter((generation: any) => generation.status === 'failed' && generation.provider_task_id)
      .map((generation: any) => generation.provider_task_id)
  )

  const creditMovements = dedupeCreditMovements(creditTransactions)
    .map((transaction: any) => {
      const failedGeneration = failedGenerationTaskIds.has(transaction.metadata?.taskId)
      const ignoredTopup = transaction.action === 'credit_topup' && topupById.get(transaction.metadata?.topupId)?.status !== 'paid'
      return {
        id: transaction.id,
        action: transaction.action,
        label: failedGeneration
          ? 'Geração falhou'
          : ignoredTopup
            ? 'Recarga estornada/cancelada'
            : creditActionLabel(transaction.action),
        description: failedGeneration
          ? `${transaction.description || creditActionLabel(transaction.action)} (falhou, crédito não descontado)`
          : ignoredTopup
            ? `${transaction.description || creditActionLabel(transaction.action)} (histórico, não conta no saldo atual)`
            : transaction.description || creditActionLabel(transaction.action),
        amount: failedGeneration ? 0 : Number(transaction.amount) || 0,
        direction: failedGeneration ? 'ignored' : isCreditMovement(transaction.action) ? 'credit' : 'debit',
        monthKey: transaction.month_key || null,
        paymentId: transaction.metadata?.paymentId || null,
        topupId: transaction.metadata?.topupId || null,
        ignoredInBalance: failedGeneration || ignoredTopup,
        date: transaction.created_at || null,
      }
    })

  const paidPlanTotal = planPayments
    .filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + payment.amount, 0)
  const paidFeaturedTotal = featured
    .filter((payment) => payment.status === 'approved')
    .reduce((sum, payment) => sum + payment.amount, 0)
  const paidTopupTotal = topupPayments
    .filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + payment.amount, 0)
  const boughtCredits = topupPayments
    .filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + payment.credits, 0)
  const manualCredits = creditMovements
    .filter((movement) => movement.action === 'manual_credit')
    .reduce((sum, movement) => sum + movement.amount, 0)
  const boughtMusicQuantity = topupPayments
    .filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + payment.musicQuantity, 0)
  const usedCredits = creditMovements
    .filter((movement) => movement.direction !== 'credit')
    .reduce((sum, movement) => sum + movement.amount, 0)
  const { plan: activeStudioPlan, hasAccess: hasStudioPlan, limits } = await getStudioAccess(composerId)
  const studioUsage = await getStudioCreditUsage(composerId, limits)
  const currentCreditBalance = studioUsage.remaining
  const currentMusicBalance = Math.floor(currentCreditBalance / STUDIO_MUSIC_CREDITS)
  const planCreditMovements = hasStudioPlan
    ? (studioUsage.planCreditMovements || []).map((movement: any) => ({
        id: movement.id,
        action: 'studio_plan_credit',
        label: 'Créditos do plano',
        description: `${movement.planName || activeStudioPlan?.name || 'Plano Studio IA'} - créditos liberados`,
        amount: Number(movement.credits) || 0,
        direction: 'credit',
        monthKey: movement.date ? movement.date.slice(0, 7) : studioUsage.monthKey,
        paymentId: movement.source === 'payment' ? movement.sourceKey?.replace('payment:', '') : null,
        topupId: null,
        ignoredInBalance: false,
        date: movement.date || monthKeyStartIso(studioUsage.monthKey),
        virtual: true,
      }))
    : []
  const visibleCreditMovements = sortByDateDesc(withRunningBalance([
    ...planCreditMovements,
    ...creditMovements,
  ]))

  return {
    summary: {
      totalPaid: paidPlanTotal + paidFeaturedTotal + paidTopupTotal,
      planPaid: paidPlanTotal,
      featuredPaid: paidFeaturedTotal,
      topupPaid: paidTopupTotal,
      boughtCredits: studioUsage.monthlyCredits,
      boughtMusicQuantity: boughtMusicQuantity + Math.floor(manualCredits / 10),
      usedCredits: studioUsage.used,
      currentCreditBalance,
      currentMusicBalance,
      hasStudioPlan,
      studioPlanName: activeStudioPlan?.name || null,
      baseMonthlyCredits: studioUsage.baseMonthlyCredits,
      topupCredits: studioUsage.topupCredits,
      monthlyCredits: studioUsage.monthlyCredits,
      paymentCount: planPayments.length + featured.length + visibleTopupPayments.length,
      pendingTopupAttempts: pendingTopupAttempts.length,
      creditMovementCount: visibleCreditMovements.length,
    },
    payments: sortByDateDesc([...planPayments, ...featured, ...visibleTopupPayments]),
    pendingTopups: sortByDateDesc(pendingTopupAttempts),
    topups: topupPayments,
    creditMovements: visibleCreditMovements,
  }
}
