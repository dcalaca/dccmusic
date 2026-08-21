'use client'

import { FormEvent, useState } from 'react'

type Result = { audio?: string; lyrics?: string; description?: string; timingPlan?: string; error?: string; details?: string }

export default function LyriaLabPage() {
  const [prompt, setPrompt] = useState('Brazilian sertanejo universitário, romantic love song, male vocal, acoustic guitar, modern polished production, catchy chorus')
  const [lyrics, setLyrics] = useState('')
  const [bpm, setBpm] = useState('100')
  const [duration, setDuration] = useState('150')
  const [naturalProsody, setNaturalProsody] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function generate(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/lab/lyria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, lyrics, bpm, duration, naturalProsody }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ error: 'Falha ao chamar o laboratório.', details: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-purple-400">DCC Music · Laboratório interno</div>
          <h1 className="text-3xl font-bold sm:text-4xl">Lyria 3 Pro</h1>
          <p className="mt-3 text-sm text-zinc-400">Teste de prosódia, andamento e duração no <code className="text-zinc-300">lyria-3-pro-preview</code>.</p>
        </div>

        <form onSubmit={generate} className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-7">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Descrição / estilo</span>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} required rows={5} className="w-full resize-y rounded-xl border border-zinc-700 bg-black p-4 text-sm outline-none focus:border-purple-500" />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">BPM</span>
              <select value={bpm} onChange={(e) => setBpm(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-black p-3 text-sm">
                <option value="90">90</option><option value="100">100</option><option value="110">110</option><option value="120">120</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Duração</span>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-black p-3 text-sm">
                <option value="120">120s</option><option value="150">150s</option><option value="180">180s</option>
              </select>
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-black p-4">
            <input type="checkbox" checked={naturalProsody} onChange={(e) => setNaturalProsody(e.target.checked)} className="mt-1 h-4 w-4" />
            <span><span className="block text-sm font-medium">Priorizar letra natural</span><span className="mt-1 block text-xs text-zinc-500">Instrui o Lyria a variar melodia, fraseado e compassos em vez de acelerar versos longos.</span></span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">Letra <span className="font-normal text-zinc-500">(opcional)</span></span>
            <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={12} placeholder="[Verse]\n...\n\n[Chorus]\n..." className="w-full resize-y rounded-xl border border-zinc-700 bg-black p-4 text-sm outline-none focus:border-purple-500" />
          </label>
          <button disabled={loading || !prompt.trim()} className="w-full rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? 'Gerando no Lyria…' : 'Gerar música'}
          </button>
        </form>

        {result?.audio && <section className="mt-6 rounded-2xl border border-emerald-900/60 bg-zinc-950 p-5 sm:p-7"><div className="mb-4 text-sm font-semibold text-emerald-400">Geração concluída</div><audio controls className="w-full" src={result.audio} />{result.description && <p className="mt-4 text-sm text-zinc-400">{result.description}</p>}{result.timingPlan && <details className="mt-4 rounded-xl bg-black p-4"><summary className="cursor-pointer text-sm font-medium text-zinc-300">Ver planejamento de tempo da letra</summary><pre className="mt-3 whitespace-pre-wrap text-xs text-zinc-400">{result.timingPlan}</pre></details>}{result.lyrics && <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-black p-4 text-xs text-zinc-300">{result.lyrics}</pre>}</section>}
        {result?.error && <section className="mt-6 rounded-2xl border border-red-900/60 bg-red-950/20 p-5 text-sm"><div className="font-semibold text-red-400">{result.error}</div>{result.details && <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-zinc-400">{result.details}</pre>}</section>}
      </div>
    </main>
  )
}
