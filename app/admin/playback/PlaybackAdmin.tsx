'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FiArrowLeft, FiDownload, FiLoader, FiMusic, FiSearch, FiUploadCloud, FiVolumeX } from 'react-icons/fi'

type Song = { id: string; title: string; versionName: string; composer: string; createdAt: string }

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Algo deu errado.')
  return data
}

export default function PlaybackAdmin() {
  const [mode, setMode] = useState<'upload' | 'dcc'>('upload')
  const [songs, setSongs] = useState<Song[]>([])
  const [loadingSongs, setLoadingSongs] = useState(true)
  const [query, setQuery] = useState('')
  const [versionId, setVersionId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<{ downloadUrl: string; vocalUrl?: string | null; fileName: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/playback', { cache: 'no-store' })
      .then(readJson)
      .then((data) => {
        if (!cancelled) {
          setSongs(data.songs || [])
          setVersionId(data.songs?.[0]?.id || '')
        }
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoadingSongs(false))
    return () => { cancelled = true }
  }, [])

  const filteredSongs = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return songs
    return songs.filter((song) => `${song.title} ${song.versionName} ${song.composer}`.toLowerCase().includes(term))
  }, [query, songs])

  async function createPlayback() {
    setError('')
    setMessage('')
    setResult(null)
    setBusy(true)
    try {
      let body: any
      if (mode === 'upload') {
        if (!file) throw new Error('Escolha uma música para enviar.')
        if (file.size > 20 * 1024 * 1024) throw new Error('O áudio precisa ter no máximo 20 MB.')
        setMessage('Enviando a música...')
        const prepared = await readJson(await fetch('/api/admin/playback/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, contentType: file.type || 'audio/mpeg', sizeBytes: file.size }),
        }))
        const uploadResponse = await fetch(prepared.upload.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': prepared.upload.contentType },
          body: file,
        })
        if (!uploadResponse.ok) throw new Error('Falha ao enviar o áudio.')
        body = { upload: prepared.upload, title: file.name.replace(/\.[^.]+$/, '') }
      } else {
        if (!versionId) throw new Error('Escolha uma música produzida na DCC.')
        body = { versionId }
      }

      setMessage('Retirando a voz e montando o playback. Isso pode levar alguns minutos...')
      const data = await readJson(await fetch('/api/admin/playback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }))
      setResult({ downloadUrl: data.downloadUrl, vocalUrl: data.vocalUrl, fileName: data.fileName })
      setMessage(data.message)
    } catch (err: any) {
      setError(err.message || 'Erro ao criar playback.')
      setMessage('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6">
        <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-primary-300 hover:text-primary-200">
          <FiArrowLeft /> Voltar ao Admin
        </Link>

        <section className="overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-950/60 via-gray-950 to-black p-6 shadow-2xl shadow-purple-950/30 sm:p-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-950/40 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-purple-100">
            <FiVolumeX /> Ferramenta administrativa
          </div>
          <h1 className="text-3xl font-black sm:text-5xl"><span className="gradient-text">Retirar Voz (Playback)</span></h1>
          <p className="mt-3 max-w-3xl text-gray-300">Envie uma música ou escolha uma produção do Studio IA. A voz será separada e você receberá o instrumental pronto para baixar.</p>
        </section>

        <section className="mt-6 rounded-3xl border border-gray-800 bg-gray-950/80 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setMode('upload')} className={`rounded-2xl border p-4 text-left transition ${mode === 'upload' ? 'border-primary-400 bg-primary-950/40' : 'border-gray-800 bg-black/30 hover:border-purple-600'}`}>
              <FiUploadCloud className="mb-2 h-6 w-6 text-primary-300" />
              <strong className="block text-white">Subir uma música</strong>
              <span className="mt-1 block text-xs text-gray-400">MP3, WAV, M4A ou outro áudio, até 20 MB.</span>
            </button>
            <button type="button" onClick={() => setMode('dcc')} className={`rounded-2xl border p-4 text-left transition ${mode === 'dcc' ? 'border-primary-400 bg-primary-950/40' : 'border-gray-800 bg-black/30 hover:border-purple-600'}`}>
              <FiMusic className="mb-2 h-6 w-6 text-primary-300" />
              <strong className="block text-white">Escolher uma produzida aqui</strong>
              <span className="mt-1 block text-xs text-gray-400">Busca as músicas recentes do Studio IA.</span>
            </button>
          </div>

          {mode === 'upload' ? (
            <label className="mt-5 block rounded-2xl border border-dashed border-purple-500/50 bg-purple-950/15 p-5">
              <span className="mb-3 block font-bold text-purple-100">Escolha o arquivo de áudio</span>
              <input type="file" accept="audio/*" onChange={(event) => setFile(event.target.files?.[0] || null)} className="w-full text-sm text-gray-300 file:mr-4 file:rounded-xl file:border-0 file:bg-primary-600 file:px-4 file:py-3 file:font-bold file:text-white" />
              {file && <span className="mt-3 block text-sm text-gray-300">Selecionado: {file.name}</span>}
            </label>
          ) : (
            <div className="mt-5">
              <label className="mb-3 flex items-center gap-2 rounded-xl border border-gray-700 bg-black/40 px-4">
                <FiSearch className="text-gray-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por música ou compositor..." className="w-full bg-transparent py-3 text-white outline-none" />
              </label>
              <select value={versionId} onChange={(event) => setVersionId(event.target.value)} disabled={loadingSongs} className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white">
                {loadingSongs && <option>Carregando músicas...</option>}
                {!loadingSongs && filteredSongs.length === 0 && <option value="">Nenhuma música encontrada</option>}
                {filteredSongs.map((song) => <option key={song.id} value={song.id}>{song.title} — {song.composer} ({song.versionName})</option>)}
              </select>
            </div>
          )}

          {message && <div className="mt-5 rounded-2xl border border-emerald-700/50 bg-emerald-950/30 p-4 text-sm text-emerald-100">{message}</div>}
          {error && <div className="mt-5 rounded-2xl border border-red-700/50 bg-red-950/30 p-4 text-sm text-red-100">{error}</div>}

          <button type="button" onClick={createPlayback} disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-4 font-black text-white transition hover:scale-[1.01] disabled:opacity-60">
            {busy ? <FiLoader className="animate-spin" /> : <FiVolumeX />}
            {busy ? 'Criando playback...' : 'Retirar voz e criar playback'}
          </button>

          {result && (
            <div className="mt-6 rounded-2xl border border-green-500/40 bg-green-950/20 p-5">
              <h2 className="text-xl font-black text-green-100">Separação concluída!</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-cyan-700/40 bg-black/25 p-4">
                  <p className="font-black text-cyan-100">Playback</p>
                  <audio controls src={result.downloadUrl} className="mt-3 w-full" />
                  <a href={result.downloadUrl} download={result.fileName} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 font-black text-white hover:bg-cyan-500">
                    <FiDownload /> Baixar playback
                  </a>
                </div>
                <div className="rounded-xl border border-purple-700/40 bg-black/25 p-4">
                  <p className="font-black text-purple-100">Voz isolada</p>
                  {result.vocalUrl ? <>
                    <audio controls src={result.vocalUrl} className="mt-3 w-full" />
                    <a href={result.vocalUrl} download={result.fileName.replace(/playback/i, 'voz')} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 font-black text-white hover:bg-purple-500">
                      <FiDownload /> Baixar voz
                    </a>
                  </> : <p className="mt-3 text-sm text-gray-400">Voz não disponibilizada pelo provedor.</p>}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
