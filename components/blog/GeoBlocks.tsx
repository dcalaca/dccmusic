import type { ReactNode } from 'react'

const boxClass = 'my-4 rounded-xl border px-4 py-3'

export function Definition({ children, title = 'Definição rápida' }: { children: ReactNode; title?: string }) {
  return (
    <aside className={`${boxClass} border-purple-500/30 bg-purple-950/20`}>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-purple-300">{title}</p>
      <div className="text-sm leading-6 text-gray-200">{children}</div>
    </aside>
  )
}

export function DirectAnswer({ children, title = 'Resposta direta' }: { children: ReactNode; title?: string }) {
  return (
    <aside className={`${boxClass} border-cyan-500/30 bg-cyan-950/20`}>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-cyan-300">{title}</p>
      <div className="text-sm leading-6 text-gray-200">{children}</div>
    </aside>
  )
}

export function Steps({ children, title = 'Passo a passo' }: { children: ReactNode; title?: string }) {
  return (
    <section className={`${boxClass} border-gray-800 bg-gray-950/70`}>
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="blog-steps">{children}</div>
    </section>
  )
}

export function ProsCons({
  pros,
  cons,
}: {
  pros: string[]
  cons: string[]
}) {
  return (
    <section className="my-6 grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-green-900/60 bg-green-950/20 px-5 py-4">
        <h3 className="mb-3 text-sm font-bold text-green-300">Vantagens</h3>
        <ul className="space-y-2 text-sm text-gray-200">
          {pros.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-red-900/60 bg-red-950/20 px-5 py-4">
        <h3 className="mb-3 text-sm font-bold text-red-300">Desvantagens</h3>
        <ul className="space-y-2 text-sm text-gray-200">
          {cons.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function Comparison({ children, title = 'Comparação' }: { children: ReactNode; title?: string }) {
  return (
    <section className={`${boxClass} border-gray-800 bg-gray-950/70 overflow-x-auto`}>
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">{title}</p>
      {children}
    </section>
  )
}

export function Example({ children, title = 'Exemplo' }: { children: ReactNode; title?: string }) {
  return (
    <aside className={`${boxClass} border-blue-500/30 bg-blue-950/20`}>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-300">{title}</p>
      <div className="text-sm leading-6 text-gray-200">{children}</div>
    </aside>
  )
}

export function Callout({
  children,
  title = 'Importante',
  tone = 'important',
}: {
  children: ReactNode
  title?: string
  tone?: 'important' | 'note'
}) {
  const styles =
    tone === 'note'
      ? 'border-gray-700 bg-gray-900/70 text-gray-300'
      : 'border-amber-500/30 bg-amber-950/20 text-amber-100'
  return (
    <aside className={`${boxClass} ${styles}`}>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide">{title}</p>
      <div className="text-sm leading-6">{children}</div>
    </aside>
  )
}

export function Faq({
  items,
}: {
  items: { question: string; answer: string }[]
}) {
  if (!items?.length) return null
  return (
    <section className="my-6">
      <h2 id="perguntas-frequentes" className="text-lg font-bold text-white">
        Perguntas frequentes
      </h2>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={item.question} className="rounded-xl border border-gray-800 bg-gray-950/50 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">{item.question}</h3>
            <p className="mt-1 text-sm leading-6 text-gray-300">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
