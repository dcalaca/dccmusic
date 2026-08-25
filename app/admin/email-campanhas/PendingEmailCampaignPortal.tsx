'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiClock, FiMail } from 'react-icons/fi'

const STORAGE_KEY = 'dccPendingEmailTarget'
const TARGET_PREFIX = 'pending-email|'

type PendingCampaignCard = {
  id: string
  name: string
  subject: string
  targetCount: number
  remaining: number
}

function dateValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function defaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 2)
  return { from: dateValue(from), to: dateValue(to) }
}

function findIdeasPanel() {
  const paragraphs = Array.from(document.querySelectorAll('p'))
  const heading = paragraphs.find((element) => element.textContent?.trim() === 'Ideias prontas para começar')
  return heading?.parentElement || null
}

function setReactField(labelText: string, value: string) {
  const labels = Array.from(document.querySelectorAll('label'))
  const label = labels.find((item) => item.textContent?.includes(labelText))
  const field = label?.querySelector('input, textarea, select') as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
  if (!field) return

  const prototype = field instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  setter?.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.dispatchEvent(new Event('change', { bubbles: true }))
}

function uncheckByLabel(labelText: string) {
  const labels = Array.from(document.querySelectorAll('label'))
  const label = labels.find((item) => item.textContent?.includes(labelText))
  const input = label?.querySelector('input[type="checkbox"]') as HTMLInputElement | null
  if (!input || !input.checked) return
  input.click()
}

function decodeTarget(value: unknown) {
  const raw = String(value || '')
  if (!raw.startsWith(TARGET_PREFIX)) return null
  const parts = raw.split('|')
  if (parts.length < 3 || !parts[1] || !parts[2]) return null
  return { from: parts[1], to: parts[2] }
}

function patchCampaignCards(cards: PendingCampaignCard[]) {
  if (cards.length === 0) return
  const articles = Array.from(document.querySelectorAll('article'))

  for (const card of cards) {
    const article = articles.find((item) => {
      const title = item.querySelector('h3')?.textContent?.trim()
      const texts = Array.from(item.querySelectorAll('p')).map((node) => node.textContent?.trim() || '')
      return title === card.name && texts.includes(card.subject)
    })
    if (!article) continue

    const statsLine = Array.from(article.querySelectorAll('p')).find((node) => node.textContent?.includes('Restantes estimados:'))
    if (!statsLine?.textContent) continue

    const nextText = statsLine.textContent.replace(/Restantes estimados:\s*\d+/i, `Restantes estimados: ${card.remaining}`)
    if (nextText !== statsLine.textContent) statsLine.textContent = nextText

    if (!article.querySelector('[data-pending-target-count="1"]')) {
      const badges = article.querySelector('div.mb-2.flex.flex-wrap')
      if (badges) {
        const badge = document.createElement('span')
        badge.dataset.pendingTargetCount = '1'
        badge.className = 'rounded-full border border-amber-700 bg-amber-950/30 px-3 py-1 text-xs font-bold text-amber-100'
        badge.textContent = `Filtro pendente: ${card.targetCount}`
        badges.appendChild(badge)
      }
    }
  }
}

export default function PendingEmailCampaignPortal() {
  const initialRange = useMemo(defaultRange, [])
  const [ideasPanel, setIdeasPanel] = useState<HTMLElement | null>(null)
  const [buttonRow, setButtonRow] = useState<HTMLElement | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [count, setCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)
  const [campaignCards, setCampaignCards] = useState<PendingCampaignCard[]>([])

  useEffect(() => {
    const resolveTargets = () => {
      const panel = findIdeasPanel()
      if (!panel) return
      setIdeasPanel(panel)
      const row = Array.from(panel.children).find((child) => child.classList.contains('flex')) as HTMLElement | undefined
      if (row) setButtonRow(row)
    }

    resolveTargets()
    const observer = new MutationObserver(resolveTargets)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!buttonRow) return

    const handler = (event: Event) => {
      const button = (event.target as HTMLElement | null)?.closest('button')
      if (!button || button.dataset.pendingEmailIdea === '1') return
      setEnabled(false)
      window.localStorage.removeItem(STORAGE_KEY)
    }

    buttonRow.addEventListener('click', handler)
    return () => buttonRow.removeEventListener('click', handler)
  }, [buttonRow])

  useEffect(() => {
    if (!enabled || !from || !to) {
      setCount(null)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setCountLoading(true)
        const params = new URLSearchParams({ from, to })
        const response = await fetch(`/api/admin/email-campaigns/pending?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Erro ao calcular destinatários')
        setCount(Number(data.count) || 0)
      } catch (error: any) {
        if (error?.name !== 'AbortError') setCount(null)
      } finally {
        setCountLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [enabled, from, to])

  useEffect(() => {
    if (!enabled) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ from, to }))
  }, [enabled, from, to])

  useEffect(() => {
    let cancelled = false

    const loadPendingCards = async () => {
      try {
        const response = await fetch('/api/admin/email-campaigns', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok || cancelled) return

        const pendingCampaigns = (data.campaigns || [])
          .map((campaign: any) => ({ campaign, target: decodeTarget(campaign.created_by) }))
          .filter((item: any) => item.target)

        const nextCards = await Promise.all(pendingCampaigns.map(async ({ campaign, target }: any) => {
          const params = new URLSearchParams({ from: target.from, to: target.to })
          const targetResponse = await fetch(`/api/admin/email-campaigns/pending?${params.toString()}`, { cache: 'no-store' })
          const targetData = await targetResponse.json().catch(() => ({}))
          const targetCount = targetResponse.ok ? Number(targetData.count) || 0 : 0
          const sent = Number(campaign.deliveries?.sent || campaign.sent_count || 0)
          const skipped = Number(campaign.deliveries?.skipped || 0)
          return {
            id: String(campaign.id),
            name: String(campaign.name || ''),
            subject: String(campaign.subject || ''),
            targetCount,
            remaining: Math.max(0, targetCount - sent - skipped),
          }
        }))

        if (!cancelled) setCampaignCards(nextCards)
      } catch (error) {
        console.warn('[PENDING EMAIL CAMPAIGN] Não foi possível corrigir a estimativa visual:', error)
      }
    }

    void loadPendingCards()
    const interval = window.setInterval(loadPendingCards, 15000)
    const onProgress = () => void loadPendingCards()
    window.addEventListener('dcc-pending-email-progress', onProgress)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('dcc-pending-email-progress', onProgress)
    }
  }, [])

  useEffect(() => {
    patchCampaignCards(campaignCards)
    const observer = new MutationObserver(() => patchCampaignCards(campaignCards))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [campaignCards])

  const activateIdea = () => {
    const range = defaultRange()
    setFrom(range.from)
    setTo(range.to)
    setEnabled(true)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(range))

    setReactField('Nome interno da campanha', 'Recuperar cadastros com e-mail pendente')
    setReactField('Assunto do e-mail', 'Falta só um passo para liberar sua conta na DCC Music')
    setReactField('Resumo curto', 'Conclua seu cadastro e crie sua primeira música grátis.')
    setReactField(
      'Mensagem',
      'Oi! Vimos que você começou seu cadastro na DCC Music, mas ele ainda está pendente.\n\nConclua seu acesso e entre no Studio IA para transformar sua ideia em música. Sua primeira música é grátis.\n\nSe você já concluiu o cadastro, pode ignorar este e-mail.'
    )
    setReactField('Texto do botão', 'Concluir meu cadastro')
    setReactField('Link do botão', 'https://www.dccmusic.online/login')
    setReactField('Enviar para', 'composers')
    uncheckByLabel('Salvar já agendada')
    uncheckByLabel('Repetir todo mês')
  }

  const ideaButton = buttonRow ? createPortal(
    <button
      type="button"
      data-pending-email-idea="1"
      onClick={activateIdea}
      className={`rounded-full border px-4 py-2 text-sm font-bold ${enabled ? 'border-amber-400 bg-amber-950/50 text-amber-100' : 'border-fuchsia-800/70 bg-fuchsia-950/25 text-fuchsia-100 hover:border-fuchsia-400'}`}
    >
      E-mail pendente
    </button>,
    buttonRow,
  ) : null

  const controls = ideasPanel && enabled ? createPortal(
    <div className="mt-4 rounded-xl border border-amber-700/60 bg-amber-950/20 p-4" data-pending-email-controls="1">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-amber-100"><FiMail /> Cadastros com e-mail pendente</div>
          <p className="mt-1 text-xs text-gray-400">Escolha quando o compositor se cadastrou. Só entram contas com e-mail ainda não confirmado.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Hoje', days: 0 },
            { label: 'Últimos 3 dias', days: 2 },
            { label: 'Últimos 7 dias', days: 6 },
            { label: 'Últimos 30 dias', days: 29 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                const end = new Date()
                const start = new Date()
                start.setDate(start.getDate() - preset.days)
                setFrom(dateValue(start))
                setTo(dateValue(end))
              }}
              className="rounded-lg border border-gray-700 bg-black/50 px-3 py-2 text-xs font-bold text-gray-200 hover:border-amber-500"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-gray-300">Cadastrados a partir de</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-amber-400" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-gray-300">Até</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-amber-400" />
        </label>
        <div className="rounded-lg border border-gray-700 bg-black/50 px-4 py-2.5 text-sm text-gray-300">
          <span className="flex items-center gap-2"><FiClock /> {countLoading ? 'Calculando...' : `${count ?? 0} destinatário(s)`}</span>
        </div>
      </div>
    </div>,
    ideasPanel,
  ) : null

  return <>{ideaButton}{controls}</>
}
