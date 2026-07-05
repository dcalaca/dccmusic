'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiCalendar, FiCheckCircle, FiClock, FiLoader, FiMail, FiPauseCircle, FiPlay, FiSend } from 'react-icons/fi'

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
  recurring_day: number | null
  recurring_enabled: boolean
  last_run_at: string | null
  next_run_at: string | null
  sent_count: number
  failed_count: number
  created_at: string
  deliveries?: {
    sent: number
    failed: number
    skipped: number
  }
  clicks?: {
    total: number
    human: number
    bot: number
    unknown: number
  }
}

const campaignIdeas = [
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
    name: 'Lembrete mensal dia 15',
    subject: 'Ideia do mês: transforme uma letra em música',
    preview: 'Um lembrete rápido para continuar criando.',
    body: 'Passando para lembrar: uma música nova pode nascer de uma ideia simples.\n\nSe você tem uma letra guardada, uma frase ou um refrão, entre no DCC Studio IA e crie uma nova versão este mês.\n\nDica: salve suas melhores ideias como projetos para não perder inspiração.',
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

export default function EmailCampaignsAdmin() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [audienceCounts, setAudienceCounts] = useState({ all: 0, composers: 0, site_users: 0 })
  const [setupRequired, setSetupRequired] = useState(false)
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
  const [scheduledAt, setScheduledAt] = useState(localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)))
  const [recurringEnabled, setRecurringEnabled] = useState(false)
  const [recurringDay, setRecurringDay] = useState('15')
  const [createScheduled, setCreateScheduled] = useState(false)

  const selectedAudienceCount = audienceCounts[audience] || 0

  const previewLines = useMemo(() => body.split('\n').filter(Boolean).slice(0, 4), [body])

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/admin/email-campaigns', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar campanhas')
      setCampaigns(data.campaigns || [])
      setAudienceCounts(data.audienceCounts || { all: 0, composers: 0, site_users: 0 })
      setSetupRequired(Boolean(data.setupRequired))
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar campanhas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCampaigns()
  }, [])

  const applyIdea = (idea: typeof campaignIdeas[number]) => {
    setName(idea.name)
    setSubject(idea.subject)
    setPreview(idea.preview)
    setBody(idea.body)
    setCtaLabel(idea.ctaLabel)
    setCtaUrl(idea.ctaUrl)
  }

  const resetForm = () => {
    setName('')
    setSubject('')
    setPreview('')
    setBody('')
    setCtaLabel('')
    setCtaUrl('')
    setAudience('all')
    setCreateScheduled(false)
    setRecurringEnabled(false)
    setRecurringDay('15')
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
          name,
          subject,
          preview,
          body,
          ctaLabel,
          ctaUrl,
          audience,
          status: createScheduled ? 'scheduled' : 'draft',
          scheduledAt: createScheduled && !recurringEnabled ? scheduledAt : null,
          recurringEnabled,
          recurringDay: recurringEnabled ? Number(recurringDay) : null,
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
    const confirmMessage = action === 'send'
      ? sentSoFar > 0
        ? `Enviar o próximo lote da campanha "${campaign.name}"? Quem já recebeu não recebe de novo.`
        : `Enviar agora a campanha "${campaign.name}" para ${audienceLabels[campaign.audience]}?`
      : `Pausar os próximos envios da campanha "${campaign.name}"?`

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
        setSuccess(`Lote processado: ${data.result.sent} enviado(s), ${data.result.failed} falha(s), ${data.result.remaining} restante(s).`)
      } else {
        setSuccess('Campanha pausada. Nenhum próximo lote será enviado até você retomar manualmente.')
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
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-fuchsia-500/40 bg-fuchsia-950/40 px-3 py-1 text-sm text-fuchsia-100">
              <FiMail /> Campanhas de e-mail
            </div>
            <h1 className="text-3xl font-black text-white">Enviar e programar e-mails</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-400">
              Crie campanhas para compositores, usuários do site ou toda a base. Use rascunho para revisar antes de enviar.
              Quem pedir descadastro fica fora dos próximos envios.
            </p>
          </div>
          <div className="grid gap-2 rounded-2xl border border-gray-800 bg-black/40 p-4 text-sm text-gray-300 sm:grid-cols-3 lg:min-w-[28rem]">
            <p><strong className="block text-white">{audienceCounts.all}</strong>Toda a base</p>
            <p><strong className="block text-white">{audienceCounts.composers}</strong>Compositores</p>
            <p><strong className="block text-white">{audienceCounts.site_users}</strong>Usuários</p>
          </div>
        </div>

        {setupRequired && (
          <div className="mb-5 rounded-xl border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-100">
            Antes de usar, execute no Supabase o arquivo <strong>SQL-EMAIL-CAMPANHAS-ADMIN.sql</strong>.
          </div>
        )}
        {error && <div className="mb-5 rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}
        {success && <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-800 bg-green-950/30 p-4 text-sm text-green-200"><FiCheckCircle /> {success}</div>}

        <div className="mb-5 rounded-2xl border border-gray-800 bg-black/30 p-4">
          <p className="mb-3 text-sm font-bold text-gray-200">Ideias prontas para começar</p>
          <div className="flex flex-wrap gap-2">
            {campaignIdeas.map((idea) => (
              <button
                key={idea.label}
                type="button"
                onClick={() => applyIdea(idea)}
                className="rounded-full border border-fuchsia-800/70 bg-fuchsia-950/25 px-4 py-2 text-sm font-bold text-fuchsia-100 hover:border-fuchsia-400"
              >
                {idea.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={createCampaign} className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-200">Nome interno da campanha</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 outline-none focus:border-fuchsia-400" placeholder="Ex: Cupom Junho" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-200">Assunto do e-mail</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 outline-none focus:border-fuchsia-400" placeholder="Ex: Cupom exclusivo para você" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-200">Resumo curto</span>
              <input value={preview} onChange={(e) => setPreview(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 outline-none focus:border-fuchsia-400" placeholder="Aparece como prévia em alguns apps de e-mail" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-200">Mensagem</span>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="w-full resize-none rounded-xl border border-gray-700 bg-black px-4 py-3 outline-none focus:border-fuchsia-400" placeholder="Digite o texto do e-mail..." />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-gray-200">Texto do botão</span>
                <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 outline-none focus:border-fuchsia-400" placeholder="Ex: Usar cupom agora" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-gray-200">Link do botão</span>
                <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 outline-none focus:border-fuchsia-400" placeholder="https://www.dccmusic.online/..." />
              </label>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-gray-200">Enviar para</span>
                <select value={audience} onChange={(e) => setAudience(e.target.value as any)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 outline-none focus:border-fuchsia-400">
                  <option value="all">Toda a base ({audienceCounts.all})</option>
                  <option value="composers">Compositores ({audienceCounts.composers})</option>
                  <option value="site_users">Usuários do site ({audienceCounts.site_users})</option>
                </select>
              </label>
              <p className="mt-2 text-xs text-gray-500">Estimativa atual: {selectedAudienceCount} destinatário(s), já desconsiderando descadastros.</p>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
              <label className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-200">
                <input type="checkbox" checked={createScheduled} onChange={(e) => setCreateScheduled(e.target.checked)} />
                Salvar já agendada
              </label>
              <label className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-200">
                <input type="checkbox" checked={recurringEnabled} onChange={(e) => setRecurringEnabled(e.target.checked)} disabled={!createScheduled} />
                Repetir todo mês
              </label>

              {recurringEnabled ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-gray-200">Dia do mês</span>
                  <input type="number" min={1} max={28} value={recurringDay} onChange={(e) => setRecurringDay(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 outline-none focus:border-fuchsia-400" />
                  <p className="mt-2 text-xs text-gray-500">Use até o dia 28 para funcionar em todos os meses.</p>
                </label>
              ) : (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-gray-200">Data e hora</span>
                  <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} disabled={!createScheduled} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 outline-none focus:border-fuchsia-400 disabled:opacity-50" />
                </label>
              )}
            </div>

            <div className="rounded-2xl border border-fuchsia-800/50 bg-fuchsia-950/15 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-fuchsia-200">Prévia</p>
              <h3 className="font-black text-white">{subject || 'Assunto do e-mail'}</h3>
              <p className="mt-2 text-xs text-gray-400">{preview || 'Resumo curto do e-mail'}</p>
              <div className="mt-4 rounded-xl border border-gray-800 bg-black/40 p-4 text-sm leading-relaxed text-gray-200">
                {previewLines.length > 0 ? previewLines.map((line) => <p key={line} className="mb-2">{line}</p>) : <p>A mensagem aparecerá aqui.</p>}
                {ctaLabel && <span className="mt-3 inline-flex rounded-lg bg-fuchsia-700 px-3 py-2 text-xs font-bold text-white">{ctaLabel}</span>}
              </div>
            </div>

            <button type="submit" disabled={saving || setupRequired} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-fuchsia-600 px-5 py-3 font-bold text-white hover:from-primary-500 hover:to-fuchsia-500 disabled:opacity-60">
              {saving ? <FiLoader className="animate-spin" /> : createScheduled ? <FiCalendar /> : <FiMail />}
              {createScheduled ? 'Salvar campanha agendada' : 'Salvar rascunho'}
            </button>
          </aside>
        </form>
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5 sm:p-6">
        <h2 className="mb-4 text-2xl font-black">Campanhas criadas</h2>
        {loading ? (
          <div className="flex justify-center py-10"><FiLoader className="h-8 w-8 animate-spin text-primary-300" /></div>
        ) : campaigns.length === 0 ? (
          <p className="py-10 text-center text-gray-500">Nenhuma campanha criada ainda.</p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const sentCount = campaign.deliveries?.sent || campaign.sent_count || 0
              const failedCount = campaign.deliveries?.failed || campaign.failed_count || 0
              const skippedCount = campaign.deliveries?.skipped || 0
              const humanClicks = campaign.clicks?.human || 0
              const totalClicks = campaign.clicks?.total || 0
              const estimatedTotal = audienceCounts[campaign.audience] || 0
              const estimatedRemaining = Math.max(0, estimatedTotal - sentCount - skippedCount)
              const sendButtonLabel = sentCount > 0 ? 'Enviar próximo lote' : 'Enviar agora'

              return (
              <article key={campaign.id} className="rounded-2xl border border-gray-800 bg-black/35 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-xs font-bold text-gray-200">{statusLabels[campaign.status]}</span>
                      <span className="rounded-full border border-fuchsia-800 bg-fuchsia-950/30 px-3 py-1 text-xs font-bold text-fuchsia-100">{audienceLabels[campaign.audience]}</span>
                      {campaign.recurring_enabled && <span className="rounded-full border border-blue-800 bg-blue-950/30 px-3 py-1 text-xs font-bold text-blue-100">Todo dia {campaign.recurring_day}</span>}
                    </div>
                    <h3 className="text-lg font-black text-white">{campaign.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-gray-300">{campaign.subject}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      Próximo envio: {formatDateTime(campaign.next_run_at || campaign.scheduled_at)} · Enviados: {sentCount} · Restantes estimados: {estimatedRemaining} · Falhas: {failedCount}
                    </p>
                    <p className="mt-1 text-xs text-fuchsia-200">
                      Cliques no botão: {humanClicks} humano(s) · {totalClicks} total(is)
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {campaign.status !== 'sent' && (
                      <button onClick={() => runAction(campaign, 'send')} disabled={Boolean(processingId)} className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-600 disabled:opacity-60">
                        {processingId === campaign.id ? <FiLoader className="animate-spin" /> : <FiSend />}
                        {sendButtonLabel}
                      </button>
                    )}
                    {campaign.status === 'scheduled' && (
                      <button onClick={() => runAction(campaign, 'pause')} disabled={Boolean(processingId)} className="inline-flex items-center gap-2 rounded-xl border border-yellow-800 bg-yellow-950/30 px-4 py-2 text-sm font-bold text-yellow-100 hover:bg-yellow-900/40 disabled:opacity-60">
                        <FiPauseCircle /> Pausar próximos envios
                      </button>
                    )}
                  </div>
                </div>
              </article>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-blue-800/50 bg-blue-950/20 p-5 text-sm leading-relaxed text-blue-100">
        <p className="font-bold">Ideias para envio automático todo dia 15:</p>
        <p className="mt-2">Lembrete de criar música nova no mês, cupom mensal, dicas de letra, novidades do Studio IA, reativação de usuários parados, ou aviso de promoção com prazo curto.</p>
        <p className="mt-2 text-blue-200/80"><FiClock className="mr-1 inline" /> O cron confere campanhas agendadas todos os dias ao meio-dia.</p>
      </div>
    </section>
  )
}
