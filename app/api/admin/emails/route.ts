import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type EmailRow = {
  id: string
  source: 'transactional' | 'campaign'
  category: string
  recipient: string
  sentAt: string
  campaignId?: string | null
}

function parseDateOnly(value: string | null, fallback: Date) {
  if (!value) return fallback
  const parsed = new Date(`${value}T00:00:00-03:00`)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function dayKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function isMissingTableError(error: any, tableName: string) {
  const message = String(error?.message || '').toLowerCase()
  return Boolean(error && (message.includes(tableName.toLowerCase()) || message.includes('schema cache')))
}

async function fetchAllPages<T>(buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>) {
  const pageSize = 1000
  const all: T[] = []
  let from = 0

  for (let page = 0; page < 200; page += 1) {
    const { data, error } = await buildQuery(from, from + pageSize - 1)
    if (error) return { data: all, error }
    const rows = data || []
    all.push(...rows)
    if (rows.length < pageSize) break
    from += pageSize
  }

  return { data: all, error: null }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const startDate = parseDateOnly(searchParams.get('startDate'), monthStart)
    const endDate = parseDateOnly(searchParams.get('endDate'), now)
    const endExclusive = addDays(endDate, 1)
    const startIso = startDate.toISOString()
    const endIso = endExclusive.toISOString()

    const [transactionalResult, campaignResult] = await Promise.all([
      fetchAllPages<any>((from, to) => supabaseAdmin
        .from('dccmusic_email_events')
        .select('id, event_key, category, recipient, sent_at, created_at')
        .gte('sent_at', startIso)
        .lt('sent_at', endIso)
        .order('sent_at', { ascending: false })
        .range(from, to)),
      fetchAllPages<any>((from, to) => supabaseAdmin
        .from('admin_email_campaign_deliveries')
        .select('id, campaign_id, recipient_email, status, sent_at, created_at')
        .eq('status', 'sent')
        .gte('sent_at', startIso)
        .lt('sent_at', endIso)
        .order('sent_at', { ascending: false })
        .range(from, to)),
    ])

    const campaignTableMissing = isMissingTableError(campaignResult.error, 'admin_email_campaign_deliveries')
    if (transactionalResult.error || (!campaignTableMissing && campaignResult.error)) {
      const error = transactionalResult.error || campaignResult.error
      return NextResponse.json({ error: error?.message || 'Erro ao carregar e-mails' }, { status: 500 })
    }

    const rows: EmailRow[] = [
      ...transactionalResult.data.map(row => ({
        id: String(row.id),
        source: 'transactional' as const,
        category: row.category || row.event_key || 'sem_categoria',
        recipient: row.recipient || 'não informado',
        sentAt: row.sent_at || row.created_at,
      })),
      ...(campaignTableMissing ? [] : campaignResult.data).map(row => ({
        id: String(row.id),
        source: 'campaign' as const,
        category: 'admin_email_campaign',
        recipient: row.recipient_email || 'não informado',
        sentAt: row.sent_at || row.created_at,
        campaignId: row.campaign_id || null,
      })),
    ].filter(row => row.sentAt)

    rows.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())

    const daily = new Map<string, { date: string; total: number; transactional: number; campaigns: number }>()
    let cursor = new Date(startDate)
    while (cursor < endExclusive) {
      const key = dayKey(cursor.toISOString())
      if (key) daily.set(key, { date: key, total: 0, transactional: 0, campaigns: 0 })
      cursor = addDays(cursor, 1)
    }

    const categories = new Map<string, number>()
    const recipients = new Map<string, number>()

    for (const row of rows) {
      const key = dayKey(row.sentAt)
      const bucket = daily.get(key)
      if (bucket) {
        bucket.total += 1
        if (row.source === 'campaign') bucket.campaigns += 1
        else bucket.transactional += 1
      }
      categories.set(row.category, (categories.get(row.category) || 0) + 1)
      recipients.set(row.recipient, (recipients.get(row.recipient) || 0) + 1)
    }

    const total = rows.length
    const transactional = rows.filter(row => row.source === 'transactional').length
    const campaigns = total - transactional
    const uniqueRecipients = recipients.size
    const activeDays = Array.from(daily.values()).filter(item => item.total > 0).length
    const averagePerActiveDay = activeDays > 0 ? total / activeDays : 0
    const peak = Array.from(daily.values()).reduce((best, item) => item.total > best.total ? item : best, { date: '', total: 0, transactional: 0, campaigns: 0 })

    return NextResponse.json({
      period: {
        startDate: dayKey(startDate.toISOString()),
        endDate: dayKey(endDate.toISOString()),
      },
      totals: {
        total,
        transactional,
        campaigns,
        uniqueRecipients,
        activeDays,
        averagePerActiveDay,
        peakDay: peak.date || null,
        peakCount: peak.total,
      },
      series: Array.from(daily.values()),
      categories: Array.from(categories.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      recipients: Array.from(recipients.entries())
        .map(([recipient, count]) => ({ recipient, count }))
        .sort((a, b) => b.count - a.count),
      rows,
      meta: {
        fetchedRows: rows.length,
        pagination: 'all-pages',
        supabasePageSize: 1000,
        campaignTableAvailable: !campaignTableMissing,
        checkedAt: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado no gerenciador de e-mails' }, { status: 500 })
  }
}
