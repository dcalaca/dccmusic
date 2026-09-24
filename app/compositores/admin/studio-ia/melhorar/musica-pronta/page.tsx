'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocalization } from '@/components/LocalizationProvider'
import { useTranslation } from 'react-i18next'
import { FiArrowLeft, FiEdit3, FiGlobe, FiLoader, FiMusic, FiUploadCloud, FiZap } from 'react-icons/fi'

const improvementOptions = ['similar', 'professional', 'vocal', 'instruments', 'language_adaptation'] as const
const voiceOptions = ['same', 'male', 'female'] as const
const voiceStyleOptions = ['natural', 'soft', 'powerful', 'deep', 'bright'] as const

const moodOptions = ['Romântica', 'Sofrência', 'Chiclete', 'Engraçada', 'Reflexiva', 'Balada', 'Triste', 'Motivacional']
const voiceToneOptions = ['Deixar a IA escolher', 'Voz grave', 'Voz média', 'Voz aguda', 'Voz rouca', 'Voz suave', 'Voz forte']
const structureOptions = ['Padrão', 'A/B/Refrão/C/Refrão', 'A/Refrão/A/Refrão']
const genreOptions = ['Sertanejo', 'Sertanejo raiz', 'Moda de viola', 'Pagode', 'Samba', 'Valsa', 'Arrocha', 'Gospel', 'Reggae', 'Pop', 'Rock', 'Funk', 'Trap', 'Forró', 'Guarania paraguaia', 'Livre', 'Outro / escrever meu estilo']
const songLanguageOptions = [
  'Português (Brasil)',
  'Português (Portugal)',
  'English (United States)',
  'English (United Kingdom)',
  'Español (Paraguay)',
  'Español (Colombia)',
  'Español (México)',
  'Español (España)',
]

const optionLabelKeys: Record<string, string> = {
  'Romântica': 'romantic', 'Sofrência': 'heartbreak', 'Chiclete': 'catchy',
  'Engraçada': 'funny', 'Reflexiva': 'reflective', 'Balada': 'ballad',
  'Triste': 'sad', 'Motivacional': 'motivational',
  'Deixar a IA escolher': 'aiChoose', 'Voz grave': 'lowVoice',
  'Voz média': 'midVoice', 'Voz aguda': 'highVoice',
  'Voz rouca': 'raspyVoice', 'Voz suave': 'softVoice', 'Voz forte': 'powerfulVoice',
  'Padrão': 'standard', 'A/B/Refrão/C/Refrão': 'structureABC',
  'A/Refrão/A/Refrão': 'structureABA',
  'curta': 'short', 'média': 'medium', 'longa': 'long',
}
const songLanguageKeys: Record<string, string> = {
  'English (United States)': 'enUS', 'English (United Kingdom)': 'enGB',
  'Português (Brasil)': 'ptBR', 'Português (Portugal)': 'ptPT',
  'Español (Paraguay)': 'esPY', 'Español (Colombia)': 'esCO',
  'Español (México)': 'esMX', 'Español (España)': 'esES',
}
const genreLabelKeys: Record<string, string> = {
  'Sertanejo': 'sertanejo', 'Sertanejo raiz': 'traditionalSertanejo',
  'Moda de viola': 'modaDeViola', 'Pagode': 'pagode', 'Samba': 'samba',
  'Valsa': 'waltz', 'Arrocha': 'arrocha', 'Gospel': 'gospel',
  'Reggae': 'reggae', 'Pop': 'pop', 'Rock': 'rock', 'Funk': 'funk',
  'Trap': 'trap', 'Forró': 'forro', 'Guarania paraguaia': 'guarania',
  'Livre': 'free', 'Outro / escrever meu estilo': 'other',
}

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

async function uploadAudioDirectToStorage(token: string, file: File, kind: 'enhance-source' | 'transcribe', errors: { prepare: string; upload: string }) {
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
    throw new Error(errors.prepare)
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
    throw new Error(errors.upload)
  }

  return {
    audioPath: upload.path as string,
    audioProvider: upload.provider as string,
    audioContentType: upload.contentType as string,
    audioSizeBytes: Number(upload.sizeBytes) || file.size,
  }
}

export default function ImproveReadyMusicPage() {
  const { t } = useTranslation()
  const choiceLabel = (value: string) => t(`studio.create.optionLabels.${optionLabelKeys[value]}`)
  const languageLabel = (value: string) => t(`studio.create.languageLabels.${songLanguageKeys[value]}`)
  const genreLabel = (value: string) => t(`studio.tools.ready.genreLabels.${genreLabelKeys[value]}`)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { country } = useLocalization()
  const [submitting, setSubmitting] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selectedImprovement, setSelectedImprovement] = useState('similar')
  const [selectedVoice, setSelectedVoice] = useState('same')
  const [selectedVoiceStyle, setSelectedVoiceStyle] = useState('natural')
  const [mood, setMood] = useState('Sofrência')
  const [voiceTone, setVoiceTone] = useState('Deixar a IA escolher')
  const [structure, setStructure] = useState('Padrão')
  const [lineCount, setLineCount] = useState('média')
  const [selectedGenre, setSelectedGenre] = useState('')
  const [songLanguage, setSongLanguage] = useState(() => {
    if (String(country) === 'GB') return 'English (United Kingdom)'
    if (String(country) === 'US') return 'English (United States)'
    if (String(country) === 'PT') return 'Português (Portugal)'
    if (String(country) === 'PY') return 'Español (Paraguay)'
    if (String(country) === 'CO') return 'Español (Colombia)'
    if (String(country) === 'MX') return 'Español (México)'
    if (String(country) === 'ES') return 'Español (España)'
    return 'Português (Brasil)'
  })
  const [customGenre, setCustomGenre] = useState('')
  const [wantInstruments, setWantInstruments] = useState('')
  const [avoidInstruments, setAvoidInstruments] = useState('')
  const [additionalInstructions, setAdditionalInstructions] = useState('')
  const [lyric, setLyric] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [savedOriginal, setSavedOriginal] = useState<any>(null)
  const sourceProjectId = searchParams.get('sourceProjectId') || ''

  useEffect(() => {
    if (!sourceProjectId) return
    const token = localStorage.getItem('composer_token')
    if (!token) return
    fetch('/api/compositores/studio/projects?filter=originais', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((response) => response.json())
      .then((data) => {
        const project = (data.projects || []).find((item: any) => item.id === sourceProjectId)
        if (project?.originalAudio) {
          setSavedOriginal({ ...project.originalAudio, title: project.title })
          const titleInput = document.querySelector<HTMLInputElement>('input[name="title"]')
          if (titleInput && !titleInput.value) titleInput.value = project.title || ''
        }
      })
      .catch(() => undefined)
  }, [sourceProjectId])

  const isLanguageAdaptation = selectedImprovement === 'language_adaptation'

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
    if (!audioFile && !savedOriginal) {
      setError(t('studio.tools.ready.errors.chooseAudioTranscribe'))
      return
    }

    setTranscribing(true)
    setError('')
    setMessage(t('studio.tools.ready.messages.transcribing'))
    try {
      const uploaded = audioFile ? await uploadAudioDirectToStorage(token, audioFile, 'transcribe', { prepare: t('studio.tools.ready.errors.prepareUpload'), upload: t('studio.tools.ready.errors.upload') }) : savedOriginal
      const response = await fetch('/api/compositores/studio/transcribe', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploaded),
      })
      const data = await readApiResponse(response)
      if (!response.ok) throw new Error(t('studio.tools.ready.errors.transcribe'))
      setLyric(data.text || '')
      window.dispatchEvent(new Event('studioBalanceChange'))
      const charged = Number(data.creditsCharged) || 1
      setMessage(
        t('studio.tools.ready.messages.transcribed', { count: charged })
      )
    } catch (err: any) {
      setError(err.message || t('studio.tools.ready.errors.transcribe'))
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
    const style = (selectedGenre === 'Outro / escrever meu estilo' ? customGenre : selectedGenre).trim()

    if ((!audioFile || audioFile.size <= 0) && !savedOriginal) {
      setError(t('studio.tools.ready.errors.chooseAudio'))
      return
    }
    if (isLanguageAdaptation && !lyric.trim()) {
      setError(t('studio.tools.ready.errors.translationRequired'))
      return
    }
    const duration = audioFile ? await getAudioDurationSeconds(audioFile) : null
    if (duration && duration > MAX_AUDIO_DURATION_SECONDS) {
      setError(t('studio.tools.ready.errors.maxDuration'))
      return
    }

    setSubmitting(true)
    setError('')
    setMessage(lyric.trim()
      ? t('studio.tools.ready.messages.sending')
      : t('studio.tools.ready.messages.starting'))
    try {
      const uploaded = audioFile ? await uploadAudioDirectToStorage(token, audioFile, 'enhance-source', { prepare: t('studio.tools.ready.errors.prepareUpload'), upload: t('studio.tools.ready.errors.upload') }) : savedOriginal
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
          songLanguage,
          voice: selectedVoice,
          voiceStyle: selectedVoiceStyle,
          voiceTone,
          mood,
          structure,
          lineCount,
          wantInstruments: wantInstruments.trim(),
          avoidInstruments: avoidInstruments.trim(),
          additionalInstructions: additionalInstructions.trim(),
          lyric: lyric.trim(),
          ...uploaded,
        }),
      })
      const data = await readApiResponse(response)
      if (!response.ok) throw new Error(t('studio.tools.ready.errors.improve'))

      window.dispatchEvent(new Event('studioBalanceChange'))
      setMessage(
        data.lyricTranscribed
          ? t('studio.tools.ready.messages.transcribedStarted')
          : t('studio.tools.ready.messages.started')
      )
      window.setTimeout(() => {
        router.push(`/compositores/admin/studio-ia/projetos/${data.projectId}`)
      }, 900)
    } catch (err: any) {
      setError(err.message || t('studio.tools.ready.errors.improve'))
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
            <FiArrowLeft /> {t('studio.tools.ready.back')}
          </Link>

          <section className="mb-6 rounded-3xl border border-purple-700/60 bg-gradient-to-br from-black via-gray-950 to-purple-950/60 p-5 sm:p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-950/40 px-3 py-1 text-xs font-bold text-purple-100">
              <FiZap /> {t('studio.tools.ready.badge')}
            </div>
            <h1 className="text-3xl font-black sm:text-5xl">
              <span className="gradient-text">{t('studio.tools.ready.title')}</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
              {t('studio.tools.ready.subtitle')}
            </p>
            <p className="mt-3 rounded-2xl border border-emerald-700/60 bg-emerald-950/20 p-3 text-sm text-emerald-100">
              {t('studio.tools.ready.transcriptionHint')}
              {t('studio.tools.ready.reviewHint')}
            </p>
            <p className="mt-3 rounded-2xl border border-yellow-700/60 bg-yellow-950/20 p-3 text-sm text-yellow-100">
              {t('studio.tools.ready.costHint')}
            </p>
          </section>

          {message && <div className="mb-5 rounded-xl border border-green-800 bg-green-950/50 p-4 text-green-200">{message}</div>}
          {error && <div className="mb-5 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</div>}

          <form onSubmit={submit} className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5 sm:p-6">
            <div className="grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">{t('studio.tools.ready.songTitle')}</span>
                <input name="title" required maxLength={30} placeholder={t('studio.tools.ready.songTitlePlaceholder')} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">{t('studio.tools.ready.language')}</span>
                <select value={songLanguage} onChange={(event) => setSongLanguage(event.target.value)} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500">
                  {songLanguageOptions.map((option) => <option key={option} value={option}>{languageLabel(option)}</option>)}
                </select>
                <span className="mt-2 block text-xs text-gray-500">{t('studio.tools.ready.languageHint')}</span>
              </label>
            </div>

            <label className="mt-4 block rounded-2xl border border-purple-800/70 bg-purple-950/20 p-4">
              <span className="mb-2 flex items-center gap-2 text-sm font-bold text-purple-100"><FiUploadCloud /> {t('studio.tools.ready.audio')}</span>
              {savedOriginal && (
                <div className="mb-3 rounded-xl border border-emerald-700/60 bg-emerald-950/30 p-3 text-sm text-emerald-100">
                  {t('studio.tools.ready.savedOriginal', { title: savedOriginal.title })}
                  {savedOriginal.audioUrl && <audio controls src={savedOriginal.audioUrl} className="mt-2 w-full" />}
                </div>
              )}
              <input
                name="audio"
                type="file"
                required={!savedOriginal}
                accept="audio/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  setAudioFile(file)
                  if (file) setSavedOriginal(null)
                }}
                className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:font-bold file:text-white"
              />
              <span className="mt-2 block text-xs text-purple-100/80">
                {t('studio.tools.ready.audioHint')}
              </span>
            </label>

            <div className="mt-5">
              <p className="mb-3 text-sm font-bold text-gray-300">{t('studio.tools.ready.whatImprove')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {improvementOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setSelectedImprovement(option)
                      setError('')
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${selectedImprovement === option ? 'border-primary-400 bg-primary-950/40 text-white' : 'border-gray-800 bg-black/30 text-gray-300 hover:border-purple-500'}`}
                  >
                    <span className="flex items-center gap-2 font-black">
                      {option === 'language_adaptation' && <FiGlobe className="text-primary-300" />}
                      {t(`studio.tools.ready.improvementOptions.${option}.label`)}
                    </span>
                    <span className="mt-1 block text-xs text-gray-400">{t(`studio.tools.ready.improvementOptions.${option}.description`)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-purple-800/50 bg-purple-950/15 p-4">
              <div className="mb-3">
                <p className="text-sm font-black text-white">{t('studio.tools.ready.genre')}</p>
                <p className="mt-1 text-xs text-gray-400">{t('studio.tools.ready.genreHint')}</p>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">{t('studio.tools.ready.genre')}</span>
                <select value={selectedGenre} onChange={(event) => setSelectedGenre(event.target.value)} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500">
                  <option value="">{t('studio.tools.ready.keepGenre')}</option>
                  {genreOptions.map((option) => <option key={option} value={option}>{genreLabel(option)}</option>)}
                </select>
                <span className="mt-2 block text-xs text-gray-500">{t('studio.tools.ready.genreHint')}</span>
                {selectedGenre === 'Outro / escrever meu estilo' && (
                  <input value={customGenre} onChange={(event) => setCustomGenre(event.target.value)} placeholder={t('studio.tools.ready.genrePlaceholder')} className="mt-2 w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
                )}
              </label>
            </div>

            <details data-feature="enhance-compact-layout" className="group mt-5 rounded-2xl border border-gray-800 bg-black/20">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm font-black text-white [&::-webkit-details-marker]:hidden">
                <span>{t('studio.tools.ready.moreOptions')}</span>
                <span className="text-xs font-semibold text-primary-300 group-open:hidden">{t('studio.tools.ready.show')}</span>
                <span className="hidden text-xs font-semibold text-primary-300 group-open:inline">{t('studio.tools.ready.hide')}</span>
              </summary>
              <div className="border-t border-gray-800 px-4 pb-4">
            <div className="mt-5 rounded-2xl border border-gray-800 bg-black/20 p-4">
              <p className="mb-2 text-sm font-bold text-gray-200">{t('studio.tools.ready.extraInstructions')}</p>
              <p className="mb-3 text-xs leading-relaxed text-gray-400">
                {t('studio.tools.ready.extraHint')}
              </p>
              <textarea
                name="additionalInstructions"
                value={additionalInstructions}
                onChange={(event) => setAdditionalInstructions(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder={t('studio.tools.ready.extraPlaceholder')}
                className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500"
              />
              <div className="mt-2 flex justify-end text-xs text-gray-500">{additionalInstructions.length}/500</div>
            </div>

            <div className="mt-5 rounded-2xl border border-gray-800 bg-black/20 p-4">
              <p className="mb-3 text-sm font-bold text-gray-200">{t('studio.tools.ready.details')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-gray-300">{t('studio.tools.ready.mood')}</span>
                  <select value={mood} onChange={(event) => setMood(event.target.value)} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500">
                    {moodOptions.map((option) => <option key={option} value={option}>{choiceLabel(option)}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-gray-300">{t('studio.tools.ready.voiceTone')}</span>
                  <select value={voiceTone} onChange={(event) => setVoiceTone(event.target.value)} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500">
                    {voiceToneOptions.map((option) => <option key={option} value={option}>{choiceLabel(option)}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-gray-300">{t('studio.tools.ready.structure')}</span>
                  <select value={structure} onChange={(event) => setStructure(event.target.value)} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500">
                    {structureOptions.map((option) => <option key={option} value={option}>{choiceLabel(option)}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-gray-300">{t('studio.tools.ready.lyricLength')}</span>
                  <select value={lineCount} onChange={(event) => setLineCount(event.target.value)} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500">
                    {['curta', 'média', 'longa'].map((option) => <option key={option} value={option}>{choiceLabel(option)}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-gray-300">{t('studio.tools.ready.instruments')}</span>
                  <input value={wantInstruments} onChange={(event) => setWantInstruments(event.target.value)} placeholder={t('studio.tools.ready.instrumentsPlaceholder')} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-gray-300">{t('studio.tools.ready.avoidInstruments')}</span>
                  <input value={avoidInstruments} onChange={(event) => setAvoidInstruments(event.target.value)} placeholder={t('studio.tools.ready.avoidInstrumentsPlaceholder')} className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500" />
                </label>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-gray-800 bg-black/20 p-4">
              <p className="mb-1 text-sm font-bold text-gray-200">{t('studio.tools.ready.mainVoice')}</p>
              <p className="mb-3 text-xs text-gray-400">{t('studio.tools.ready.voiceChoiceHint')}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {voiceOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSelectedVoice(option)}
                    className={`rounded-2xl border p-3 text-left transition ${selectedVoice === option ? 'border-primary-400 bg-primary-950/40 text-white' : 'border-gray-800 bg-black/30 text-gray-300 hover:border-purple-500'}`}
                  >
                    <span className="block font-black">{t(`studio.tools.ready.voiceOptions.${option}.label`)}</span>
                    <span className="mt-1 block text-xs text-gray-400">{t(`studio.tools.ready.voiceOptions.${option}.description`)}</span>
                  </button>
                ))}
              </div>

              <p className="mb-3 mt-5 text-sm font-bold text-gray-300">{t('studio.tools.ready.voiceStyle')}</p>
              <div className="flex flex-wrap gap-2">
                {voiceStyleOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSelectedVoiceStyle(option)}
                    className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${selectedVoiceStyle === option ? 'border-primary-400 bg-primary-950/40 text-white' : 'border-gray-800 bg-black/30 text-gray-300 hover:border-purple-500'}`}
                  >
                    {t(`studio.tools.ready.voiceStyleOptions.${option}`)}
                  </button>
                ))}
              </div>
              {selectedVoice !== 'same' && (
                <p className="mt-3 text-xs text-amber-200">
                  {t('studio.tools.ready.voiceChangeHint')}
                </p>
              )}
            </div>

              </div>
            </details>

            <div className="mt-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-gray-300">{t('studio.tools.ready.lyrics')} {isLanguageAdaptation && <span className="text-amber-300">*</span>}</span>
                {!isLanguageAdaptation && (
                  <button
                    type="button"
                    onClick={transcribeAudio}
                    disabled={transcribing || submitting || (!audioFile && !savedOriginal)}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-600/50 bg-emerald-950/40 px-3 py-2 text-xs font-bold text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {transcribing ? <FiLoader className="animate-spin" /> : <FiEdit3 />}
                    {transcribing ? t('studio.tools.ready.transcribing') : t('studio.tools.ready.transcribe')}
                  </button>
                )}
              </div>

              {isLanguageAdaptation && (
                <div className="mb-3 rounded-2xl border border-sky-700/50 bg-sky-950/25 p-3 text-sm leading-relaxed text-sky-100">
                  {t('studio.tools.ready.languageAdaptationHelp')}
                </div>
              )}

              <textarea
                name="lyric"
                value={lyric}
                onChange={(event) => setLyric(event.target.value)}
                rows={5}
                required={isLanguageAdaptation}
                placeholder={isLanguageAdaptation
                  ? t('studio.tools.ready.translatedLyricsPlaceholder')
                  : t('studio.tools.ready.lyricsPlaceholder')}
                className="w-full rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary-500"
              />
            </div>

            <button type="submit" disabled={submitting || transcribing} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-4 font-black text-white transition hover:scale-[1.01] disabled:opacity-60">
              {submitting ? <FiLoader className="animate-spin" /> : <FiMusic />}
              {submitting ? t('studio.tools.ready.messages.sending') : isLanguageAdaptation ? t('studio.tools.ready.adapt') : t('studio.tools.ready.improve')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
