'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiCalendar, FiCheckCircle, FiClock, FiLoader, FiMail, FiPauseCircle, FiSend } from 'react-icons/fi'

type Campaign = {
  id: string
  name: string
  subject: string
  preview: string | null
  body: string
  cta_label: string | null
  cta_url: string | null
  audience: 'all' | 'composers' | 'site_users'
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused'
  scheduled_at: string | null
  last_run_at: string | null
  next_run_at: string | null
  sent_count: number
  failed_count: number
  target_mode?: 'audience' | 'pending_email'
  target_from?: string | null
  target_to?: string | null
  target_count?: number
  frozen_at?: string | null
  deliveries?: { sent: number; failed: number; skipped: number; pending: number }
  clicks?: { total: number; human: number; bot: number; unknown: number }
}

type Idea = {
  label: string
  name: string
  subject: string
  preview: string
  body: string
  ctaLabel: string
  ctaUrl: string
  targetMode?: 'audience' | 'pending_email'
}

const campaignIdeas: Idea[] = [
  {
    label: 'Cupom exclusivo',
    name: 'Cupom para usuários DCC',
    subject: 'Cupom exclusivo para você criar mais músicas',
    preview: 'Use seu cupom especial e aproveite o DCC Studio IA.',
    body: 'Para você que já é usuário da DCC Music, preparamos um cupom exclusivo.\n\nUse o cupom "CUPOM" e aproveite o desconto para criar novas músicas no Studio IA.\n\nÉ uma boa hora para tirar aquela letra do papel e transformar em música pronta.',
    ctaLabel: 'Usar cupom agora',
    ctaUrl: 'https://www.dccmusic.online/compositores/admin/studio-ia/recarga',
  },
  {
    label: 'Todo dia 15',
    name: 'Lembrete do dia 15',
    subject: 'Ideia do mês: transforme uma letra em música',
    preview: 'Um lembrete rápido para continuar criando.',
    body: 'Passando para lembrar: uma música nova pode nascer de uma ideia simples.\n\nSe você tem uma letra guardada, uma frase ou um refrão, entre no DCC Studio IA e crie uma nova versão este mês.',
    ctaLabel: 'Abrir Studio IA',
    ctaUrl: 'https://www.dccmusic.online/compositores/admin/studio-ia',
  },
  {
    label: 'Usuário parado',
    name: 'Reativar usuários parados',
    subject: 'Sua próxima música pode estar a um clique',
    preview: 'Volte ao Studio IA e crie uma nova música.',
    body: 'Faz um tempo que você não cria uma música nova na DCC Music.\n\nO Studio IA está pronto para te ajudar a transformar ideias em letras, capas e músicas completas.\n\nEntre no seu painel e continue de onde parou.',
    ctaLabel: 'Continuar criando',
    ctaUrl: 'https://www.dccmusic.online/compositores/admin/studio-ia/projetos',
  },
  {
    label: 'Novidades',
    name: 'Novidades do Studio IA',
    subject: 'Novidades para melhorar suas músicas',
    preview: 'Veja recursos que podem ajudar na sua próxima criação.',
    body: 'Tem novidade no DCC Studio IA.\n\nAgora ficou mais fácil organizar versões, escolher a melhor música gerada e publicar seu projeto no DCC Music.\n\nAcesse seu painel e teste em uma nova criação.',
    ctaLabel: 'Ver novidades',
    ctaUrl: 'https://www.dccmusic.online/compositores/admin/studio-ia',
  },
  {
    label: 'Partitura e Cifra',
    name: 'Novidade Partitura e Cifra',
    subject: 'Sua música agora vira cifra e partitura no DCC Music',
    preview: 'Transforme suas faixas do Studio IA em material para tocar e estudar.',
    body: 'Tem novidade no DCC Music.\n\nAgora você pode transformar suas músicas em Partitura e Cifra: partitura em PDF, MusicXML e letra cifrada para violão.\n\nFunciona com músicas que você já criou no Studio IA ou com um áudio que você enviar.',
    ctaLabel: 'Gerar partitura e cifra',
    ctaUrl: 'https://www.dccmusic.online/transcricao-musical',
  },
  {
    label: 'E-mail pendente',
    name: 'Recuperar cadastros com e-mail pendente',
    subject: 'Falta só um passo para liberar sua conta na DCC Music',
    preview: 'Conclua seu cadastro e crie sua primeira música grátis.',
    body: 'Oi! Vimos que você começou seu cadastro na DCC Music, mas ele ainda está pendente.\n\nConclua seu acesso e entre no Studio IA para transformar sua ideia em música. Sua primeira música é grátis.\n\nSe você já concluiu o cadastro, pode ignorar este e-mail.',
    ctaLabel: 'Concluir meu cadastro',
    ctaUrl: 'https://www.dccmusic.online/login',
    targetMode: 'pending_email',
  },
]

const audienceLabels: Record<string, string> = {
  all: 'Toda a base',
  composers: 'Compositores',
  site_users: 'Usuários do site',
}

const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  sending: 'Enviando',
  sent: 'Enviada',
  paused: 'Pausada',
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Não definido'
  return new Date(value).toLocaleString('pt-BR')
}

function localDateTimeValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function localDateValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function defaultPendingRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 2)
  return { from: localDateValue(from), to: localDateValue(to) }
}

export default function EmailCampaignsAdmin() {
  const initialPendingRange = useMemo(defaultPendingRange, [])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [audienceCounts, setAudienceCounts] = useState({ all: 0, composers: 0, site_users: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [processingId, setProcessingId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [preview, setPreview] = useState('')
  const [body, setBody] = useState('')
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [audience, setAudience] = useState<'all' | 'composers' | 'site_users'>('all')
  const [targetMode, setTargetMode] = useState<'audience' | 'pending_email'>('audience')
  const [targetFrom, setTargetFrom] = useState(initialPendingRange.from)
  const [targetTo, setTargetTo] = useState(initialPendingRange.to)
  const [targetCount, setTargetCount] = useState<number | null>(null)
  const [targetCountLoading, setTargetCountLoading] = useState(false)
  const [createScheduled, setCreateScheduled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState(localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)))

  const selectedAudienceCount = targetMode === 'pending_email' ? (targetCount ?? 0) : (audienceCounts[audience] || 0)
  const previewLines = useMemo(() => body.split('\n').filter(Boolean).slice(0, 4), [body])

  const loadCampaigns = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const response = await fetch('/api/admin/email-campaigns', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar campanhas')
      setCampaigns(data.campaigns || [])
      setAudienceCounts(data.audienceCounts || { all: 0, composers: 0, site_users: 0 })
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar campanhas')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => { void loadCampaigns() }, [])

  useEffect(() => {
    if (targetMode !== 'pending_email' || !targetFrom || !targetTo) {
      setTargetCount(null)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setTargetCountLoading(true)
        const params = new URLSearchParams({
          mode: 'count',
          targetMode: 'pending_email',
          from: targetFrom,
          to: targetTo,
        })
        const response = await fetch(`/api/admin/email-campaigns?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Erro ao calcular destinatários')
        setTargetCount(Number(data.count) || 0)
      } catch (err: any) {
        if (err?.name !== 'AbortError') setTargetCount(null)
      } finally {
        setTargetCountLoading(false)
      }
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [targetMode, targetFrom, targetTo])

  const applyIdea = (idea: Idea) => {
    setName(idea.name)
    setSubject(idea.subject)
    setPreview(idea.preview)
    setBody(idea.body)
    setCtaLabel(idea.ctaLabel)
    setCtaUrl(idea.ctaUrl)
    if (idea.targetMode === 'pending_email') {
      const range = defaultPendingRange()
      setTargetMode('pending_email')
      setTargetFrom(range.from)
      setTargetTo(range.to)
      setAudience('composers')
      setCreateScheduled(false)
    } else {
      setTargetMode('audience')
    }
  }

  const resetForm = () => {
    setName('')
    setSubject('')
    setPreview('')
    setBody('')
    setCtaLabel('')
    setCtaUrl('')
    setAudience('all')
    setTargetMode('audience')
    setCreateScheduled(false)
    setScheduledAt(localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)))
  }

  const createCampaign = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const response = await fetch('/api/admin/email-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, subject, preview, body, ctaLabel, ctaUrl, audience,
          targetMode,
          targetFrom: targetMode === 'pending_email' ? targetFrom : null,
          targetTo: targetMode === 'pending_email' ? targetTo : null,
          status: createScheduled ? 'scheduled' : 'draft',
          scheduledAt: createScheduled ? scheduledAt : null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar campanha')
      setSuccess(createScheduled ? 'Campanha salva e agendada.' : 'Campanha salva como rascunho.')
      resetForm()
      await loadCampaigns()
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar campanha')
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (campaign: Campaign, action: 'send' | 'pause') => {
    const sentSoFar = campaign.deliveries?.sent || campaign.sent_count || 0
    const pending = campaign.deliveries?.pending || 0
    const targetLabel = campaign.target_mode === 'pending_email'
      ? `${campaign.target_count || pending || 'os'} cadastros com e-mail pendente`
      : audienceLabels[campaign.audience]

    const confirmMessage = action === 'send'
      ? sentSoFar > 0 || pending > 0
        ? `Enviar o próximo lote da campanha "${campaign.name}"? Quem já recebeu não recebe novamente.`
        : `Iniciar a campanha "${campaign.name}" para ${targetLabel}? A lista será congelada antes do primeiro envio.`
      : `Pausar a campanha "${campaign.name}"?`

    if (!confirm(confirmMessage)) return
    setProcessingId(campaign.id)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/admin/email-campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campaign.id, action }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao processar campanha')

      if (action === 'send') {
        const result = data.result
        setSuccess(
          result.remaining > 0
            ? `Lote concluído: ${result.sent} enviado(s), ${result.failed} falha(s). Restam ${result.remaining}. Nada continuará sozinho; envie o próximo lote quando quiser.`
            : `Campanha concluída: ${result.sent} enviado(s) neste lote, ${result.failed} falha(s).`
        )
      } else {
        setSuccess('Campanha pausada.')
      }
      await loadCampaigns()
    } catch (err: any) {
      setError(err.message || 'Erro ao processar campanha')
    } finally {
      setProcessingId('')
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-fuchsia-800/60 bg-gradient-to-br from-gray-950 via-black to-fuchsia-950/30 p-5 sm:p-8">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-fuchsia-500/40 bg-fuchsia-950/40 px-3 py-1 text-sm text-fuchsia-100"><FiMail /> CRM de e-mails</div>
            <h1 className="text-3xl font-black text-white">Campanhas e relacionamento</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-400">
              Crie campanhas, filtre públicos, acompanhe envios e cliques. Antes do primeiro disparo, a lista de destinatários é congelada. Cada clique em enviar processa no máximo 40 e-mails e nunca continua sozinho.
            </p>
          </div>
          <div className="grid gap-2 rounded-2xl border border-gray-800 bg-black/40 p-4 text-sm text-gray-300 sm:grid-cols-3 lg:min-w-[28rem]">
            <p><strong className="block text-white">{audienceCounts.all}</strong>Toda a base</p>
            <p><strong className="block text-white">{audienceCounts.composers}</strong>Compositores</p>
            <p><strong className="block text-white">{audienceCounts.site_users}</strong>Usuários</p>
          </div>
        </div>

        {error && <div className="mb-5 rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}
        {success && <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-800 bg-green-950/30 p-4 text-sm text-green-200"><FiCheckCircle /> {success}</div>}

        <div className="mb-5 rounded-2xl border border-gray-800 bg-black/30 p-4">
          <p className="mb-3 text-sm font-bold text-gray-200">Ideias prontas para começar</p>
          <div className="flex flex-wrap gap-2">
            {campaignIdeas.map((idea) => (
              <button key={idea.label} type="button" onClick={() => applyIdea(idea)} className={`rounded-full border px-4 py-2 text-sm font-bold ${idea.targetMode === 'pending_email' && targetMode === 'pending_email' ? 'border-amber-400 bg-amber-950/40 text-amber-100' : 'border-fuchsia-800/70 bg-fuchsia-950/25 text-fuchsia-100 hover:border-fuchsia-400'}`}>
                {idea.label}
              </button>
            ))}
          </div>

          {targetMode === 'pending_email' && (
            <div className="mt-4 rounded-xl border border-amber-700/60 bg-amber-950/20 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-sm font-bold text-amber-100">Cadastros com e-mail pendente</div>
                  <p className="mt-1 text-xs text-gray-400">Só entram compositores que ainda não confirmaram o e-mail e que se cadastraram no período escolhido.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[{ label: 'Hoje', days: 0 }, { label: 'Últimos 3 dias', days: 2 }, { label: 'Últimos 7 dias', days: 6 }, { label: 'Últimos 30 dias', days: 29 }].map((preset) => (
                    <button key={preset.label} type="button" onClick={() => {
                      const end = new Date(); const start = new Date(); start.setDate(start.getDate() - preset.days)
                      setTargetFrom(localDateValue(start)); setTargetTo(localDateValue(end))
                    }} className="rounded-lg border border-gray-700 bg-black/50 px-3 py-2 text-xs font-bold text-gray-200 hover:border-amber-500">
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="block"><span className="mb-1 block text-xs font-bold text-gray-300">Cadastrados a partir de</span><input type="date" value={targetFrom} onChange={(e) => setTargetFrom(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white" /></label>
                <label className="block"><span className="mb-1 block text-xs font-bold text-gray-300">Até</span><input type="date" value={targetTo} onChange={(e) => setTargetTo(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white" /></label>
                <div className="rounded-lg border border-gray-700 bg-black/50 px-4 py-2.5 text-sm text-gray-300"><FiClock className="mr-2 inline" />{targetCountLoading ? 'Calculando...' : `${targetCount ?? 0} destinatário(s)`}</div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={createCampaign} className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <div className="space-y-4">
            <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-200">Nome interno da campanha</span><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3" placeholder="Ex: Cupom Junho" /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-200">Assunto do e-mail</span><input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3" placeholder="Ex: Cupom exclusivo para você" /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-200">Resumo curto</span><input value={preview} onChange={(e) => setPreview(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3" placeholder="Aparece como prévia em alguns apps de e-mail" /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-200">Mensagem</span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="w-full resize-none rounded-xl border border-gray-700 bg-black px-4 py-3" placeholder="Digite o texto do e-mail..." /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-200">Texto do botão</span><input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3" /></label>
              <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-200">Link do botão</span><input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3" /></label>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-gray-200">Enviar para</span>
                <select value={audience} onChange={(e) => { setAudience(e.target.value as any); setTargetMode('audience') }} disabled={targetMode === 'pending_email'} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 disabled:opacity-60">
                  <option value="all">Toda a base ({audienceCounts.all})</option>
                  <option value="composers">Compositores ({audienceCounts.composers})</option>
                  <option value="site_users">Usuários do site ({audienceCounts.site_users})</option>
                </select>
              </label>
              <p className="mt-2 text-xs text-gray-500">Estimativa atual: {selectedAudienceCount} destinatário(s). A lista será congelada no primeiro envio.</p>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
              <label className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-200"><input type="checkbox" checked={createScheduled} onChange={(e) => setCreateScheduled(e.target.checked)} /> Agendar envio</label>
              <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-200">Data e hora</span><input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} disabled={!createScheduled} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 disabled:opacity-50" /></label>
              <p className="mt-2 text-xs text-gray-500">Agendamento envia apenas um lote por execução. Recorrência mensal está temporariamente desativada até a nova rotina de CRM ficar validada.</p>
            </div>

            <div className="rounded-2xl border border-fuchsia-800/50 bg-fuchsia-950/15 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-fuchsia-200">Prévia</p>
              <h3 className="font-black text-white">{subject || 'Assunto do e-mail'}</h3>
              <p className="mt-2 text-xs text-gray-400">{preview || 'Resumo curto do e-mail'}</p>
              <div className="mt-4 rounded-xl border border-gray-800 bg-black/40 p-4 text-sm leading-relaxed text-gray-200">
                {previewLines.length > 0 ? previewLines.map((line, index) => <p key={`${line}-${index}`} className="mb-2">{line}</p>) : <p>A mensagem aparecerá aqui.</p>}
                {ctaLabel && <span className="mt-3 inline-flex rounded-lg bg-fuchsia-700 px-3 py-2 text-xs font-bold text-white">{ctaLabel}</span>}
              </div>
            </div>

            <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-fuchsia-600 px-5 py-3 font-bold text-white disabled:opacity-60">
              {saving ? <FiLoader className="animate-spin" /> : createScheduled ? <FiCalendar /> : <FiMail />}
              {createScheduled ? 'Salvar campanha agendada' : 'Salvar rascunho'}
            </button>
          </aside>
        </form>
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-2xl font-black">Campanhas criadas</h2><button type="button" onClick={() => loadCampaigns()} className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-bold text-gray-300">Atualizar</button></div>
        {loading ? <div className="flex justify-center py-10"><FiLoader className="h-8 w-8 animate-spin text-primary-300" /></div> : campaigns.length === 0 ? <p className="py-10 text-center text-gray-500">Nenhuma campanha criada ainda.</p> : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const sentCount = campaign.deliveries?.sent || campaign.sent_count || 0
              const failedCount = campaign.deliveries?.failed || campaign.failed_count || 0
              const skippedCount = campaign.deliveries?.skipped || 0
              const pendingCount = campaign.deliveries?.pending || 0
              const humanClicks = campaign.clicks?.human || 0
              const totalClicks = campaign.clicks?.total || 0
              const isFrozen = Boolean(campaign.frozen_at)
              const estimatedTotal = isFrozen ? Number(campaign.target_count || sentCount + failedCount + skippedCount + pendingCount) : (campaign.target_mode === 'pending_email' ? Number(campaign.target_count || 0) : audienceCounts[campaign.audience] || 0)
              const remaining = isFrozen ? pendingCount : estimatedTotal
              const canSend = campaign.status !== 'sent' && campaign.status !== 'scheduled'
              const sendLabel = isFrozen && (sentCount > 0 || failedCount > 0) ? 'Enviar próximo lote' : 'Iniciar envio'

              return (
                <article key={campaign.id} className="rounded-2xl border border-gray-800 bg-black/35 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-xs font-bold text-gray-200">{statusLabels[campaign.status]}</span>
                        <span className="rounded-full border border-fuchsia-800 bg-fuchsia-950/30 px-3 py-1 text-xs font-bold text-fuchsia-100">{campaign.target_mode === 'pending_email' ? 'E-mail pendente' : audienceLabels[campaign.audience]}</span>
                        {isFrozen && <span className="rounded-full border border-emerald-800 bg-emerald-950/30 px-3 py-1 text-xs font-bold text-emerald-100">Lista congelada: {campaign.target_count}</span>}
                      </div>
                      <h3 className="text-lg font-black text-white">{campaign.name}</h3>
                      <p className="mt-1 text-sm font-semibold text-gray-300">{campaign.subject}</p>
                      <p className="mt-2 text-xs text-gray-500">Próximo envio: {formatDateTime(campaign.next_run_at || campaign.scheduled_at)} · Enviados: {sentCount} · Restantes: {remaining} · Falhas: {failedCount}</p>
                      <p className="mt-1 text-xs text-fuchsia-200">Cliques no botão: {humanClicks} humano(s) · {totalClicks} total(is)</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canSend && <button onClick={() => runAction(campaign, 'send')} disabled={Boolean(processingId)} className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{processingId === campaign.id ? <FiLoader className="animate-spin" /> : <FiSend />}{sendLabel}</button>}
                      {(campaign.status === 'scheduled' || campaign.status === 'sending') && <button onClick={() => runAction(campaign, 'pause')} disabled={Boolean(processingId)} className="inline-flex items-center gap-2 rounded-xl border border-yellow-800 bg-yellow-950/30 px-4 py-2 text-sm font-bold text-yellow-100 disabled:opacity-60"><FiPauseCircle /> Pausar</button>}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-blue-800/50 bg-blue-950/20 p-5 text-sm leading-relaxed text-blue-100">
        <p className="font-bold">Segurança do CRM</p>
        <p className="mt-2">A lista é congelada antes do primeiro envio, cada destinatário fica registrado individualmente e cada clique dispara no máximo 40 e-mails. Não existe continuação automática no navegador.</p>
      </div>
    </section>
  )
}
