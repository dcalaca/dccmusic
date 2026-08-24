import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMarketingCampaignEmail } from '@/lib/dcc-emails'
import { createCampaignButtonUrl } from '@/lib/email-magic-login'
import { getEmailOptOutUrl, getOptedOutEmailSet, normalizeMarketingEmail } from '@/lib/email-opt-outs'

export const dynamic = 'force-dynamic'

const TARGET_PREFIX = 'pending-email|'
const BATCH_SIZE = 40

type Recipient = {
  id: string
  name: string
  email: string
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeDateBoundary(value: unknown, endOfDay = false) {
  const raw = cleanText(value, 40)
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (endOfDay) date.setUTCHours(23, 59, 59, 999)
    else date.setUTCHours(0, 0, 0, 0)
  }
  return date.toISOString()
}

function encodeTarget(from: string, to: string, creator: string | null | undefined) {
  return `${TARGET_PREFIX}${from}|${to}|${creator || ''}`.slice(0, 500)
}

function decodeTarget(value: unknown) {
  const raw = String(value || '')
  if (!raw.startsWith(TARGET_PREFIX)) return null
  const parts = raw.split('|')
  if (parts.length < 3) return null
  const from = parts[1]
  const to = parts[2]
  if (!from || !to) return null
  return { from, to }
}

async function getTargetRecipients(from: string, to: string) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id, name, email, email_verified, created_at')
    .not('email', 'is', null)
    .eq('email_verified', false)
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })

  if (error) throw error

  const optedOut = await getOptedOutEmailSet()
  const seen = new Set<string>()
  const recipients: Recipient[] = []

  for (const row of data || []) {
    const email = normalizeMarketingEmail((row as any).email)
    if (!email || optedOut.has(email) || seen.has(email)) continue
    seen.add(email)
    recipients.push({
      id: String((row as any).id),
      name: String((row as any).name || 'Compositor'),
      email,
    })
  }

  return recipients
}

async function getHandledEmails(campaignId: string) {
  const { data, error } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .select('recipient_email')
    .eq('campaign_id', campaignId)

  if (error) throw error
  return new Set((data || []).map((row: any) => normalizeMarketingEmail(row.recipient_email)).filter(Boolean))
}

async function recordDelivery(input: {
  campaignId: string
  recipient: Recipient
  status: 'sent' | 'failed' | 'skipped'
  providerMessageId?: string | null
  errorMessage?: string | null
}) {
  const { error } = await supabaseAdmin
    .from('admin_email_campaign_deliveries')
    .insert({
      campaign_id: input.campaignId,
      recipient_type: 'composer',
      recipient_id: input.recipient.id,
      recipient_email: input.recipient.email,
      recipient_name: input.recipient.name,
      status: input.status,
      provider_message_id: input.providerMessageId || null,
      error_message: input.errorMessage || null,
      sent_at: input.status === 'sent' ? new Date().toISOString() : null,
    })

  if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error
}

async function sendBatch(campaignId: string, requireSendingStatus: boolean) {
  const { data: campaign, error } = await supabaseAdmin
    .from('admin_email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle()

  if (error) throw error
  if (!campaign) throw new Error('Campanha não encontrada')

  const target = decodeTarget((campaign as any).created_by)
  if (!target) throw new Error('Esta campanha não é de e-mail pendente')

  if (requireSendingStatus && (campaign as any).status !== 'sending') {
    return { campaignId, totalRecipients: 0, attempted: 0, sent: 0, failed: 0, remaining: 0, paused: true }
  }

  if (!requireSendingStatus) {
    const { error: updateError } = await supabaseAdmin
      .from('admin_email_campaigns')
      .update({ status: 'sending', scheduled_at: new Date().toISOString(), next_run_at: null, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
    if (updateError) throw updateError
  }

  const recipients = await getTargetRecipients(target.from, target.to)
  const handled = await getHandledEmails(campaignId)
  const pending = recipients.filter((recipient) => !handled.has(recipient.email)).slice(0, BATCH_SIZE)

  let sent = 0
  let failed = 0

  for (const recipient of pending) {
    try {
      const trackedCtaUrl = (campaign as any).cta_label && (campaign as any).cta_url
        ? await createCampaignButtonUrl({
          campaignId,
          campaignName: (campaign as any).name,
          recipientType: 'composer',
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          ctaLabel: (campaign as any).cta_label,
          ctaUrl: (campaign as any).cta_url,
        })
        : null

      const result = await sendMarketingCampaignEmail({
        to: recipient.email,
        name: recipient.name,
        subject: (campaign as any).subject,
        preview: (campaign as any).preview,
        body: (campaign as any).body,
        ctaLabel: (campaign as any).cta_label,
        ctaUrl: trackedCtaUrl || (campaign as any).cta_url,
        unsubscribeUrl: getEmailOptOutUrl({
          email: recipient.email,
          recipientType: 'composer',
          recipientId: recipient.id,
          campaignId,
        }),
        campaignId,
        recipientType: 'composer',
        recipientId: recipient.id,
      })

      if (result.sent) {
        sent += 1
        await recordDelivery({ campaignId, recipient, status: 'sent', providerMessageId: result.id || null })
      } else {
        failed += 1
        await recordDelivery({ campaignId, recipient, status: 'skipped', errorMessage: result.reason || 'Envio ignorado' })
      }
    } catch (sendError: any) {
      failed += 1
      await recordDelivery({ campaignId, recipient, status: 'failed', errorMessage: sendError?.message || 'Erro ao enviar' })
    }
  }

  const handledAfter = await getHandledEmails(campaignId)
  const remaining = Math.max(0, recipients.filter((recipient) => !handledAfter.has(recipient.email)).length)
  const nextStatus = remaining > 0 ? 'sending' : 'sent'

  const { error: updateError } = await supabaseAdmin
    .from('admin_email_campaigns')
    .update({
      status: nextStatus,
      sent_count: Number((campaign as any).sent_count || 0) + sent,
      failed_count: Number((campaign as any).failed_count || 0) + failed,
      last_run_at: new Date().toISOString(),
      next_run_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)

  if (updateError) throw updateError

  return {
    campaignId,
    totalRecipients: recipients.length,
    attempted: pending.length,
    sent,
    failed,
    remaining,
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const from = normalizeDateBoundary(request.nextUrl.searchParams.get('from'))
    const to = normalizeDateBoundary(request.nextUrl.searchParams.get('to'), true)
    if (!from || !to) return NextResponse.json({ count: 0 })
    if (new Date(from) > new Date(to)) return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })
    const recipients = await getTargetRecipients(from, to)
    return NextResponse.json({ count: recipients.length })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao calcular destinatários' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const from = normalizeDateBoundary(body.targetFrom)
    const to = normalizeDateBoundary(body.targetTo, true)

    if (!from || !to || new Date(from) > new Date(to)) {
      return NextResponse.json({ error: 'Escolha um período válido para os cadastros pendentes.' }, { status: 400 })
    }

    const name = cleanText(body.name, 140)
    const subject = cleanText(body.subject, 180)
    const message = cleanText(body.body, 5000)
    if (!name || !subject || !message) {
      return NextResponse.json({ error: 'Informe nome, assunto e mensagem da campanha.' }, { status: 400 })
    }

    const status = body.status === 'scheduled' ? 'scheduled' : 'draft'
    const scheduledAt = status === 'scheduled' && body.scheduledAt ? new Date(body.scheduledAt).toISOString() : null

    const payload = {
      name,
      subject,
      preview: cleanText(body.preview, 220) || null,
      body: message,
      cta_label: cleanText(body.ctaLabel, 80) || null,
      cta_url: cleanText(body.ctaUrl, 500) || null,
      audience: 'composers',
      status,
      scheduled_at: scheduledAt,
      recurring_day: null,
      recurring_enabled: false,
      next_run_at: scheduledAt,
      created_by: encodeTarget(from, to, (session as any)?.user?.email),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('admin_email_campaigns')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ campaign: data, targetCount: (await getTargetRecipients(from, to)).length })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao salvar campanha de e-mail pendente' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const id = cleanText(body.id, 80)
    const action = cleanText(body.action, 30)
    if (!id) return NextResponse.json({ error: 'Campanha não informada.' }, { status: 400 })

    if (action === 'pause') {
      const { data, error } = await supabaseAdmin
        .from('admin_email_campaigns')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json({ campaign: data })
    }

    if (action === 'send') {
      return NextResponse.json({ result: await sendBatch(id, false) })
    }

    if (action === 'continue') {
      return NextResponse.json({ result: await sendBatch(id, true) })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao processar campanha de e-mail pendente' }, { status: 500 })
  }
}
