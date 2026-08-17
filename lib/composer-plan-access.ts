import { supabaseAdmin } from '@/lib/supabase'

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

export function resolveSubscriptionEndDate(subscription: any, plan: any) {
  const existingEndDate = subscription?.end_date ? new Date(subscription.end_date) : null
  if (existingEndDate && existingEndDate > new Date()) return existingEndDate

  const durationMonths = Math.max(1, Number(plan?.duration_months) || 1)
  return addMonths(new Date(), durationMonths)
}

export async function activateComposerPlanAccess(input: {
  subscription: any
  plan?: any
  paymentId: string | number
}) {
  const endDate = resolveSubscriptionEndDate(input.subscription, input.plan)

  const [{ error: subscriptionError }, { error: composerError }] = await Promise.all([
    supabaseAdmin
      .from('dccmusic_subscriptions')
      .update({
        status: 'active',
        payment_id: input.paymentId,
        end_date: endDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.subscription.id),
    supabaseAdmin
      .from('dccmusic_composers')
      .update({
        is_premium: true,
        has_active_subscription: true,
        subscription_expires_at: endDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.subscription.composer_id),
  ])

  if (subscriptionError) throw subscriptionError
  if (composerError) throw composerError
}

export async function revokeComposerPlanAccess(input: {
  subscription: any
  paymentId: string | number
}) {
  const { error: subscriptionError } = await supabaseAdmin
    .from('dccmusic_subscriptions')
    .update({
      status: 'cancelled',
      payment_id: input.paymentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.subscription.id)

  if (subscriptionError) throw subscriptionError

  const nowIso = new Date().toISOString()
  const { data: remainingActive } = await supabaseAdmin
    .from('dccmusic_subscriptions')
    .select('id, end_date')
    .eq('composer_id', input.subscription.composer_id)
    .eq('status', 'active')
    .gt('end_date', nowIso)
    .order('end_date', { ascending: false })
    .limit(1)

  const stillActive = remainingActive?.[0] || null

  const { error: composerError } = await supabaseAdmin
    .from('dccmusic_composers')
    .update(
      stillActive
        ? {
            is_premium: true,
            has_active_subscription: true,
            subscription_expires_at: stillActive.end_date,
            updated_at: nowIso,
          }
        : {
            is_premium: false,
            has_active_subscription: false,
            subscription_expires_at: null,
            updated_at: nowIso,
          }
    )
    .eq('id', input.subscription.composer_id)

  if (composerError) throw composerError
}

export async function getOrCreatePendingSubscription(composerId: string, planId: string) {
  const { data: subscriptionJson, error: completeError } = await supabaseAdmin.rpc(
    'dccmusic_get_or_create_subscription_complete',
    {
      p_composer_id: composerId,
      p_plan_id: planId,
      p_status: 'pending',
    }
  )

  if (!completeError && subscriptionJson) return subscriptionJson

  const { data: subscriptionId, error: getOrCreateError } = await supabaseAdmin.rpc(
    'dccmusic_get_or_create_subscription',
    {
      p_composer_id: composerId,
      p_plan_id: planId,
      p_status: 'pending',
    }
  )

  if (!getOrCreateError && subscriptionId) {
    const { data: subscription, error: fetchError } = await supabaseAdmin
      .from('dccmusic_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .maybeSingle()
    if (!fetchError && subscription) return subscription
  }

  const { data: createdId, error: createError } = await supabaseAdmin.rpc(
    'dccmusic_create_subscription',
    {
      p_composer_id: composerId,
      p_plan_id: planId,
      p_status: 'pending',
    }
  )

  if (!createError && createdId) {
    const { data: subscription, error: fetchError } = await supabaseAdmin
      .from('dccmusic_subscriptions')
      .select('*')
      .eq('id', createdId)
      .maybeSingle()
    if (!fetchError && subscription) return subscription
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('dccmusic_subscriptions')
    .select('*')
    .eq('composer_id', composerId)
    .eq('plan_id', planId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!existingError && existing) return existing

  throw new Error(
    getOrCreateError?.message ||
      createError?.message ||
      existingError?.message ||
      'Erro ao criar ou buscar assinatura'
  )
}

export async function upsertPlanPaymentRecord(input: {
  subscription: any
  paymentId: string
  paymentData: any
  status: string
}) {
  const { data: existingPayment } = await supabaseAdmin
    .from('dccmusic_payments')
    .select('id, status, paid_at')
    .eq('gateway_payment_id', input.paymentId)
    .maybeSingle()

  const paidAt = input.status === 'paid' ? new Date().toISOString() : null

  if (!existingPayment) {
    const { error } = await supabaseAdmin.from('dccmusic_payments').insert({
      subscription_id: input.subscription.id,
      composer_id: input.subscription.composer_id,
      amount: parseFloat(input.paymentData.transaction_amount || '0'),
      currency: input.paymentData.currency_id || 'BRL',
      status: input.status,
      payment_method: input.paymentData.payment_method_id || null,
      payment_gateway: 'mercadopago',
      gateway_payment_id: input.paymentId,
      gateway_response: input.paymentData,
      paid_at: paidAt,
    })
    if (error) throw error
    return { created: true, justPaid: input.status === 'paid' }
  }

  if (input.status === 'paid' && existingPayment.status !== 'paid') {
    const { error } = await supabaseAdmin
      .from('dccmusic_payments')
      .update({
        status: input.status,
        gateway_response: input.paymentData,
        paid_at: new Date().toISOString(),
      })
      .eq('id', existingPayment.id)
    if (error) throw error
    return { created: false, justPaid: true }
  }

  return { created: false, justPaid: false }
}
