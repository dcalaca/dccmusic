'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiArrowLeft, FiLoader, FiMic, FiRefreshCw } from 'react-icons/fi'

async function readJson(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text.slice(0, 240) }
  }
}

export default function RegravarFraseVozPage() {
  const router = useRouter()
  const [voices, setVoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login?redirect=/compositores/admin/minhas-vozes/regravar')
      return
    }

    fetch('/api/compositores/studio/voices', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(readJson)
      .then((data) => setVoices((data.voices || []).filter((voice: any) => voice.status === 'ready')))
      .catch(() => setError('Não foi possível carregar as vozes prontas.'))
      .finally(() => setLoading(false))
  }, [router])

  const regenerate = async (voice: any) => {
    if (!window.confirm(`Gerar uma nova frase de verificação para “${voice.displayName}”? A voz ficará temporariamente indisponível enquanto a nova verificação é processada.`)) return

    const token = localStorage.getItem('composer_token')
    if (!token) return

    setWorkingId(voice.id)
    setError('')
    try {
      const response = await fetch(`/api/compositores/studio/voices/${voice.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'regenerate-validation' }),
      })
      const data = await readJson(response)
      if (!response.ok) throw new Error(data.error || 'Não foi possível gerar a nova frase.')
      router.push('/compositores/admin/minhas-vozes')
    } catch (err: any) {
      setError(err.message || 'Não foi possível gerar a nova frase.')
      setWorkingId('')
    }
  }

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Link href="/compositores/admin/minhas-vozes" className="mb-6 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300">
            <FiArrowLeft /> Voltar para minhas vozes
          </Link>

          <section className="rounded-3xl border border-purple-700/60 bg-gradient-to-br from-black via-gray-950 to-purple-950/60 p-5 sm:p-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-950/40 px-3 py-1 text-xs font-bold text-purple-100">
              <FiMic /> Regravar verificação
            </div>
            <h1 className="text-3xl font-black text-white">Cantar uma nova frase</h1>
            <p className="mt-3 text-sm leading-relaxed text-gray-300">
              Use esta opção somente quando a voz já ficou pronta, mas o resultado vocal não representou bem sua voz. O áudio-base já enviado será mantido; o sistema solicitará uma nova frase para você cantar.
            </p>
          </section>

          {error && <div className="mt-5 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</div>}

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-6 text-center text-gray-400">
                <FiLoader className="mx-auto mb-2 animate-spin" /> Carregando vozes...
              </div>
            ) : voices.length === 0 ? (
              <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-6 text-gray-300">Nenhuma voz pronta encontrada.</div>
            ) : (
              voices.map((voice) => (
                <div key={voice.id} className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
                  <p className="text-lg font-black text-white">{voice.displayName}</p>
                  <p className="mt-1 text-sm text-gray-400">Pronta para usar</p>
                  <button
                    type="button"
                    onClick={() => regenerate(voice)}
                    disabled={workingId === voice.id}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-4 py-3 font-bold text-white disabled:opacity-60"
                  >
                    {workingId === voice.id ? <FiLoader className="animate-spin" /> : <FiRefreshCw />}
                    Gerar nova frase para cantar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
