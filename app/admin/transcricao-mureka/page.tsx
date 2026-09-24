'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'

export default function AdminMurekaTranscriptionPage() {
  const [audio, setAudio] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [zipUrl, setZipUrl] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!audio || loading) return
    setLoading(true)
    setError('')
    setZipUrl('')
    try {
      const data = new FormData()
      data.set('audio', audio)
      const response = await fetch('/api/admin/transcricao-mureka', { method: 'POST', body: data })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Erro ao transcrever.')
      setZipUrl(result.zipUrl)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Erro ao transcrever.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="mx-auto max-w-xl px-5 py-16 text-white">
    <Link href="/admin" className="text-sm text-purple-300">← Voltar ao admin</Link>
    <h1 className="mt-6 text-3xl font-bold">Transcrição pelo Mureka</h1>
    <p className="mt-3 text-gray-300">Envie uma música para obter os arquivos de partitura e acordes do Mureka. O serviço usa seu saldo Mureka; não desconta créditos DCC.</p>
    <form onSubmit={submit} className="mt-8 space-y-5 rounded-xl border border-gray-700 bg-gray-900 p-6">
      <label className="block text-sm font-medium" htmlFor="audio-mureka">Música em MP3 ou M4A (até 10 MB)</label>
      <input id="audio-mureka" type="file" accept=".mp3,.m4a,audio/mpeg,audio/mp4" required onChange={event => setAudio(event.target.files?.[0] || null)} className="block w-full text-sm" />
      <button type="submit" disabled={!audio || loading} className="rounded-lg bg-purple-600 px-5 py-3 font-semibold disabled:opacity-50">{loading ? 'Enviando e transcrevendo…' : 'Gerar transcrição'}</button>
    </form>
    {error && <p role="alert" className="mt-5 text-red-300">{error}</p>}
    {zipUrl && <div className="mt-6 rounded-xl border border-green-700 p-5"><p className="mb-3">Transcrição concluída.</p><a href={zipUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-green-300 underline">Baixar arquivos ZIP</a></div>}
  </main>
}
