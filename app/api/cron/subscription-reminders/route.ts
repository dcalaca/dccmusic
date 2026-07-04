import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendSubscriptionExpirationReminderEmail } from '@/lib/dcc-emails'

export const dynamic = 'force-dynamic'

function startOfTargetDay(daysFromNow: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + daysFromNow)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function endOfTargetDay(daysFromNow: number) {
  const date = startOfTargetDay(daysFromNow)
  date.setUTCDate(date.getUTCDate() + 1)
  return date
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const reminderDays = [7, 3, 1]
    let sent = 0
    const errors: string[] = []

    for (const daysBefore of reminderDays) {
      const { data: subscriptions, error } = await supabaseAdmin
        .from('dccmusic_subscriptions')
        .select(`
          id,
          end_date,
          composer:dccmusic_composers(id, name, email),
          plan:dccmusic_plans(name)
        `)
        .eq('status', 'active')
        .gte('end_date', startOfTargetDay(daysBefore).toISOString())
        .lt('end_date', endOfTargetDay(daysBefore).toISOString())

      if (error) throw error

      for (const subscription of subscriptions || []) {
        const composer = Array.isArray((subscription as any).composer)
          ? (subscription as any).composer[0]
          : (subscription as any).composer
        const plan = Array.isArray((subscription as any).plan)
          ? (subscription as any).plan[0]
          : (subscription as any).plan

        if (!composer?.email) continue

        const result = await sendSubscriptionExpirationReminderEmail({
          composerId: composer.id,
          name: composer.name || 'Compositor',
          email: composer.email,
          subscriptionId: (subscription as any).id,
          planName: plan?.name || 'Plano DCC Music',
          expiresAt: (subscription as any).end_date,
          daysBefore,
        }).catch((emailError) => {
          errors.push(emailError?.message || 'Erro ao enviar lembrete')
          return null
        })

        if (result?.sent) sent += 1
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      errors,
      checkedDays: reminderDays,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[CRON SUBSCRIPTION REMINDERS] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao enviar lembretes de vencimento' },
      { status: 500 }
    )
  }
}
