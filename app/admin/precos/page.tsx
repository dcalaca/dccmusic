import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'
import { FiArrowLeft, FiDollarSign, FiSave } from 'react-icons/fi'
import PriceUpdatedToast from './PriceUpdatedToast'
import CurrencyPriceInput from './CurrencyPriceInput'

const countries = [
  { code: 'BR', label: 'Brasil', flag: '🇧🇷' },
  { code: 'PY', label: 'Paraguai', flag: '🇵🇾' },
  { code: 'CO', label: 'Colômbia', flag: '🇨🇴' },
  { code: 'MX', label: 'México', flag: '🇲🇽' },
  { code: 'PT', label: 'Portugal', flag: '🇵🇹' },
  { code: 'US', label: 'Estados Unidos', flag: '🇺🇸' },
] as const

const countryLabels: Record<string, string> = Object.fromEntries(countries.map((country) => [country.code, country.label]))
const countryFlags: Record<string, string> = Object.fromEntries(countries.map((country) => [country.code, country.flag]))
const currencyByCountry: Record<string, string> = {
  BR: 'BRL', PY: 'PYG', CO: 'COP', MX: 'MXN', PT: 'EUR', US: 'USD',
}
const currencies = [
  { code: 'BRL', label: 'Real brasileiro (R$)' },
  { code: 'USD', label: 'Dólar americano (US$)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'PYG', label: 'Guarani paraguaio (₲)' },
  { code: 'COP', label: 'Peso colombiano (COP)' },
  { code: 'MXN', label: 'Peso mexicano (MX$)' },
] as const
const allowedCurrencies = new Set<string>(currencies.map((currency) => currency.code))
const studioPlanSlugs = new Set(['studio-start', 'studio-pro', 'studio-elite', 'dcc-studio-ia'])

function redirectAfterSave(country: string, currency?: string) {
  const safeCountry = countries.some((item) => item.code === country) ? country : 'BR'
  const safeCurrency = currency && allowedCurrencies.has(currency) ? currency : currencyByCountry[safeCountry]
  redirect(`/admin/precos?pais=${safeCountry}&moeda=${safeCurrency}&updated=1`)
}

async function updateTopupPrice(formData: FormData) {
  'use server'
  await requireAuth()
  const id = String(formData.get('id') || '')
  const country = String(formData.get('country') || 'BR').toUpperCase()
  const currency = String(formData.get('currency') || currencyByCountry[country] || 'BRL').toUpperCase()
  const price = Number(formData.get('price'))
  if (!id || !allowedCurrencies.has(currency) || !Number.isFinite(price) || price <= 0) return

  const { error } = await supabaseAdmin
    .from('studio_topup_pricing')
    .update({ unit_price: price, currency, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error

  revalidatePath('/admin/precos')
  revalidatePath('/studio-ia')
  revalidatePath('/compositores/planos')
  redirectAfterSave(country, currency)
}

async function updateCountryPlanPrice(formData: FormData) {
  'use server'
  await requireAuth()
  const id = String(formData.get('id') || '')
  const slug = String(formData.get('slug') || '')
  const country = String(formData.get('country') || 'BR').toUpperCase()
  const currency = String(formData.get('currency') || currencyByCountry[country] || '').toUpperCase()
  const price = Number(formData.get('price'))
  if (!slug || !allowedCurrencies.has(currency) || !Number.isFinite(price) || price <= 0) return

  if (id) {
    const { error } = await supabaseAdmin
      .from('studio_plan_country_pricing')
      .update({ price, currency, is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  } else {
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('studio_plan_country_pricing')
      .select('id')
      .eq('plan_slug', slug)
      .eq('country', country)
      .maybeSingle()
    if (lookupError) throw lookupError

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from('studio_plan_country_pricing')
        .update({ price, currency, is_active: true, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabaseAdmin
        .from('studio_plan_country_pricing')
        .insert({ plan_slug: slug, country, currency, price, is_active: true })
      if (error) throw error
    }
  }

  if (country === 'BR') {
    const { error: planError } = await supabaseAdmin
      .from('dccmusic_plans')
      .update({ price, updated_at: new Date().toISOString() })
      .eq('slug', slug)
    if (planError) throw planError
  }

  revalidatePath('/admin/precos')
  revalidatePath('/studio-ia')
  revalidatePath('/compositores/planos')
  redirectAfterSave(country, currency)
}

async function updateBasePlanPrice(formData: FormData) {
  'use server'
  await requireAuth()
  const id = String(formData.get('id') || '')
  const price = Number(formData.get('price'))
  if (!id || !Number.isFinite(price) || price <= 0) return

  const { error } = await supabaseAdmin
    .from('dccmusic_plans')
    .update({ price, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error

  revalidatePath('/admin/precos')
  revalidatePath('/compositores/planos')
  redirectAfterSave('BR', 'BRL')
}

export default async function AdminPricingPage({
  searchParams,
}: {
  searchParams?: { pais?: string; moeda?: string; updated?: string }
}) {
  await requireAuth()

  const requestedCountry = String(searchParams?.pais || 'BR').toUpperCase()
  const selectedCountry = countries.some((country) => country.code === requestedCountry)
    ? requestedCountry
    : 'BR'
  const showUpdatedToast = searchParams?.updated === '1'
  const requestedCurrency = String(searchParams?.moeda || currencyByCountry[selectedCountry] || 'BRL').toUpperCase()
  const selectedCurrency = allowedCurrencies.has(requestedCurrency)
    ? requestedCurrency
    : currencyByCountry[selectedCountry]

  const [{ data: topups, error: topupError }, { data: countryPlans, error: countryPlanError }, { data: plans, error: plansError }] = await Promise.all([
    supabaseAdmin
      .from('studio_topup_pricing')
      .select('id,country,currency,min_quantity,max_quantity,unit_price,label,is_active')
      .eq('is_active', true)
      .order('country')
      .order('min_quantity'),
    supabaseAdmin
      .from('studio_plan_country_pricing')
      .select('id,plan_slug,country,currency,price,is_active')
      .eq('is_active', true)
      .order('plan_slug')
      .order('country'),
    supabaseAdmin
      .from('dccmusic_plans')
      .select('id,slug,name,price,is_active')
      .order('name'),
  ])

  if (topupError) throw topupError
  if (countryPlanError) throw countryPlanError
  if (plansError) throw plansError

  const planNames = new Map((plans || []).map((plan: any) => [plan.slug, plan.name]))
  const composerPlans = (plans || []).filter((plan: any) => !studioPlanSlugs.has(plan.slug) && plan.is_active)
  const filteredTopups = (topups || []).filter((row: any) => row.country === selectedCountry)
  const filteredCountryPlans = (countryPlans || []).filter((row: any) => row.country === selectedCountry && studioPlanSlugs.has(row.plan_slug))
  const composerCountryPrices = new Map(
    (countryPlans || [])
      .filter((row: any) => row.country === selectedCountry && !studioPlanSlugs.has(row.plan_slug))
      .map((row: any) => [row.plan_slug, row])
  )
  const selectedLabel = countryLabels[selectedCountry] || selectedCountry
  const selectedFlag = countryFlags[selectedCountry] || ''

  return (
    <div className="min-h-screen py-8">
      <PriceUpdatedToast show={showUpdatedToast} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
          <FiArrowLeft /> Voltar ao Admin
        </Link>

        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-950/40 px-4 py-2 text-sm text-purple-200">
            <FiDollarSign /> Fonte oficial: Supabase
          </div>
          <h1 className="text-4xl font-black"><span className="gradient-text">Preços e Planos</span></h1>
          <p className="mt-2 max-w-3xl text-gray-400">Altere os valores cobrados no Studio IA e nos planos. As mudanças passam a valer sem novo deploy.</p>
        </div>

        <section className="mb-8 rounded-3xl border border-gray-800 bg-gray-950/70 p-5 sm:p-6">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Filtrar país</p>
            <h2 className="mt-1 text-xl font-black text-white">{selectedFlag} {selectedLabel}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {countries.map((country) => {
              const active = country.code === selectedCountry
              return (
                <Link
                  key={country.code}
                  href={`/admin/precos?pais=${country.code}`}
                  className={active
                    ? 'inline-flex items-center gap-2 rounded-xl border border-purple-400 bg-purple-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-purple-950/40'
                    : 'inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-black px-4 py-2.5 text-sm font-bold text-gray-300 transition hover:border-purple-500 hover:text-white'}
                >
                  <span>{country.flag}</span>
                  <span>{country.label}</span>
                </Link>
              )
            })}
          </div>
          <p className="mt-4 text-xs text-gray-500">Abaixo aparecem somente recargas e planos do país selecionado.</p>
          <form method="get" className="mt-5 rounded-2xl border border-gray-800 bg-black/40 p-4">
            <input type="hidden" name="pais" value={selectedCountry} />
            <label htmlFor="pricing-currency" className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Moeda usada neste país</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select id="pricing-currency" name="moeda" defaultValue={selectedCurrency} className="min-h-12 flex-1 rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 font-bold text-white">
                {currencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.label}</option>)}
              </select>
              <button className="rounded-xl bg-purple-600 px-5 py-3 font-black text-white hover:bg-purple-500">Aplicar moeda</button>
            </div>
            <p className="mt-2 text-xs text-gray-500">Os campos abaixo serão exibidos e salvos em {selectedCurrency}.</p>
          </form>
        </section>

        <section className="mb-10 rounded-3xl border border-purple-800/60 bg-black/30 p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-white">Recarga avulsa · {selectedFlag} {selectedLabel}</h2>
              <p className="mt-1 text-sm text-gray-400">Preço por música em cada faixa de quantidade.</p>
            </div>
            <span className="rounded-full border border-gray-800 bg-gray-950 px-3 py-1 text-xs font-bold text-gray-400">{filteredTopups.length} faixas</span>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="text-gray-400"><tr className="border-b border-gray-800"><th className="p-3">Faixa</th><th className="p-3">Moeda</th><th className="p-3">Preço por música</th></tr></thead>
              <tbody>
                {filteredTopups.map((row: any) => (
                  <tr key={row.id} className="border-b border-gray-900">
                    <td className="p-3 font-bold text-white">{row.min_quantity}{row.max_quantity ? ` a ${row.max_quantity}` : '+'} músicas</td>
                    <td className="p-3 text-gray-400">{selectedCurrency}</td>
                    <td className="p-3">
                      <form action={updateTopupPrice} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="country" value={selectedCountry} />
                        <input type="hidden" name="currency" value={selectedCurrency} />
                        <CurrencyPriceInput value={Number(row.unit_price)} currency={selectedCurrency} compact />
                        <button className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 font-bold text-white hover:bg-purple-500"><FiSave /> Salvar</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-10 rounded-3xl border border-purple-800/60 bg-black/30 p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-white">Planos Studio IA · {selectedFlag} {selectedLabel}</h2>
              <p className="mt-1 text-sm text-gray-400">Valores usados na vitrine e no checkout deste país.</p>
            </div>
            <span className="rounded-full border border-gray-800 bg-gray-950 px-3 py-1 text-xs font-bold text-gray-400">{filteredCountryPlans.length} planos</span>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {filteredCountryPlans.map((row: any) => (
              <form key={row.id} action={updateCountryPlanPrice} className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="slug" value={row.plan_slug} />
                <input type="hidden" name="country" value={row.country} />
                <input type="hidden" name="currency" value={selectedCurrency} />
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div><p className="font-black text-white">{planNames.get(row.plan_slug) || row.plan_slug}</p><p className="text-xs text-gray-500">{selectedFlag} {selectedLabel} · {selectedCurrency}</p></div>
                  <button className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-bold text-white hover:bg-purple-500"><FiSave /> Salvar</button>
                </div>
                <CurrencyPriceInput value={Number(row.price)} currency={selectedCurrency} />
              </form>
            ))}
          </div>
        </section>

        {composerPlans.length > 0 ? (
          <section className="mb-10 rounded-3xl border border-gray-800 bg-black/30 p-5 sm:p-7">
            <h2 className="text-2xl font-black text-white">Planos Compositor Premium · {selectedFlag} {selectedLabel}</h2>
            <p className="mt-1 text-sm text-gray-400">Valores usados na vitrine e cobrados no checkout deste país.</p>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {composerPlans.map((plan: any) => {
                const countryPrice: any = composerCountryPrices.get(plan.slug)
                const isBrazil = selectedCountry === 'BR'
                const formCurrency = isBrazil ? 'BRL' : selectedCurrency
                return (
                  <form key={plan.id} action={isBrazil ? updateBasePlanPrice : updateCountryPlanPrice} className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                    <input type="hidden" name="id" value={isBrazil ? plan.id : countryPrice?.id || ''} />
                    <input type="hidden" name="slug" value={plan.slug} />
                    <input type="hidden" name="country" value={selectedCountry} />
                    <input type="hidden" name="currency" value={formCurrency} />
                    <div className="mb-3 flex items-center justify-between gap-3"><div><p className="font-black text-white">{plan.name}</p><p className="text-xs text-gray-500">{plan.slug} · {formCurrency}</p></div><button className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm font-bold hover:bg-gray-700"><FiSave /> {countryPrice || isBrazil ? 'Salvar' : 'Cadastrar'}</button></div>
                    <CurrencyPriceInput value={Number(isBrazil ? plan.price : countryPrice?.price || 0)} currency={formCurrency} />
                  </form>
                )
              })}
            </div>
          </section>
        ) : null}

        <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5 text-sm text-gray-400">
          Para alterar nome, créditos, benefícios ou ativação estrutural de um plano, as páginas antigas continuam disponíveis internamente: <Link href="/admin/studio-planos" className="text-purple-300 hover:underline">estrutura Studio</Link> e <Link href="/admin/planos" className="text-purple-300 hover:underline">estrutura DCC Music</Link>.
        </div>
      </div>
    </div>
  )
}
