import { sendAdminStudioAlertEmail } from './dcc-emails'
import { supabaseAdmin } from './supabase'

export type SunoCreditBalance = {
  configured: boolean
  availableCredits: number | null
  error: string | null
  checkedAt: string
}

export function getSunoLowCreditThreshold() {
  return Number(process.env.SUNO_LOW_CREDIT_ALERT_THRESHOLD || '600') || 600
}

export async function getSunoCreditBalance(): Promise<SunoCreditBalance> {
  const apiKey = process.env.SUNOAPI_KEY
  if (!apiKey) {
    return {
      configured: false,
      availableCredits: null,
      error: 'API musical não configurada',
      checkedAt: new Date().toISOString(),
    }
  }

  try {
    const response = await fetch('https://api.sunoapi.org/api/v1/generate/credit', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.code !== 200) {
      return {
        configured: true,
        availableCredits: null,
        error: payload?.msg || 'Não foi possível consultar o saldo da IA musical',
        checkedAt: new Date().toISOString(),
      }
    }

    return {
      configured: true,
      availableCredits: Number(payload.data) || 0,
      error: null,
      checkedAt: new Date().toISOString(),
    }
  } catch (error: any) {
    return {
      configured: true,
      availableCredits: null,
      error: error.message || 'Erro ao consultar saldo da IA musical',
      checkedAt: new Date().toISOString(),
    }
  }
}

function getSaoPauloDayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

async function hasAlreadySentAlert(eventKey: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_email_events')
      .select('id')
      .eq('event_key', eventKey)
      .maybeSingle()

    if (error) return false
    return Boolean(data?.id)
  } catch {
    return false
  }
}

export async function maybeSendSunoLowCreditAlert(balance: SunoCreditBalance) {
  const threshold = getSunoLowCreditThreshold()
  const availableCredits = balance.availableCredits

  if (!balance.configured) {
    return { sent: false, reason: 'suno_not_configured', threshold }
  }

  if (balance.error || availableCredits == null) {
    return { sent: false, reason: 'suno_balance_unavailable', threshold, error: balance.error }
  }

  if (availableCredits >= threshold) {
    return { sent: false, reason: 'balance_above_threshold', threshold, availableCredits }
  }

  const eventKey = `suno-low-credit/${getSaoPauloDayKey()}/${threshold}`
  if (await hasAlreadySentAlert(eventKey)) {
    return { sent: false, reason: 'already_sent_today', threshold, availableCredits }
  }

  const result = await sendAdminStudioAlertEmail({
    title: 'Alerta: saldo Suno abaixo do limite',
    message: `O saldo atual da Suno está em ${availableCredits.toLocaleString('pt-BR')} créditos, abaixo do limite configurado de ${threshold.toLocaleString('pt-BR')} créditos.`,
    eventKey,
    metadata: {
      provider: 'suno',
      availableCredits,
      threshold,
      checkedAt: balance.checkedAt,
    },
  })

  return {
    sent: result.sent,
    reason: result.sent ? 'sent' : result.reason || 'not_sent',
    threshold,
    availableCredits,
  }
}
