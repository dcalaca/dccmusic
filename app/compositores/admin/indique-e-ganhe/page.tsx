'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { FiArrowLeft, FiGift, FiCopy, FiCheck, FiMousePointer, FiUsers, FiShoppingBag, FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight, FiLoader, FiShare2, FiCalendar, FiInfo } from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'
import { ReferralPeriod, referralDateRange } from '@/lib/referral-dates'

type HistoryRow = { id: string; date: string; purchaseDate: string | null; releasedAt: string | null; name: string; status: 'registered' | 'pending' | 'released' | 'limit_reached' | 'cancelled'; credits: number }
type Dashboard = { link: string; stats: { clicks: number; signups: number; purchases: number; released: number; pending: number }; history: HistoryRow[]; page: number; pages: number; total: number }
const presets: Exclude<ReferralPeriod, 'custom'>[] = ['today', 'yesterday', 'last7', 'last30', 'month', 'previousMonth']
const tones = { registered: 'border-blue-400/20 bg-blue-400/10 text-blue-200', pending: 'border-amber-400/20 bg-amber-400/10 text-amber-200', released: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200', limit_reached: 'border-gray-500/20 bg-gray-500/10 text-gray-300', cancelled: 'border-red-400/20 bg-red-400/10 text-red-200' }

export default function ReferralPage() {
  const { t, i18n } = useTranslation()
  const [period, setPeriod] = useState<ReferralPeriod>('month')
  const [dates, setDates] = useState(() => referralDateRange('month'))
  const [draft, setDraft] = useState(dates)
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [login, setLogin] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [dateError, setDateError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true); setError('')
      try {
        const token = localStorage.getItem('composer_token')
        if (!token) { setLogin(true); return }
        const params = new URLSearchParams({ ...dates, page: String(page) })
        const response = await fetch(`/api/compositores/indicacoes?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal })
        if (response.status === 401) { setLogin(true); setData(null); return }
        if (!response.ok) throw new Error('load')
        const result: Dashboard = await response.json()
        setData(result)
        if (result.page !== page) setPage(result.page)
      } catch {
        if (!controller.signal.aborted) setError('referrals.loadError')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [dates, page, retry])
  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 3000)
    return () => clearTimeout(timeout)
  }, [copied])

  async function copyLink() {
    if (!data) return
    try { await navigator.clipboard.writeText(data.link); setCopied(true); setCopyError(false) }
    catch { setCopyError(true) }
  }
  function selectPreset(value: Exclude<ReferralPeriod, 'custom'>) {
    const range = referralDateRange(value)
    setPeriod(value); setDates(range); setDraft(range); setPage(1); setDateError(false)
  }
  const number = (value: number) => value.toLocaleString(i18n.language)
  const date = (value: string) => new Date(value).toLocaleDateString(i18n.language, { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })
  const whatsapp = data ? `https://wa.me/?text=${encodeURIComponent(t('referrals.shareMessage', { link: data.link }))}` : '#'
  const stats = data?.stats

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-6 text-white sm:px-6">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/compositores/admin/studio-ia/projetos" aria-label={t('common.actions.back')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-purple-400"><FiArrowLeft /></Link>
        <div><h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t('referrals.title')}</h1><p className="mt-1 text-sm text-gray-400">{t('referrals.subtitle')}</p></div>
      </header>

      {login ? <section className="rounded-2xl border border-white/10 bg-gray-900/60 p-6"><p className="mb-4 text-gray-300">{t('referrals.loginNeeded')}</p><Link href="/compositores/login?redirect=/compositores/admin/indique-e-ganhe" className="inline-flex rounded-xl bg-primary-600 px-5 py-3 font-semibold">{t('emailMagic.signIn')}</Link></section> : <>
        <section className="relative overflow-hidden rounded-3xl border border-purple-400/20 bg-gradient-to-br from-[#27143f] via-[#171222] to-[#11121b] p-5 shadow-xl shadow-black/10 sm:p-7">
          <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="relative flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-purple-400/25 bg-purple-500/15 text-purple-200"><FiGift className="h-6 w-6" /></span><div><h2 className="text-lg font-bold sm:text-xl">{t('referrals.linkTitle')}</h2><p className="mt-1 text-sm leading-relaxed text-purple-100/70">{t('referrals.linkDescription')}</p></div></div>
          <div className="relative mt-5 flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/15 bg-black/25 px-4"><FiShare2 className="shrink-0 text-purple-300" /><span className="sr-only">{t('referrals.yourLink')}</span><input readOnly value={data?.link || ''} placeholder={t('common.status.loading')} onFocus={event => event.target.select()} className="h-12 w-full min-w-0 bg-transparent text-sm text-gray-100 outline-none" /></label>
            <button type="button" disabled={!data} onClick={copyLink} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold transition hover:bg-purple-500 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-white">{copied ? <FiCheck /> : <FiCopy />}{t(copied ? 'referrals.copied' : 'referrals.copyLink')}</button>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-disabled={!data} onClick={event => { if (!data) event.preventDefault() }} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-5 py-3 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/20 focus-visible:ring-2 focus-visible:ring-emerald-300 ${!data ? 'pointer-events-none opacity-40' : ''}`}><FaWhatsapp className="h-5 w-5" />{t('referrals.whatsapp')}</a>
          </div>
          <p role="status" className="mt-2 text-sm text-purple-200">{copied ? t('referrals.copySuccess') : copyError ? t('referrals.copyError') : ''}</p>
          <ol className="mt-4 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
            {['stepShare', 'stepBuy', 'stepEarn'].map((key, index) => <li key={key} className="flex items-start gap-3 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-400/15 text-xs font-bold text-purple-200">{index + 1}</span><span className="leading-relaxed text-gray-200">{t(`referrals.${key}`)}</span></li>)}
          </ol>
        </section>

        <section aria-label={t('referrals.period')} className="mb-5 mt-7 rounded-2xl border border-white/10 bg-gray-900/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><FiCalendar className="text-purple-300" />{t('referrals.period')}</div>
          <div className="flex flex-wrap gap-2">{presets.map(value => <button key={value} type="button" aria-pressed={period === value} onClick={() => selectPreset(value)} className={`min-h-10 rounded-lg border px-3 py-2 text-sm transition focus-visible:ring-2 focus-visible:ring-purple-400 ${period === value ? 'border-purple-400/50 bg-purple-500/20 font-semibold text-purple-100' : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'}`}>{t(`referrals.periods.${value}`)}</button>)}</div>
          <form onSubmit={event => { event.preventDefault(); if (!draft.start || !draft.end || draft.start > draft.end) { setDateError(true); return }; setDateError(false); setPeriod('custom'); setDates({ ...draft }); setPage(1) }} className="mt-4 grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
            <label className="min-w-0 text-xs text-gray-400">{t('referrals.startDate')}<input type="date" required value={draft.start} onChange={event => setDraft(value => ({ ...value, start: event.target.value }))} className="mt-1.5 block min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-gray-950 px-3 py-2 text-sm text-white [color-scheme:dark] sm:w-44" /></label>
            <label className="min-w-0 text-xs text-gray-400">{t('referrals.endDate')}<input type="date" required value={draft.end} onChange={event => setDraft(value => ({ ...value, end: event.target.value }))} className="mt-1.5 block min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-gray-950 px-3 py-2 text-sm text-white [color-scheme:dark] sm:w-44" /></label>
            <button type="submit" className="col-span-2 min-h-11 rounded-lg border border-purple-400/30 bg-purple-500/10 px-5 py-2 text-sm font-semibold text-purple-200 hover:bg-purple-500/20">{t('referrals.apply')}</button>
            <p className="col-span-2 text-xs text-gray-500 sm:ml-auto">{t('referrals.brasilia')}</p>
          </form>
          {dateError && <p role="alert" className="mt-3 text-sm text-red-300">{t('referrals.invalidDates')}</p>}
        </section>

        {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/25 bg-red-500/5 p-4 text-sm text-red-200"><p>{t(error)}</p><button onClick={() => setRetry(value => value + 1)} className="rounded-lg bg-gray-800 px-4 py-2 font-semibold text-white">{t('common.actions.tryAgain')}</button></div>}

        <section aria-label={t('referrals.results')} aria-busy={loading} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { key: 'clicks', icon: FiMousePointer, value: stats?.clicks, detail: 'clicksDescription', color: 'text-sky-300 bg-sky-400/10' },
            { key: 'signups', icon: FiUsers, value: stats?.signups, detail: 'signupsDescription', color: 'text-purple-300 bg-purple-400/10' },
            { key: 'purchases', icon: FiShoppingBag, value: stats?.purchases, detail: 'purchasesDescription', color: 'text-amber-300 bg-amber-400/10' },
          ].map(card => <article key={card.key} className="rounded-2xl border border-white/10 bg-[#11121b] p-5"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-medium text-gray-300">{t(`referrals.${card.key}`)}</h2><span className={`rounded-xl p-2.5 ${card.color}`}><card.icon className="h-4 w-4" /></span></div><p className="mt-2 text-3xl font-bold tabular-nums">{loading || error ? '—' : number(card.value || 0)}</p><p className="mt-2 text-xs leading-relaxed text-gray-500">{t(`referrals.${card.detail}`)}</p></article>)}
          <article className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.08] to-[#11121b] p-5"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-medium text-gray-200">{t('referrals.credits')}</h2><span className="rounded-xl bg-emerald-400/10 p-2.5 text-emerald-300"><FiGift className="h-4 w-4" /></span></div><p className="mt-2 text-3xl font-bold tabular-nums text-emerald-200">{loading || error ? '—' : number((stats?.released || 0) + (stats?.pending || 0))}<span className="ml-2 text-xs font-normal text-gray-400">{t('referrals.creditUnit')}</span></p><div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs"><span className="text-emerald-300">{t('referrals.releasedShort')}: {loading || error ? '—' : number(stats?.released || 0)}</span><span className="text-amber-300">{t('referrals.pendingShort')}: {loading || error ? '—' : number(stats?.pending || 0)}</span></div></article>
        </section>

        <section className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-[#11121b]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-5"><div><h2 className="font-bold">{t('referrals.history')}</h2><p className="mt-1 text-xs text-gray-500">{t('referrals.historyDescription')}</p></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-gray-400">{t('referrals.tenPerPage')}</span></div>
          {loading ? <div role="status" className="flex items-center justify-center gap-2 p-12 text-sm text-gray-400"><FiLoader className="animate-spin" />{t('common.status.loading')}</div> : error ? <p className="p-8 text-center text-sm text-gray-500">{t('referrals.historyUnavailable')}</p> : !data?.history.length ? <div className="px-5 py-12 text-center"><span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300"><FiUsers className="h-6 w-6" /></span><p className="font-semibold text-gray-200">{t('referrals.empty')}</p><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-500">{t('referrals.emptyDescription')}</p></div> : <>
            <div className="hidden grid-cols-[1fr_1.5fr_2fr_1fr] gap-4 border-b border-white/5 px-5 py-3 text-xs text-gray-500 sm:grid"><span>{t('referrals.date')}</span><span>{t('referrals.friend')}</span><span>{t('referrals.status')}</span><span className="text-right">{t('referrals.creditsColumn')}</span></div>
            {data.history.map(row => <article key={row.id} className="grid grid-cols-2 items-center gap-3 border-b border-white/5 px-5 py-4 last:border-0 sm:grid-cols-[1fr_1.5fr_2fr_1fr] sm:gap-4">
              <div className="order-2 text-right text-xs tabular-nums text-gray-400 sm:order-none sm:text-left">{date(row.date)}</div><div className="order-1 truncate text-sm font-medium sm:order-none">{row.name}</div><div className="order-3 sm:order-none"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${tones[row.status]}`}>{t(`referrals.statuses.${row.status}`)}</span>{row.releasedAt && row.status === 'released' && <p className="mt-1 text-[11px] text-gray-500">{t('referrals.releasedOn', { date: date(row.releasedAt) })}</p>}</div><div className={`order-4 text-right text-sm font-bold tabular-nums sm:order-none ${row.status === 'released' ? 'text-emerald-300' : row.status === 'pending' ? 'text-amber-300' : 'text-gray-500'}`}>{row.credits > 0 ? `+${row.credits}` : '—'}<span className="ml-1 text-xs font-normal">{row.credits > 0 ? t('referrals.creditUnit') : ''}</span></div>
            </article>)}
          </>}
          <nav aria-label={t('referrals.pagination')} className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-4"><span className="text-xs text-gray-500">{t('referrals.total', { count: error ? 0 : data?.total || 0 })}</span><div className="flex items-center gap-1">
            {[{ icon: FiChevronsLeft, key: 'first', target: 1, disabled: page <= 1 }, { icon: FiChevronLeft, key: 'previous', target: page - 1, disabled: page <= 1 }].map(button => <button key={button.key} aria-label={t(`referrals.${button.key}`)} title={t(`referrals.${button.key}`)} disabled={button.disabled || loading || !!error} onClick={() => setPage(button.target)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 disabled:opacity-25"><button.icon /></button>)}
            <span aria-live="polite" className="px-3 text-xs tabular-nums text-gray-300">{t('referrals.pageOf', { page: data?.page || 1, pages: data?.pages || 1 })}</span>
            {[{ icon: FiChevronRight, key: 'next', target: page + 1, disabled: !data || page >= data.pages }, { icon: FiChevronsRight, key: 'last', target: data?.pages || 1, disabled: !data || page >= data.pages }].map(button => <button key={button.key} aria-label={t(`referrals.${button.key}`)} title={t(`referrals.${button.key}`)} disabled={button.disabled || loading || !!error} onClick={() => setPage(button.target)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 disabled:opacity-25"><button.icon /></button>)}
          </div></nav>
        </section>

        <details className="mt-5 rounded-2xl border border-white/10 bg-gray-900/30 px-5 py-4 text-sm"><summary className="cursor-pointer font-medium text-gray-300">{t('referrals.rulesTitle')}</summary><ul className="mt-4 space-y-2 pl-4 text-xs leading-relaxed text-gray-400">{['ruleBonus', 'ruleFirstPurchase', 'ruleLimit', 'ruleWindow', 'ruleVerification', 'ruleRefund', 'ruleCredits'].map(key => <li key={key} className="list-disc">{t(`referrals.${key}`)}</li>)}</ul></details>
        <Link href="/indique-e-ganhe" className="mt-4 inline-flex text-sm text-purple-300 underline underline-offset-4">{t('referralHelp.questionsTitle')}</Link>
        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-gray-500"><FiInfo className="mt-0.5 shrink-0" />{t('referrals.dateExplanation')}</p>
      </>}
    </main>
  )
}
