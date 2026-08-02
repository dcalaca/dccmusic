'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiArrowLeft, FiEdit3, FiLoader, FiMusic, FiUploadCloud, FiZap } from 'react-icons/fi'

const improvementOptions = [
  { id: 'similar', label: 'Manter o mais parecido possível', description: 'Tenta preservar letra, melodia, ritmo e essência.' },
  { id: 'professional', label: 'Deixar mais profissional', description: 'Melhora produção, mixagem, voz e instrumentos.' },
  { id: 'vocal', label: 'Destacar a voz', description: 'Busca uma voz mais clara e presente.' },
  { id: 'instruments', label: 'Melhorar instrumentos', description: 'Dá mais corpo ao arranjo e à produção.' },
]

const MAX_AUDIO_DURATION_SECONDS = 270

async function readApiResponse(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text.slice(0, 240) }
  }
}

function getAudioDurationSeconds(file: File) {
  return new Promise<number | null>((resolve) => {
    const audio = document.createElement('audio')
    const objectUrl = URL.createObjectURL(file)
    const cleanup = () => URL.revokeObjectURL(objectUrl)

    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      cleanup()
      resolve(Number.isFinite(audio.duration) ? audio.duration : null)
    }
    audio.onerror = () => {
      cleanup()
      resolve(null)
    }
    audio.src = objectUrl
  })
}

async function uploadAudioDirectToStorage(token: string, file: File, kind: 'enhance-source' | 'transcribe') {
  const prepareResponse = await fetch('/api/compositores/studio/input-upload-url', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contentType: file.type || 'audio/mpeg',
      sizeBytes: file.size,
      fileName: file.name,
      kind,
    }),
  })
  const prepareData = await readApiResponse(prepareResponse)
  if (!prepareResponse.ok) {
    throw new Error(prepareData.error || 'Não foi possível preparar o envio do áudio.')
  }

  const upload = prepareData.upload
  const putResponse = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': upload.contentType || file.type || 'audio/mpeg',
    },
    body: file,
  })
  if (!putResponse.ok) {
    throw new Error('Falha ao enviar o áudio. Tente novamente.')
  }

  return {
    audioPath: upload.path as string,
    audioProvider: upload.provider as string,
    audioContentType: upload.contentType as string,
    audioSizeBytes: Number(upload.sizeBytes) || file.size,
  }
}

export default function ImproveReadyMusicPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selectedImprovement, setSelectedImprovement] = useState('similar')
  const [lyric, setLyric] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)

  const ensureToken = () => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login?redirect=/compositores/admin/studio-ia/melhorar/musica-pronta')
      return null
    }
    return token
  }

  const transcribeAudio = async () => {
    const token = ensureToken()
    if (!token) return
    if (!audioFile) {
      setError('Escolha o áudio da música antes de pedir para entender a letra.')
      return
    }

    setTranscribing(true)
    setError('')
    setMessage('Enviando áudio e entendendo a letra...')
    try {
      const uploaded = await uploadAudioDirectToStorage(token, audioFile, 'transcribe')
      const response = await fetch('/api/compositores/studio/transcribe', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploaded),
      })
      const data = await readApiResponse(response)
      if (!response.ok) throw new Error(data.error || 'Não consegui entender o áudio.')
      setLyric(data.text || '')
      setMessage('Letra transcrita do áudio. Revise e corrija se precisar antes de melhorar.')
    } catch (err: any) {
      setError(err.message || 'Erro ao transcrever áudio.')
      setMessage('')
    } finally {
      setTranscribing(false)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const token = ensureToken()
    if (!token) return

    const form = event.currentTarget
    const title = String(new FormData(form).get('title') || '').trim()
    const style = String(new FormData(form).get('style') || '').trim()

    if (!audioFile || audioFile.size <= 0) {
      setError('Escolha o áudio da música que deseja melhorar.')
      return
    }
    const duration = await getAudioDurationSeconds(audioFile)
    if (duration && duration > MAX_AUDIO_DURATION_SECONDS) {
      setError('Esse áudio passou de 4 minutos e 30 segundos. Envie uma versão mais curta para a IA trabalhar melhor.')
      return
    }

    setSubmitting(true)
    setError('')
    setMessage(lyric.trim()
      ? 'Enviando música...'
      : 'Enviando áudio, entendendo a letra e iniciando a melhoria...')
    try {
      const uploaded = await uploadAudioDirectToStorage(token, audioFile, 'enhance-source')
      const response = await fetch('/api/compositores/studio/enhance', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          style,
          improvement: selectedImprovement,
          lyric: lyric.trim(),
          ...uploaded,
        }),
      })
      const data = await readApiResponse(response)
      if (!response.ok) throw new Error(data.error || 'Erro ao melhorar música')

      window.dispatchEvent(new Event('studioBalanceChange'))
      setMessage(
        data.lyricTranscribed
          ? 'Letra transcrita do áudio e melhoria iniciada. Abrindo o projeto...'
          : 'Melhoria iniciada. Vamos abrir o projeto para você acompanhar.'
      )
      window.setTimeout(() => {
        router.push(`/compositores/admin/studio-ia/projetos/${data.projectId}`)
      }, 900)
    } catch (err: any) {
      setError(err.message || 'Erro ao melhorar música')
      setMessage('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Link href="/compositores/admin/studio-ia/melhorar" className="mb-6 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300">
            <FiArrowLeft /> Voltar
          </Link>

          <section className="mb-6 rounded-3xl border border-purple-700/60 bg-gradient-to-br from-black via-gray-950 to-purple-950/60 p-5 sm:p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-950/40 px-3 py-1 text-xs font-bold text-purple-100">
              <FiZap /> Música pronta
            </div>
            <h1 className="text-3xl font-black sm:text-5xl">
              <span className="gradient-text">Enviar música pronta</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
              Envie uma música já gravada (voz e violão, demo, celular...). A IA tenta manter melodia, letra e essência, com produção mais profissional e duração máxima de 4:30.
            </p>
            <p className="mt-3 rounded-2xl border border-emerald-700/60 bg-emerald-950/20 p-3 text-sm text-emerald-100">
              Sem letra digitada? Ao clicar em <strong>Melhorar</strong>, a IA transcreve a letra do áudio <strong>incluída nos 10 créditos</strong>.
              Se quiser revisar antes, use “Entender letra” (custa <strong>1 crédito</strong>).
            </p>
            <p className="mt-3 rounded-2xl border border-yellow-700/60 bg-yellow-950/20 p-3 text-sm text-yellow-100">
              Custo: 10 créditos na melhoria. “Entender letra” avulso: 1 crédito (só se você clicar nesse botão).
            </p>
          </section>

          {message && <div className="mb-5 rounded-xl border border-green-800 bg-green-950/50 p-4 text-green-200">{message}</div>}
          {error && <div className="mb-5 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</div>}

          <form onSubmit={submit} className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">Nome da música</span>
                <input name="title" required maxLength={30} placeholder="Ex.: Minha canção" className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">Estilo desejado</span>
                <input name="style" placeholder="Ex.: sertanejo, arrocha, gospel..." className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
              </label>
            </div>

            <label className="mt-4 block rounded-2xl border border-purple-800/70 bg-purple-950/20 p-4">
              <span className="mb-2 flex items-center gap-2 text-sm font-bold text-purple-100"><FiUploadCloud /> Áudio da música</span>
              <input
                name="audio"
                type="file"
                required
                accept="audio/*"
                onChange={(event) => setAudioFile(event.target.files?.[0] || null)}
                className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:font-bold file:text-white"
              />
              <span className="mt-2 block text-xs text-purple-100/80">
                Use áudio de até 4 minutos e 30 segundos (máx. 80 MB). Pode ser demo, guia, voz e violão ou gravação do celular.
              </span>
            </label>

            <div className="mt-5">
              <p className="mb-3 text-sm font-bold text-gray-300">O que você quer melhorar?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {improvementOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedImprovement(option.id)}
                    className={`rounded-2xl border p-4 text-left transition ${selectedImprovement === option.id ? 'border-primary-400 bg-primary-950/40 text-white' : 'border-gray-800 bg-black/30 text-gray-300 hover:border-purple-500'}`}
                  >
                    <span className="block font-black">{option.label}</span>
                    <span className="mt-1 block text-xs text-gray-400">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-gray-300">Letra da música</span>
                <button
                  type="button"
                  onClick={transcribeAudio}
                  disabled={transcribing || submitting || !audioFile}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-600/50 bg-emerald-950/40 px-3 py-2 text-xs font-bold text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {transcribing ? <FiLoader className="animate-spin" /> : <FiEdit3 />}
                  {transcribing ? 'Entendendo letra...' : 'Entender letra (1 crédito)'}
                </button>
              </div>
              <textarea
                name="lyric"
                value={lyric}
                onChange={(event) => setLyric(event.target.value)}
                rows={8}
                placeholder="Opcional: cole a letra, ou deixe em branco que a IA transcreve do áudio ao melhorar. Também pode clicar em “Entender letra do áudio”."
                className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500"
              />
            </div>

            <button type="submit" disabled={submitting || transcribing} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-4 font-black text-white transition hover:scale-[1.01] disabled:opacity-60">
              {submitting ? <FiLoader className="animate-spin" /> : <FiMusic />}
              {submitting ? 'Enviando música...' : 'Melhorar minha música'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
