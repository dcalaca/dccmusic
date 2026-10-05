import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowLeft,
  FiCheckCircle,
  FiDollarSign,
  FiEye,
  FiMousePointer,
  FiRefreshCw,
  FiShield,
  FiZap,
} from 'react-icons/fi'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const API_BASE = 'https://api.ads.openai.com/v1'

type Account = {
  id?: string
  name?: string
  status?: string
  timezone?: string
  currency_code?: string
  review?: { status?: string } | null
}

type Campaign = {
  id: string
  name?: string
  description?: string | null
  status?: string
  bidding_type?: string
  budget?: {
    lifetime_spend_limit_micros?: number | null
    daily_spend_limit_micros?: number | null
  } | null
  targeting?: {
    locations?: {
      include?: Array<{ id?: string; name?: string }>
    } | null
    platforms?: { included?: string[] } | null
  } | null
  start_time?: number | null
  end_time?: number | null
}

type Insight = {
  campaign_id?: string
  campaign_name?: string
  impressions?: number
  clicks?: number
  spend?: number | string
}

type ListResponse<T> = {
  data?: T[]
  has_more?: boolean
  last_id?: string | null
  account_currency?: string
}

async function openAIAdsFetch<T>(path: string, key: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
      payload?.message ||
      `OpenAI Ads respondeu HTTP ${response.status}`
    )
  }
  return payload as T
}

async function getCampaigns(key: string) {
  const rows: Campaign[] = []
  let after: string | null = null

  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({ limit: '100', order: 'desc' })
    if (after) params.set('after', after)

    const payload = await openAIAdsFetch<ListResponse<Campaign>>(
      `/campaigns?${params.toString()}`,
      key
    )
    rows.push(...(payload.data || []))
    if (!payload.has_more || !payload.last_id) break
    after = payload.last_id
  }
  return rows
}

async function getInsights(key: string) {
  // A OpenAI Ads exige início/fim exatamente em hora cheia no fuso da conta.
  // Como America/Sao_Paulo tem offset em horas inteiras, alinhar o Unix timestamp
  // para múltiplos de 3600 garante minuto=0 e segundo=0 também no horário local.
  const now = Math.floor(Date.now() / 1000)
  const end = Math.floor(now / 3600) * 3600
  const start = end - 30 * 24 * 60 * 60
  const params = new URLSearchParams()
  params.set('time_granularity', 'none')
  params.set('aggregation_level', 'campaign')
  params.append('fields[]', 'campaign.id')
  params.append('fields[]', 'campaign.name')
  params.append('fields[]', 'campaign.impressions')
  params.append('fields[]', 'campaign.clicks')
  params.append('fields[]', 'campaign.spend')
  params.append('time_ranges[]', JSON.stringify({
    type: 'unix_range',
    start: String(start),
    end: String(end),
  }))
  params.set('limit', '500')

  return openAIAdsFetch<ListResponse<Insight>>(
    `/ad_account/insights?${params.toString()}`,
    key
  )
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(value)
  } catch {
    return `${currency || 'USD'} ${value.toFixed(2)}`
  }
}

function budgetMicros(value?: number | null) {
  return value == null ? null : Number(value) / 1_000_000
}

function badge(value?: string) {
  const status = String(value || '').toLowerCase()
  if (status === 'active' || status === 'approved') {
    return 'border-green-700 bg-green-950/40 text-green-200'
  }
  if (status.includes('review') || status === 'pending') {
    return 'border-yellow-700 bg-yellow-950/40 text-yellow-100'
  }
  if (status === 'paused' || status === 'archived') {
    return 'border-gray-700 bg-gray-900 text-gray-300'
  }
  return 'border-red-700 bg-red-950/40 text-red-100'
}

function Status({ value }: { value?: string }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-black uppercase ${badge(value)}`}>
      {value || 'desconhecido'}
    </span>
  )
}

export default async function OpenAIAdsPage() {
  const session = await getServerSession(authOptions)
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const sessionEmail = session?.user?.email?.trim().toLowerCase()

  // Proteção adicional: sessão válida não basta; precisa ser o ADMIN_EMAIL principal.
  if (!session || !adminEmail || sessionEmail !== adminEmail) redirect('/admin')

  const key = process.env.OPENAI_ADS_API_KEY

  if (!key) {
    return <Shell><ErrorBox>A variável OPENAI_ADS_API_KEY não está disponível em produção.</ErrorBox></Shell>
  }

  let account: Account
  let campaigns: Campaign[]
  let insightPayload: ListResponse<Insight> = {}
  let insightError = ''

  try {
    account = await openAIAdsFetch<Account>('/ad_account', key)
    campaigns = await getCampaigns(key)
    try {
      insightPayload = await getInsights(key)
    } catch (error: any) {
      insightError = error?.message || 'Falha ao carregar métricas'
    }
  } catch (error: any) {
    return <Shell><ErrorBox>{error?.message || 'Falha ao consultar OpenAI Ads.'}</ErrorBox></Shell>
  }

  const insights = insightPayload.data || []
  const currency = insightPayload.account_currency || account.currency_code || 'USD'
  const byCampaign = new Map(
    insights.filter((row) => row.campaign_id).map((row) => [String(row.campaign_id), row])
  )

  const totalSpend = insights.reduce((sum, row) => sum + Number(row.spend || 0), 0)
  const totalImpressions = insights.reduce((sum, row) => sum + Number(row.impressions || 0), 0)
  const totalClicks = insights.reduce((sum, row) => sum + Number(row.clicks || 0), 0)
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : null
  const review = account.review?.status || 'desconhecido'
  const healthy = account.status === 'active' && review === 'approved'
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active')

  return (
    <Shell>
      <section className={`rounded-3xl border p-5 sm:p-6 ${healthy ? 'border-green-800/60 bg-green-950/20' : 'border-yellow-800/60 bg-yellow-950/20'}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Status value={account.status} />
              <Status value={review} />
            </div>
            <h2 className="text-2xl font-black text-white">{account.name || 'Conta OpenAI Ads'}</h2>
            <p className="mt-1 text-sm text-gray-400">
              {account.id || 'ID não informado'} · {account.currency_code || 'moeda não informada'} · {account.timezone || 'timezone não informada'}
            </p>
          </div>
          <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${healthy ? 'border-green-700 text-green-200' : 'border-yellow-700 text-yellow-100'}`}>
            {healthy ? <FiCheckCircle /> : <FiAlertTriangle />}
            {healthy ? 'Conta ativa e aprovada' : 'Conta precisa de atenção'}
          </div>
        </div>
      </section>

      {insightError && (
        <div className="rounded-2xl border border-yellow-800 bg-yellow-950/20 p-4 text-sm text-yellow-100">
          <strong>Métricas:</strong> {insightError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<FiDollarSign />} label="Gasto · 30 dias" value={money(totalSpend, currency)} />
        <Metric icon={<FiEye />} label="Impressões · 30 dias" value={totalImpressions.toLocaleString('pt-BR')} />
        <Metric icon={<FiMousePointer />} label="Cliques · 30 dias" value={totalClicks.toLocaleString('pt-BR')} />
        <Metric
          icon={<FiActivity />}
          label="CTR / CPC"
          value={ctr == null ? '—' : `${ctr.toFixed(2)}%`}
          hint={cpc == null ? 'CPC indisponível' : `CPC ${money(cpc, currency)}`}
        />
      </div>

      <section className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-purple-300">
              <FiZap /> Campanhas
            </div>
            <h2 className="text-2xl font-black text-white">
              {activeCampaigns.length} ativa(s) · {campaigns.length} no total
            </h2>
          </div>
          <Link
            href="/admin/openai-ads"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:border-purple-500"
          >
            <FiRefreshCw /> Atualizar
          </Link>
        </div>

        <div className="space-y-4">
          {campaigns.length === 0 && (
            <div className="rounded-2xl border border-gray-800 bg-black/30 p-8 text-center text-gray-400">
              Nenhuma campanha encontrada.
            </div>
          )}

          {campaigns.map((campaign) => {
            const row = byCampaign.get(campaign.id)
            const spend = Number(row?.spend || 0)
            const impressions = Number(row?.impressions || 0)
            const clicks = Number(row?.clicks || 0)
            const rowCtr = impressions > 0 ? (clicks / impressions) * 100 : null
            const daily = budgetMicros(campaign.budget?.daily_spend_limit_micros)
            const lifetime = budgetMicros(campaign.budget?.lifetime_spend_limit_micros)
            const locations = campaign.targeting?.locations?.include || []
            const platforms = campaign.targeting?.platforms?.included || []
            const noDelivery = campaign.status === 'active' && impressions === 0

            return (
              <article key={campaign.id} className="rounded-2xl border border-gray-800 bg-black/30 p-4 sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Status value={campaign.status} />
                      {noDelivery && (
                        <span className="rounded-full border border-yellow-700 bg-yellow-950/40 px-2.5 py-1 text-xs font-bold text-yellow-100">
                          ativa, mas sem entrega em 30 dias
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-white">{campaign.name || campaign.id}</h3>
                    <p className="mt-1 text-xs text-gray-500">{campaign.id}</p>
                    {campaign.description && <p className="mt-2 text-sm text-gray-400">{campaign.description}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                    <Mini label="Gasto" value={money(spend, currency)} />
                    <Mini label="Impressões" value={impressions.toLocaleString('pt-BR')} />
                    <Mini label="Cliques" value={clicks.toLocaleString('pt-BR')} />
                    <Mini label="CTR" value={rowCtr == null ? '—' : `${rowCtr.toFixed(2)}%`} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 border-t border-gray-800 pt-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Info label="Orçamento" value={
                    daily != null ? `${money(daily, currency)}/dia` :
                    lifetime != null ? `${money(lifetime, currency)} total` : 'Não informado'
                  } />
                  <Info label="Localização" value={
                    locations.length > 0
                      ? locations.map((x) => x.name || x.id).filter(Boolean).join(', ')
                      : 'Sem restrição explícita'
                  } />
                  <Info label="Plataformas" value={platforms.length > 0 ? platforms.join(', ') : 'Sem restrição explícita'} />
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4 text-xs leading-5 text-gray-500">
        <FiShield className="mr-1 inline" />
        A chave fica somente no servidor e nunca é enviada ao navegador. Esta página exige a sessão do ADMIN_EMAIL principal.
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-primary-400 hover:text-primary-300">
              <FiArrowLeft /> Voltar ao admin
            </Link>
            <h1 className="text-3xl font-black sm:text-4xl"><span className="gradient-text">OpenAI Ads</span></h1>
            <p className="mt-2 text-sm text-gray-400">Conta, revisão, campanhas, orçamento e desempenho pela Advertiser API.</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-red-800 bg-red-950/20 p-6 text-red-100">
      <div className="mb-2 flex items-center gap-2 text-lg font-black"><FiAlertTriangle /> Falha ao consultar OpenAI Ads</div>
      <div className="text-sm">{children}</div>
    </div>
  )
}

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
        <span className="text-purple-300">{icon}</span>{label}
      </div>
      <div className="text-2xl font-black text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] font-bold uppercase text-gray-600">{label}</div><div className="font-black text-white">{value}</div></div>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] font-bold uppercase text-gray-600">{label}</div><div className="mt-0.5 break-words text-sm text-gray-300">{value}</div></div>
}
