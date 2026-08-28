import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'
import { FiArrowLeft, FiDollarSign, FiSave } from 'react-icons/fi'

const countryLabels: Record<string, string> = {
  BR: 'Brasil',
  PY: 'Paraguai',
  CO: 'Colômbia',
  PT: 'Portugal',
  MX: 'México',
}

function priceStep(currency: string) {
  return currency === 'PYG' || currency === 'COP' ? '100' : '0.01'
}

async function updateTopupPrice(formData: FormData) {
  'use server'
  await requireAuth()
  const id = String(formData.get('id') || '')
  const price = Number(formData.get('price'))
  if (!id || !Number.isFinite(price) || price <= 0) return

  const { error } = await supabaseAdmin
    .from('studio_topup_pricing')
    .update({ unit_price: price, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error

  revalidatePath('/admin/precos')
  revalidatePath('/studio-ia')
}

async function updateCountryPlanPrice(formData: FormData) {
  'use server'
  await requireAuth()
  const id = String(formData.get('id') || '')
  const slug = String(formData.get('slug') || '')
  const country = String(formData.get('country') || '')
  const price = Number(formData.get('price'))
  if (!id || !slug || !Number.isFinite(price) || price <= 0) return

  const { error } = await supabaseAdmin
    .from('studio_plan_country_pricing')
    .update({ price, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error

  // Mantém o preço-base do plano sincronizado para o fallback do Brasil.
  if (country === 'BR') {
    const { error: planError } = await supabaseAdmin
      .from('dccmusic_plans')
      .update({ price, updated_at: new Date().toISOString() })
      .eq('slug', slug)
    if (planError) throw planError
  }

  revalidatePath('/admin/precos')
  revalidatePath('/studio-ia')
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
}

export default async function AdminPricingPage() {
  await requireAuth()

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
  const studioSlugs = new Set((countryPlans || []).map((row: any) => row.plan_slug))
  const generalPlans = (plans || []).filter((plan: any) => !studioSlugs.has(plan.slug))

  return (
    <div className="min-h-screen py-8">
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

        <section className="mb-10 rounded-3xl border border-purple-800/60 bg-black/30 p-5 sm:p-7">
          <h2 className="text-2xl font-black text-white">Recarga avulsa Studio IA</h2>
          <p className="mt-1 text-sm text-gray-400">Preço por música, por país e faixa de quantidade.</p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-gray-400"><tr className="border-b border-gray-800"><th className="p-3">País</th><th className="p-3">Faixa</th><th className="p-3">Moeda</th><th className="p-3">Preço por música</th><th className="p-3">Ação</th></tr></thead>
              <tbody>
                {(topups || []).map((row: any) => (
                  <tr key={row.id} className="border-b border-gray-900">
                    <td className="p-3 font-bold text-white">{countryLabels[row.country] || row.country}</td>
                    <td className="p-3 text-gray-300">{row.min_quantity}{row.max_quantity ? ` a ${row.max_quantity}` : '+'} músicas</td>
                    <td className="p-3 text-gray-400">{row.currency}</td>
                    <td className="p-3">
                      <form action={updateTopupPrice} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={row.id} />
                        <input name="price" type="number" min="0.01" step={priceStep(row.currency)} defaultValue={Number(row.unit_price)} className="w-36 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-bold text-white" />
                        <button className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 font-bold text-white hover:bg-purple-500"><FiSave /> Salvar</button>
                      </form>
                    </td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-10 rounded-3xl border border-purple-800/60 bg-black/30 p-5 sm:p-7">
          <h2 className="text-2xl font-black text-white">Planos Studio IA por país</h2>
          <p className="mt-1 text-sm text-gray-400">Valores usados na vitrine e no checkout internacional.</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {(countryPlans || []).map((row: any) => (
              <form key={row.id} action={updateCountryPlanPrice} className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="slug" value={row.plan_slug} />
                <input type="hidden" name="country" value={row.country} />
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div><p className="font-black text-white">{planNames.get(row.plan_slug) || row.plan_slug}</p><p className="text-xs text-gray-500">{countryLabels[row.country] || row.country} · {row.currency}</p></div>
                  <button className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-bold text-white hover:bg-purple-500"><FiSave /> Salvar</button>
                </div>
                <input name="price" type="number" min="0.01" step={priceStep(row.currency)} defaultValue={Number(row.price)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-xl font-black text-white" />
              </form>
            ))}
          </div>
        </section>

        {generalPlans.length > 0 ? (
          <section className="mb-10 rounded-3xl border border-gray-800 bg-black/30 p-5 sm:p-7">
            <h2 className="text-2xl font-black text-white">Outros planos DCC Music</h2>
            <p className="mt-1 text-sm text-gray-400">Preço-base dos planos que não usam a tabela internacional do Studio.</p>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {generalPlans.map((plan: any) => (
                <form key={plan.id} action={updateBasePlanPrice} className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                  <input type="hidden" name="id" value={plan.id} />
                  <div className="mb-3 flex items-center justify-between"><div><p className="font-black text-white">{plan.name}</p><p className="text-xs text-gray-500">{plan.slug} · BRL</p></div><button className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm font-bold hover:bg-gray-700"><FiSave /> Salvar</button></div>
                  <input name="price" type="number" min="0.01" step="0.01" defaultValue={Number(plan.price)} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-xl font-black text-white" />
                </form>
              ))}
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
