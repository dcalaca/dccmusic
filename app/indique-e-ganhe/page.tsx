import type { Metadata } from 'next'
import Link from 'next/link'
import { FiGift, FiShare2, FiShoppingBag, FiArrowRight, FiHelpCircle } from 'react-icons/fi'
import { createDccI18n } from '@/i18n/server'

const url = 'https://www.dccmusic.online/indique-e-ganhe'
export async function generateMetadata(): Promise<Metadata> {
  const i18n = await createDccI18n()
  const title = i18n.t('referralHelp.metaTitle')
  const description = i18n.t('referralHelp.metaDescription')
  return { title, description, alternates: { canonical: '/indique-e-ganhe' }, openGraph: { title, description, url, type: 'website' }, twitter: { card: 'summary', title, description }, robots: { index: true, follow: true } }
}

export default async function ReferralHelpPage() {
  const i18n = await createDccI18n()
  const t = i18n.t.bind(i18n)
  const questions = t('referralHelp.questions', { returnObjects: true }) as { question: string; answer: string }[]
  const schema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: questions.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) }
  const steps = [FiShare2, FiShoppingBag, FiGift]
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-white sm:px-6 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
      <header className="rounded-3xl border border-purple-400/20 bg-gradient-to-br from-purple-950/70 via-gray-950 to-black px-5 py-10 text-center sm:p-12">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-200"><FiGift className="h-8 w-8" /></span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('referrals.title')}</h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-gray-300">{t('referralHelp.intro')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><span className="rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-sm text-purple-200">{t('referralHelp.yourBonus')}</span><span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">{t('referralHelp.friendBonus')}</span></div>
        <Link href="/compositores/admin/indique-e-ganhe" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-bold hover:bg-purple-500 focus-visible:ring-2 focus-visible:ring-white">{t('referralHelp.openDashboard')}<FiArrowRight /></Link>
        <p className="mt-3 text-xs text-gray-500">{t('referralHelp.accessNote')}</p>
      </header>
      <section className="my-10"><h2 className="mb-5 text-xl font-bold">{t('referrals.rulesTitle')}</h2><ol className="grid gap-4 sm:grid-cols-3">{steps.map((Icon, index) => <li key={index} className="rounded-2xl border border-white/10 bg-gray-900/40 p-5"><div className="mb-4 flex items-center justify-between"><Icon className="h-6 w-6 text-purple-300" /><span className="text-xs font-bold text-gray-500">0{index + 1}</span></div><p className="text-sm leading-relaxed text-gray-200">{t(`referrals.${['stepShare', 'stepBuy', 'stepEarn'][index]}`)}</p></li>)}</ol></section>
      <section className="rounded-2xl border border-white/10 bg-gray-900/30 p-5 sm:p-7"><h2 className="mb-4 text-lg font-bold">{t('referralHelp.trackingTitle')}</h2><p className="text-sm leading-relaxed text-gray-400">{t('referralHelp.trackingDescription')}</p></section>
      <section className="mt-10" aria-labelledby="referral-questions"><h2 id="referral-questions" className="mb-5 flex items-center gap-2 text-xl font-bold"><FiHelpCircle className="text-purple-300" />{t('referralHelp.questionsTitle')}</h2><div className="space-y-3">{questions.map(item => <details key={item.question} className="rounded-xl border border-white/10 bg-gray-900/40 p-5"><summary className="cursor-pointer text-sm font-semibold text-gray-100">{item.question}</summary><p className="mt-4 text-sm leading-relaxed text-gray-400">{item.answer}</p></details>)}</div></section>
      <div className="mt-9 flex flex-wrap justify-center gap-5 text-sm"><Link href="/faq" className="text-purple-300 underline underline-offset-4 hover:text-purple-200">{t('referralHelp.allQuestions')}</Link><Link href="/compositores/admin/indique-e-ganhe" className="text-purple-300 underline underline-offset-4 hover:text-purple-200">{t('referralHelp.openDashboard')}</Link></div>
    </main>
  )
}
