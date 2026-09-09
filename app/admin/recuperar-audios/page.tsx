'use client'

import { useState } from 'react'

export default function RecoverStudioAudioPage() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)

  const recover = async () => {
    setRunning(true)
    setResult(null)
    try {
      const response = await fetch('/api/admin/studio/recover-audio', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível recuperar os áudios.')
      setResult(data)
    } catch (error: any) {
      setResult({ error: error.message || 'Erro ao recuperar.' })
    } finally {
      setRunning(false)
    }
  }

  const recovered = result?.results?.filter((item: any) => item.recovered).length || 0
  const failed = result?.results?.filter((item: any) => !item.recovered).length || 0

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-slate-900 p-7 shadow-2xl">
        <p className="text-sm font-black uppercase tracking-widest text-cyan-300">Recuperação imediata</p>
        <h1 className="mt-2 text-3xl font-black">Recuperar áudios afetados</h1>
        <p className="mt-3 text-slate-300">Busca agora as versões que falharam no armazenamento e salva novamente no R2. Não gera músicas nem desconta créditos.</p>
        <button onClick={recover} disabled={running} className="mt-7 rounded-2xl bg-cyan-500 px-5 py-3 font-black text-slate-950 disabled:opacity-60">
          {running ? 'Recuperando versões…' : 'Recuperar todos agora'}
        </button>
        {result && <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
          {result.error ? <p className="text-red-300">{result.error}</p> : <><p className="font-bold text-emerald-300">{recovered} recuperada(s){failed ? ` · ${failed} pendente(s)` : ''}</p><pre className="mt-3 overflow-auto text-xs text-slate-300">{JSON.stringify(result.results, null, 2)}</pre></>}
        </div>}
      </div>
    </main>
  )
}
