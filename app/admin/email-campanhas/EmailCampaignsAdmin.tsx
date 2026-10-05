'use client'

import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FiCalendar, FiCheckCircle, FiClock, FiEye, FiEyeOff, FiLoader, FiMail, FiPauseCircle, FiSend, FiX } from 'react-icons/fi'

type Campaign = {
  id: string
  name: string
  subject: string
  preview: string | null
  body: string
  cta_label: string | null
  cta_url: string | null
  audience: 'all' | 'composers' | 'site_users'
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled'
  scheduled_at: string | null
  last_run_at: string | null
  next_run_at: string | null
  sent_count: number
  failed_count: number
  target_mode?: 'audience' | 'pending_email' | 'inactive'
  target_from?: string | null
  target_to?: string | null
  target_country?: string | null
  target_count?: number
  frozen_at?: string | null
  exclude_previously_sent?: boolean
  sent_filter_from?: string | null
  sent_filter_to?: string | null
  is_hidden?: boolean
  deliveries?: { sent: number; failed: number; skipped: number; pending: number; reserved?: number }
  clicks?: { total: number; human: number; bot: number; unknown: number }
}

type LanguageCounts = { pt: number; es: number; en: number }

type Idea = {
  label: string
  name: string
  subject: string
  preview: string
  body: string
  ctaLabel: string
  ctaUrl: string
  targetMode?: 'audience' | 'pending_email' | 'inactive'
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
    targetMode: 'inactive',
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
  cancelled: 'Cancelada',
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
  const { t, i18n } = useTranslation()
  const [targetCountry, setTargetCountry] = useState('')
  const [countries, setCountries] = useState<string[]>([])
  const countryCopy = (pt: string, es: string, en: string) => (i18n.language || 'pt').startsWith('es') ? es : (i18n.language || 'pt').startsWith('en') ? en : pt
  const countryName = (code: string) => {
    try { return new Intl.DisplayNames([i18n.language || 'pt-BR'], { type: 'region' }).of(code) || code }
    catch { return code }
  }
  const initialPendingRange = useMemo(defaultPendingRange, [])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [audienceCounts, setAudienceCounts] = useState({ all: 0, composers: 0, site_users: 0 })
  const [audienceLanguageCounts, setAudienceLanguageCounts] = useState<Record<'all' | 'composers' | 'site_users', LanguageCounts>>({
    all: { pt: 0, es: 0, en: 0 },
    composers: { pt: 0, es: 0, en: 0 },
    site_users: { pt: 0, es: 0, en: 0 },
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [processingId, setProcessingId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingDraftId, setEditingDraftId] = useState('')
  const [showHidden, setShowHidden] = useState(false)

  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [preview, setPreview] = useState('')
  const [body, setBody] = useState('')
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [audience, setAudience] = useState<'all' | 'composers' | 'site_users'>('all')
  const [targetMode, setTargetMode] = useState<'audience' | 'pending_email' | 'inactive'>('audience')
  const [targetFrom, setTargetFrom] = useState(initialPendingRange.from)
  const [targetTo, setTargetTo] = useState(initialPendingRange.to)
  const [excludePreviouslySent, setExcludePreviouslySent] = useState(false)
  const [sentFilterFrom, setSentFilterFrom] = useState(localDateValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
  const [sentFilterTo, setSentFilterTo] = useState(localDateValue(new Date()))
  const [inactiveDays, setInactiveDays] = useState(30)
  const [targetCount, setTargetCount] = useState<number | null>(null)
  const [targetLanguageCounts, setTargetLanguageCounts] = useState<LanguageCounts>({ pt: 0, es: 0, en: 0 })
  const [targetCountLoading, setTargetCountLoading] = useState(false)
  const [createScheduled, setCreateScheduled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState(localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)))

  const selectedAudienceCount = Boolean(targetCountry) || targetMode === 'pending_email' || targetMode === 'inactive' || excludePreviouslySent ? (targetCount ?? 0) : (audienceCounts[audience] || 0)
  const selectedLanguageCounts = Boolean(targetCountry) || targetMode === 'pending_email' || targetMode === 'inactive' || excludePreviouslySent ? targetLanguageCounts : audienceLanguageCounts[audience]
  const audienceSelectValue = targetMode === 'inactive' ? 'inactive' : targetMode === 'pending_email' ? 'pending_email' : audience
  const previewLines = useMemo(() => body.split('\n').filter(Boolean).slice(0, 4), [body])

  const insertNameToken = () => {
    const textarea = bodyTextareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const token = '{{nome}}'
    setBody(`${body.slice(0, start)}${token}${body.slice(end)}`)
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(start + token.length, start + token.length) })
  }

  const loadCampaigns = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const response = await fetch(`/api/admin/email-campaigns${showHidden ? '?showHidden=1' : ''}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar campanhas')
      setCampaigns(data.campaigns || [])
      setCountries(data.countries || [])
      setAudienceCounts(data.audienceCounts || { all: 0, composers: 0, site_users: 0 })
      setAudienceLanguageCounts(data.audienceLanguageCounts || {
        all: { pt: 0, es: 0, en: 0 },
        composers: { pt: 0, es: 0, en: 0 },
        site_users: { pt: 0, es: 0, en: 0 },
      })
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar campanhas')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => { void loadCampaigns() }, [showHidden])

  // Enquanto uma campanha estiver enviando, atualiza também os cliques
  // automaticamente. O tracking é registrado no servidor e não depende
  // de o administrador clicar em "Atualizar".
  const hasSendingCampaign = campaigns.some((campaign) => campaign.status === 'sending')

  useEffect(() => {
    if (!hasSendingCampaign) return
    const interval = window.setInterval(() => {
      void loadCampaigns(true)
    }, 10000)
    return () => window.clearInterval(interval)
  }, [hasSendingCampaign, showHidden])

  useEffect(() => {
    const needsDynamicCount = Boolean(targetCountry) || targetMode === 'pending_email' || targetMode === 'inactive' || excludePreviouslySent
    if (!needsDynamicCount) {
      setTargetCount(null)
      setTargetLanguageCounts({ pt: 0, es: 0, en: 0 })
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setTargetCountLoading(true)
        const params = new URLSearchParams({
          mode: 'count',
          country: targetCountry,
          targetMode,
          audience,
          from: targetFrom,
          to: targetMode === 'inactive' ? '' : targetTo,
          excludePreviouslySent: String(excludePreviouslySent),
          sentFrom: sentFilterFrom,
          sentTo: sentFilterTo,
        })
        const response = await fetch(`/api/admin/email-campaigns?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Erro ao calcular destinatários')
        setTargetCount(Number(data.count) || 0)
        setTargetLanguageCounts(data.languages || { pt: 0, es: 0, en: 0 })
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setTargetCount(null)
          setTargetLanguageCounts({ pt: 0, es: 0, en: 0 })
        }
      } finally {
        setTargetCountLoading(false)
      }
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [targetCountry, targetMode, targetFrom, targetTo, audience, excludePreviouslySent, sentFilterFrom, sentFilterTo])

  const applyIdea = (idea: Idea) => {
    setEditingDraftId('')
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
    } else if (idea.targetMode === 'inactive') {
      const since = new Date()
      since.setDate(since.getDate() - 30)
      setTargetMode('inactive')
      setAudience('composers')
      setInactiveDays(30)
      setTargetFrom(localDateValue(since))
      setTargetTo('')
      setCreateScheduled(false)
    } else {
      setTargetMode('audience')
    }
  }

  const resetForm = () => {
    setEditingDraftId('')
    setName('')
    setSubject('')
    setPreview('')
    setBody('')
    setCtaLabel('')
    setCtaUrl('')
    setTargetCountry('')
    setAudience('all')
    setTargetMode('audience')
    setTargetFrom(initialPendingRange.from)
    setTargetTo(initialPendingRange.to)
    setExcludePreviouslySent(false)
    setSentFilterFrom(localDateValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
    setSentFilterTo(localDateValue(new Date()))
    setInactiveDays(30)
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
        method: editingDraftId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingDraftId ? { id: editingDraftId, action: 'save_draft' } : {}),
          name, subject, preview, body, ctaLabel, ctaUrl, audience,
          targetMode,
          targetFrom: targetMode === 'pending_email' || targetMode === 'inactive' ? targetFrom : null,
          targetTo: targetMode === 'pending_email' ? targetTo : null,
          excludePreviouslySent,
          sentFilterFrom: excludePreviouslySent ? sentFilterFrom : null,
          sentFilterTo: excludePreviouslySent ? sentFilterTo : null,
          status: createScheduled ? 'scheduled' : 'draft',
          scheduledAt: createScheduled ? scheduledAt : null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar campanha')
      setSuccess(createScheduled ? 'Campanha salva e agendada.' : editingDraftId ? 'Rascunho atualizado.' : 'Campanha salva como rascunho.')
      resetForm()
      await loadCampaigns()
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar campanha')
    } finally {
      setSaving(false)
    }
  }

  const editDraft = (campaign: Campaign) => {
    setEditingDraftId(campaign.id)
    setName(campaign.name)
    setSubject(campaign.subject || '')
    setPreview(campaign.preview || '')
    setBody(campaign.body || '')
    setCtaLabel(campaign.cta_label || '')
    setCtaUrl(campaign.cta_url || '')
    setTargetCountry(campaign.target_country || '')
    setAudience(campaign.audience)
    setTargetMode(campaign.target_mode || 'audience')
    setTargetFrom(campaign.target_from?.slice(0, 10) || initialPendingRange.from)
    setTargetTo(campaign.target_to?.slice(0, 10) || initialPendingRange.to)
    setExcludePreviouslySent(Boolean(campaign.exclude_previously_sent))
    setSentFilterFrom(campaign.sent_filter_from?.slice(0, 10) || localDateValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
    setSentFilterTo(campaign.sent_filter_to?.slice(0, 10) || localDateValue(new Date()))
    setInactiveDays(campaign.target_from ? Math.max(1, Math.ceil((Date.now() - new Date(campaign.target_from).getTime()) / (24 * 60 * 60 * 1000))) : 30)
    setCreateScheduled(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleHidden = async (campaign: Campaign) => {
    setProcessingId(campaign.id)
    setError('')
    setSuccess('')
    try {
      const action = campaign.is_hidden ? 'unhide' : 'hide'
      const response = await fetch('/api/admin/email-campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campaign.id, action }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a campanha.')
      setSuccess(campaign.is_hidden ? 'Campanha restaurada.' : 'Campanha ocultada.')
      await loadCampaigns(true)
    } catch (err: any) {
      setError(err.message || 'Não foi possível atualizar a campanha.')
    } finally {
      setProcessingId('')
    }
  }

  const runAction = async (campaign: Campaign, action: 'send' | 'pause' | 'cancel') => {
    const sentSoFar = campaign.deliveries?.sent || campaign.sent_count || 0
    const pending = (campaign.deliveries?.pending || 0) + (campaign.deliveries?.reserved || 0)
    const targetLabel = campaign.target_mode === 'pending_email'
      ? `${campaign.target_count || pending || 'os'} cadastros com e-mail pendente`
      : campaign.target_mode === 'inactive'
        ? `${campaign.target_count || pending || 'os'} compositores sem criação recente`
      : audienceLabels[campaign.audience]

    const confirmMessage = action === 'send'
      ? sentSoFar > 0 || pending > 0
        ? `Retomar a campanha "${campaign.name}" e continuar automaticamente até terminar a lista? Quem já foi processado não recebe novamente.`
        : `Iniciar a campanha "${campaign.name}" para ${targetLabel}${campaign.target_country ? ` (${countryName(campaign.target_country)})` : ''}? A lista será congelada e o envio seguirá automaticamente, em ordem, até concluir.`
      : action === 'cancel'
        ? `Cancelar a campanha "${campaign.name}"? Ela não será enviada.`
        : `Pausar a campanha "${campaign.name}"?`

    if (!confirm(confirmMessage)) return
    setProcessingId(campaign.id)
    setError('')
    setSuccess('')

    try {
      if (action === 'pause' || action === 'cancel') {
        const response = await fetch('/api/admin/email-campaigns', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: campaign.id, action }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Erro ao atualizar campanha')
        setSuccess(action === 'cancel' ? 'Campanha cancelada.' : 'Campanha pausada.')
        await loadCampaigns(true)
        return
      }

      let finalResult: any = null
      let sentThisRun = 0
      let failedThisRun = 0
      let idleRounds = 0

      while (true) {
        const response = await fetch('/api/admin/email-campaigns', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: campaign.id, action: 'send', limit: 20 }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Erro ao processar campanha')

        const result = data.result
        finalResult = result
        sentThisRun += Number(result.sent || 0)
        failedThisRun += Number(result.failed || 0)

        setCampaigns((current) => current.map((item) => item.id === campaign.id ? {
          ...item,
          status: result.remaining > 0 ? 'sending' : 'sent',
          frozen_at: item.frozen_at || new Date().toISOString(),
          target_count: Number(result.totalRecipients || item.target_count || 0),
          sent_count: Number(result.sentTotal || 0),
          failed_count: Number(result.failedTotal || 0),
          deliveries: {
            sent: Number(result.sentTotal || 0),
            failed: Number(result.failedTotal || 0),
            skipped: Number(result.skippedTotal || 0),
            pending: Number(result.pendingTotal || 0),
            reserved: Number(result.reservedTotal || 0),
          },
        } : item))

        if (Number(result.remaining || 0) <= 0) break

        if (Number(result.attempted || 0) === 0) {
          idleRounds += 1
          if (idleRounds >= 5) break
          await new Promise((resolve) => window.setTimeout(resolve, 1200))
        } else {
          idleRounds = 0
          await new Promise((resolve) => window.setTimeout(resolve, 250))
        }
      }

      if (finalResult && Number(finalResult.remaining || 0) > 0) {
        setSuccess(`Envio em andamento: ${finalResult.processedTotal || 0} de ${finalResult.totalRecipients || 0} processados. O servidor continuará a recuperação automática se esta tela for fechada.`)
      } else {
        setSuccess(`Campanha concluída. ${sentThisRun} enviado(s) nesta execução e ${failedThisRun} falha(s). Cada destinatário foi processado uma única vez.`)
      }

      await loadCampaigns(true)
    } catch (err: any) {
      setError(`${err.message || 'Erro ao processar campanha'} A campanha pode ser retomada com segurança; destinatários já reservados não serão duplicados.`)
      await loadCampaigns(true)
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
              Crie campanhas, filtre públicos, acompanhe envios e cliques. Antes do primeiro disparo, a lista de destinatários é congelada. Um clique inicia o envio automático; cada destinatário é processado individualmente e a proteção contra duplicidade fica registrada no banco.
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
          <p className="mb-3 text-sm font-bold text-gray-200">Modelos de mensagem (opcional)</p>
          <div className="flex flex-wrap gap-2">
            {campaignIdeas.map((idea) => (
              <button key={idea.label} type="button" onClick={() => applyIdea(idea)} className={`rounded-full border px-4 py-2 text-sm font-bold ${idea.targetMode === 'pending_email' && targetMode === 'pending_email' ? 'border-amber-400 bg-amber-950/40 text-amber-100' : 'border-fuchsia-800/70 bg-fuchsia-950/25 text-fuchsia-100 hover:border-fuchsia-400'}`}>
                {idea.label}
              </button>
            ))}
          </div>


        </div>

        <form onSubmit={createCampaign} className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          {editingDraftId && <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-fuchsia-700/60 bg-fuchsia-950/30 px-4 py-3 text-sm text-fuchsia-100"><span>Editando rascunho: <strong>{name}</strong></span><button type="button" onClick={resetForm} className="rounded-lg border border-fuchsia-700 px-3 py-1.5 text-xs font-bold">Cancelar edição</button></div>}
          <div className="space-y-4">
            <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-200">Nome interno da campanha</span><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3" placeholder="Ex: Cupom Junho" /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-200">Assunto do e-mail</span><input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3" placeholder="Ex: Cupom exclusivo para você" /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-200">Resumo curto</span><input value={preview} onChange={(e) => setPreview(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3" placeholder="Aparece como prévia em alguns apps de e-mail" /></label>
            <div>
              <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-200">Mensagem</span><textarea ref={bodyTextareaRef} value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="w-full resize-y rounded-xl border border-gray-700 bg-black px-4 py-3" placeholder="Digite o texto do e-mail..." /></label>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400"><p>Para chamar pelo primeiro nome, escreva <code className="rounded bg-gray-800 px-1.5 py-0.5 text-fuchsia-200">{'{{nome}}'}</code>. Sem nome cadastrado, usamos “Compositor”.</p><button type="button" onClick={insertNameToken} className="rounded-lg border border-fuchsia-800 px-2.5 py-1.5 font-bold text-fuchsia-200 hover:bg-fuchsia-950/40">Inserir {'{{nome}}'}</button></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-200">Texto do botão</span><input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3" /></label>
              <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-200">Link do botão</span><input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3" /></label>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-gray-200">Público da campanha</span>
                <select value={audienceSelectValue} onChange={(e) => {
                  const value = e.target.value
                  if (value === 'inactive') {
                    const since = new Date(); since.setDate(since.getDate() - inactiveDays)
                    setAudience('composers'); setTargetMode('inactive'); setTargetFrom(localDateValue(since)); setTargetTo('')
                  } else if (value === 'pending_email') {
                    setAudience('composers'); setTargetMode('pending_email')
                  } else {
                    setAudience(value as any); setTargetMode('audience')
                  }
                }} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3">
                  <option value="all">Toda a base ({audienceCounts.all})</option>
                  <option value="composers">Compositores ({audienceCounts.composers})</option>
                  <option value="site_users">Usuários do site ({audienceCounts.site_users})</option>
                  <option value="inactive">Compositores sem criação recente</option>
                  <option value="pending_email">Cadastros com e-mail pendente</option>
                </select>
              </label>
              <label className="mt-3 block">
                <span className="mb-1.5 block text-sm font-bold text-gray-200">{t('campaignCountryLabel', { defaultValue: countryCopy('País dos destinatários', 'País de los destinatarios', 'Recipient country') })}</span>
                <select value={targetCountry} onChange={(e) => { setTargetCountry(e.target.value); setTargetCount(null) }} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3">
                  <option value="">{t('campaignAllCountries', { defaultValue: countryCopy('Todos os países', 'Todos los países', 'All countries') })}</option>
                  {Array.from(new Set([...countries, ...(targetCountry ? [targetCountry] : [])])).sort((a, b) => countryName(a).localeCompare(countryName(b))).map((code) => <option key={code} value={code}>{countryName(code)}</option>)}
                </select>
                <p className="mt-2 text-xs text-gray-400">{t('campaignCountryHelp', { defaultValue: countryCopy('Usa o país do cadastro e combina com os outros filtros. Cadastros sem país só entram em Todos os países.', 'Usa el país del registro y se combina con los otros filtros. Los registros sin país solo se incluyen en Todos los países.', 'Uses the signup country and combines with other filters. Accounts without a country are only included in All countries.') })}</p>
              </label>
              {targetMode === 'inactive' && (
                <div className="mt-4 rounded-xl border border-cyan-800/60 bg-cyan-950/20 p-3">
                  <p className="text-sm font-semibold text-cyan-100">Sem criação desde</p>
                  <p className="mt-1 text-xs text-gray-400">Inclui compositores que não criaram letra nem música no Studio IA após esta data.</p>
                  <div className="mt-3 flex flex-wrap gap-2">{[7, 15, 30, 60, 90].map((days) => (
                    <button key={days} type="button" onClick={() => { const since = new Date(); since.setDate(since.getDate() - days); setInactiveDays(days); setTargetFrom(localDateValue(since)) }} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${inactiveDays === days ? 'border-cyan-400 bg-cyan-950 text-cyan-100' : 'border-gray-700 bg-black/50 text-gray-300'}`}>{days} dias</button>
                  ))}</div>
                  <label className="mt-3 block"><span className="mb-1 block text-xs font-bold text-gray-300">Data limite</span><input type="date" value={targetFrom} onChange={(e) => setTargetFrom(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white" /></label>
                  <p className="mt-2 text-xs text-gray-400">{targetCountLoading ? 'Calculando público...' : `${targetCount ?? 0} compositores`}</p>
                </div>
              )}
              {targetMode === 'pending_email' && (
                <div className="mt-4 rounded-xl border border-amber-800/60 bg-amber-950/20 p-3">
                  <p className="text-sm font-semibold text-amber-100">Cadastro não confirmado, feito neste período</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block"><span className="mb-1 block text-xs font-bold text-gray-300">De</span><input type="date" value={targetFrom} onChange={(e) => setTargetFrom(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white" /></label>
                    <label className="block"><span className="mb-1 block text-xs font-bold text-gray-300">Até</span><input type="date" value={targetTo} onChange={(e) => setTargetTo(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white" /></label>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">{[{ label: 'Hoje', days: 0 }, { label: '3 dias', days: 2 }, { label: '7 dias', days: 6 }, { label: '30 dias', days: 29 }].map((preset) => (
                    <button key={preset.label} type="button" onClick={() => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - preset.days); setTargetFrom(localDateValue(start)); setTargetTo(localDateValue(end)) }} className="rounded-lg border border-gray-700 bg-black/50 px-3 py-1.5 text-xs font-bold text-gray-200 hover:border-amber-500">Últimos {preset.label}</button>
                  ))}</div>
                  <p className="mt-2 text-xs text-gray-400">{targetCountLoading ? 'Calculando público...' : `${targetCount ?? 0} cadastros`}</p>
                </div>
              )}
              <p className="mt-3 text-xs text-gray-500">Estimativa: {targetCountLoading ? '...' : selectedAudienceCount} destinatário(s). A lista será congelada no primeiro envio.</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border border-gray-800 bg-black/50 px-3 py-2"><strong className="block text-white">{selectedLanguageCounts.pt}</strong><span className="text-gray-400">Português</span></div>
                <div className="rounded-lg border border-gray-800 bg-black/50 px-3 py-2"><strong className="block text-white">{selectedLanguageCounts.es}</strong><span className="text-gray-400">Español</span></div>
                <div className="rounded-lg border border-gray-800 bg-black/50 px-3 py-2"><strong className="block text-white">{selectedLanguageCounts.en}</strong><span className="text-gray-400">English</span></div>
              </div>
              <p className="mt-2 text-xs text-emerald-300">Espanhol e inglês são traduzidos automaticamente uma única vez antes do primeiro envio. Cada destinatário recebe a versão definida pelo país do cadastro.</p>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
              <label className="mb-2 flex items-start gap-3 text-sm font-bold text-gray-200"><input type="checkbox" checked={excludePreviouslySent} onChange={(e) => setExcludePreviouslySent(e.target.checked)} className="mt-0.5" /><span>Excluir quem já recebeu campanha</span></label>
              <p className="mb-3 text-xs text-gray-400">Marque para evitar novo envio no período abaixo. Conta envios aceitos pelo provedor; não confirma entrega nem abertura.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-xs font-bold text-gray-300">Envios de</span><input type="date" value={sentFilterFrom} onChange={(e) => setSentFilterFrom(e.target.value)} disabled={!excludePreviouslySent} className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white disabled:opacity-50" /></label>
                <label className="block"><span className="mb-1 block text-xs font-bold text-gray-300">Até</span><input type="date" value={sentFilterTo} onChange={(e) => setSentFilterTo(e.target.value)} disabled={!excludePreviouslySent} className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white disabled:opacity-50" /></label>
              </div>
              <p className="mt-2 text-xs text-gray-500">{excludePreviouslySent ? (targetCountLoading ? 'Verificando quem já recebeu...' : `${targetCount ?? 0} pessoas receberão após o filtro`) : 'Desmarcado: inclui também quem já recebeu campanha.'}</p>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
              <label className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-200"><input type="checkbox" checked={createScheduled} disabled={Boolean(editingDraftId)} onChange={(e) => setCreateScheduled(e.target.checked)} /> Agendar envio</label>
              <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-200">Data e hora</span><input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} disabled={!createScheduled} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 disabled:opacity-50" /></label>
              <p className="mt-2 text-xs text-gray-500">Agendamento envia apenas um lote por execução. Recorrência mensal está temporariamente desativada até a nova rotina de CRM ficar validada.</p>
            </div>

            <div className="rounded-2xl border border-fuchsia-800/50 bg-fuchsia-950/15 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-fuchsia-200">Prévia de exemplo (nome: Marina)</p>
              <h3 className="font-black text-white">{subject || 'Assunto do e-mail'}</h3>
              <p className="mt-2 text-xs text-gray-400">{preview || 'Resumo curto do e-mail'}</p>
              <div className="mt-4 rounded-xl border border-gray-800 bg-black/40 p-4 text-sm leading-relaxed text-gray-200">
                {previewLines.length > 0 ? previewLines.map((line, index) => <p key={`${line}-${index}`} className="mb-2">{line.replace(/\{\{\s*nome\s*\}\}/gi, 'Marina')}</p>) : <p>A mensagem aparecerá aqui.</p>}
                {ctaLabel && <span className="mt-3 inline-flex rounded-lg bg-fuchsia-700 px-3 py-2 text-xs font-bold text-white">{ctaLabel}</span>}
              </div>
            </div>

            <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-fuchsia-600 px-5 py-3 font-bold text-white disabled:opacity-60">
              {saving ? <FiLoader className="animate-spin" /> : createScheduled ? <FiCalendar /> : <FiMail />}
              {createScheduled ? 'Salvar campanha agendada' : editingDraftId ? 'Atualizar rascunho' : 'Salvar rascunho'}
            </button>
          </aside>
        </form>
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black">{showHidden ? 'Campanhas ocultas' : 'Campanhas criadas'}</h2><div className="flex gap-2"><button type="button" onClick={() => setShowHidden((value) => !value)} className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-xs font-bold text-gray-300">{showHidden ? <FiEye /> : <FiEyeOff />}{showHidden ? 'Ocultar lista' : 'Mostrar ocultos'}</button><button type="button" onClick={() => loadCampaigns()} className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-bold text-gray-300">Atualizar</button></div></div>
        {loading ? <div className="flex justify-center py-10"><FiLoader className="h-8 w-8 animate-spin text-primary-300" /></div> : campaigns.length === 0 ? <p className="py-10 text-center text-gray-500">Nenhuma campanha criada ainda.</p> : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const sentCount = campaign.deliveries?.sent || campaign.sent_count || 0
              const failedCount = campaign.deliveries?.failed || campaign.failed_count || 0
              const skippedCount = campaign.deliveries?.skipped || 0
              const pendingCount = campaign.deliveries?.pending || 0
              const reservedCount = campaign.deliveries?.reserved || 0
              const humanClicks = campaign.clicks?.human || 0
              const totalClicks = campaign.clicks?.total || 0
              const queueTotal = sentCount + failedCount + skippedCount + pendingCount + reservedCount
              const isFrozen = Boolean(campaign.frozen_at) || queueTotal > 0
              const estimatedTotal = isFrozen
                ? Number(campaign.target_count || queueTotal)
                : (campaign.target_country || campaign.exclude_previously_sent || campaign.target_mode === 'pending_email' || campaign.target_mode === 'inactive' ? Number(campaign.target_count || 0) : audienceCounts[campaign.audience] || 0)
              const remaining = isFrozen ? pendingCount + reservedCount : estimatedTotal
              const processedCount = sentCount + failedCount + skippedCount
              const progressPercent = estimatedTotal > 0 ? Math.min(100, Math.round((processedCount / estimatedTotal) * 100)) : 0
              const isProcessing = processingId === campaign.id
              const canSend = !showHidden && campaign.status !== 'sent' && campaign.status !== 'scheduled' && campaign.status !== 'cancelled'
              const sendLabel = isProcessing ? 'Enviando...' : isFrozen && processedCount > 0 ? 'Retomar envio' : 'Iniciar envio'

              return (
                <article key={campaign.id} className="rounded-2xl border border-gray-800 bg-black/35 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-xs font-bold text-gray-200">{statusLabels[campaign.status]}</span>
                        <span className="rounded-full border border-fuchsia-800 bg-fuchsia-950/30 px-3 py-1 text-xs font-bold text-fuchsia-100">{campaign.target_mode === 'pending_email' ? 'E-mail pendente' : campaign.target_mode === 'inactive' ? 'Sem criação recente' : audienceLabels[campaign.audience]}</span>
                        {campaign.target_country && <span className="rounded-full border border-cyan-800 bg-cyan-950/30 px-3 py-1 text-xs font-bold text-cyan-100">{countryName(campaign.target_country)}</span>}
                        {isFrozen && <span className="rounded-full border border-emerald-800 bg-emerald-950/30 px-3 py-1 text-xs font-bold text-emerald-100">Lista congelada: {estimatedTotal}</span>}
                      </div>
                      <h3 className="text-lg font-black text-white">{campaign.name}</h3>
                      <p className="mt-1 text-sm font-semibold text-gray-300">{campaign.subject}</p>
                      <p className="mt-2 text-xs text-gray-500">Próximo envio: {formatDateTime(campaign.next_run_at || campaign.scheduled_at)} · Enviados: {sentCount} · Restantes: {remaining} · Falhas: {failedCount}</p>
                      <p className="mt-1 text-xs text-fuchsia-200">Cliques no botão: {humanClicks} humano(s) · {totalClicks} total(is)</p>
                      {estimatedTotal > 0 && (
                        <div className="mt-4 max-w-2xl">
                          <div className="mb-1 flex items-center justify-between gap-3 text-xs text-gray-400">
                            <span>{isProcessing ? 'Envio automático em andamento' : campaign.status === 'sent' ? 'Envio concluído' : 'Progresso do envio'}</span>
                            <strong className="text-gray-200">{progressPercent}%</strong>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-gray-800">
                            <div className="h-full rounded-full bg-fuchsia-600 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {processedCount} de {estimatedTotal} processados · {sentCount} enviados · {failedCount} falhas · {remaining} restantes
                            {reservedCount > 0 ? ` · ${reservedCount} em processamento` : ''}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canSend && <button onClick={() => runAction(campaign, 'send')} disabled={Boolean(processingId)} className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{processingId === campaign.id ? <FiLoader className="animate-spin" /> : <FiSend />}{sendLabel}</button>}
                      {!showHidden && campaign.status === 'draft' && <button onClick={() => editDraft(campaign)} disabled={Boolean(processingId)} className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-800 bg-fuchsia-950/30 px-4 py-2 text-sm font-bold text-fuchsia-100 disabled:opacity-60">Editar rascunho</button>}
                      {campaign.status !== 'sending' && <button onClick={() => toggleHidden(campaign)} disabled={Boolean(processingId)} className="inline-flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-bold text-gray-200 disabled:opacity-60">{campaign.is_hidden ? <FiEye /> : <FiEyeOff />}{campaign.is_hidden ? 'Restaurar' : 'Ocultar'}</button>}
                      {campaign.status === 'scheduled' && <button onClick={() => runAction(campaign, 'cancel')} disabled={Boolean(processingId)} className="inline-flex items-center gap-2 rounded-xl border border-red-800 bg-red-950/30 px-4 py-2 text-sm font-bold text-red-100 disabled:opacity-60"><FiX /> Cancelar</button>}
                      {campaign.status === 'paused' && <button onClick={() => runAction(campaign, 'cancel')} disabled={Boolean(processingId)} className="inline-flex items-center gap-2 rounded-xl border border-red-800 bg-red-950/30 px-4 py-2 text-sm font-bold text-red-100 disabled:opacity-60"><FiX /> Cancelar</button>}
                      {campaign.status === 'sending' && <button onClick={() => runAction(campaign, 'pause')} disabled={Boolean(processingId)} className="inline-flex items-center gap-2 rounded-xl border border-yellow-800 bg-yellow-950/30 px-4 py-2 text-sm font-bold text-yellow-100 disabled:opacity-60"><FiPauseCircle /> Pausar</button>}
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
        <p className="mt-2">A lista é congelada antes do primeiro envio. Cada destinatário tem uma entrega única no banco, a reserva é atômica antes de chamar o Resend e cada envio usa uma chave de idempotência. O idioma também é congelado por destinatário: Brasil/Portugal recebem português, países hispânicos recebem espanhol e países de língua inglesa recebem inglês. O botão inicia lotes sequenciais automaticamente até concluir; se a tela for fechada no meio, o cron retoma campanhas paradas sem reenviar quem já foi processado.</p>
      </div>
    </section>
  )
}
