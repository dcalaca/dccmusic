'use client'

import Link from 'next/link'
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { FiArrowLeft, FiCheck, FiFilm, FiLoader, FiMusic, FiPlay, FiUpload, FiZap } from 'react-icons/fi'
import { VEO_LAB_PREVIEW_SECONDS, VEO_LAB_SCENE_COUNT, VEO_LAB_SCENE_SECONDS, type VeoLabStoryboard } from '@/lib/veo-lab'

type Project = {
  id: string
  title: string
  version?: { audioUrl?: string | null; streamAudioUrl?: string | null; duration?: number | null } | null
  cover?: { imageUrl?: string | null } | null
  lyric?: string | null
}
type Scene = { operationName?: string; videoUrl?: string; status: 'idle' | 'generating' | 'ready' | 'error'; error?: string }
type CaptionSegment = { start: number; end: number; text: string }

const emptyScenes = (): Scene[] => Array.from({ length: VEO_LAB_SCENE_COUNT }, () => ({ status: 'idle' }))

function secondsLabel(value: number) {
  const minutes = Math.floor(value / 60)
  return `${String(minutes).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`
}

export default function VideoLabClient() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const finalVideoRef = useRef<HTMLVideoElement>(null)
  const localObjectUrl = useRef<string | null>(null)
  const uploadedFile = useRef<File | null>(null)
  const [token, setToken] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [audioName, setAudioName] = useState('')
  const [duration, setDuration] = useState(30)
  const [startAt, setStartAt] = useState(0)
  const [prompt, setPrompt] = useState('')
  const [songTitle, setSongTitle] = useState('')
  const [artistName, setArtistName] = useState('')
  const [showCaptions, setShowCaptions] = useState(true)
  const [lyrics, setLyrics] = useState('')
  const [captionSegments, setCaptionSegments] = useState<CaptionSegment[]>([])
  const [previewAudioTime, setPreviewAudioTime] = useState(0)
  const [storyboard, setStoryboard] = useState<VeoLabStoryboard | null>(null)
  const [scripting, setScripting] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16')
  const [scenes, setScenes] = useState<Scene[]>(emptyScenes)
  const [error, setError] = useState('')
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [previewScene, setPreviewScene] = useState(0)
  const [previewing, setPreviewing] = useState(false)

  const authHeaders = useMemo(() => token ? { Authorization: `Bearer ${token}` } : undefined, [token])
  const allReady = scenes.every((scene) => scene.status === 'ready' && scene.videoUrl)
  const maxStart = Math.max(0, duration - VEO_LAB_PREVIEW_SECONDS)

  useEffect(() => {
    const storedToken = localStorage.getItem('composer_token') || ''
    setToken(storedToken)
    if (!storedToken) {
      setLoadingProjects(false)
      return
    }
    fetch('/api/compositores/studio/projects', { headers: { Authorization: `Bearer ${storedToken}` } })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar suas músicas.')
        setProjects((data.projects || []).filter((project: Project) => project.version?.audioUrl || project.version?.streamAudioUrl))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingProjects(false))
  }, [])

  useEffect(() => () => {
    if (localObjectUrl.current) URL.revokeObjectURL(localObjectUrl.current)
  }, [])

  useEffect(() => {
    if (!previewing || !finalVideoRef.current) return
    finalVideoRef.current.currentTime = 0
    void finalVideoRef.current.play()
  }, [previewScene, previewing])

  useEffect(() => {
    if (!previewing) return
    const timer = window.setTimeout(() => {
      if (previewScene >= VEO_LAB_SCENE_COUNT - 1) stopPreview()
      else setPreviewScene((current) => current + 1)
    }, VEO_LAB_SCENE_SECONDS * 1000)
    return () => window.clearTimeout(timer)
  }, [previewScene, previewing])

  useEffect(() => {
    if (!previewing || !audioRef.current) return
    const audio = audioRef.current
    const fade = window.setInterval(() => {
      const elapsed = Math.max(0, audio.currentTime - startAt)
      setPreviewAudioTime(audio.currentTime)
      audio.volume = elapsed >= VEO_LAB_PREVIEW_SECONDS - 3
        ? Math.max(0, (VEO_LAB_PREVIEW_SECONDS - elapsed) / 3)
        : 1
    }, 100)
    return () => window.clearInterval(fade)
  }, [previewing, startAt])

  function selectProject(id: string) {
    setSelectedProjectId(id)
    const project = projects.find((item) => item.id === id)
    const url = project?.version?.audioUrl || project?.version?.streamAudioUrl || ''
    setAudioUrl(url)
    setAudioName(project?.title || '')
    setSongTitle(project?.title || '')
    uploadedFile.current = null
    setLyrics(project?.lyric || '')
    setCaptionSegments([])
    setStoryboard(null)
    setStartAt(0)
  }

  function uploadAudio(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      setError('Escolha um arquivo de áudio válido.')
      return
    }
    if (localObjectUrl.current) URL.revokeObjectURL(localObjectUrl.current)
    localObjectUrl.current = URL.createObjectURL(file)
    uploadedFile.current = file
    setSelectedProjectId('')
    setAudioUrl(localObjectUrl.current)
    setAudioName(file.name)
    setSongTitle(file.name.replace(/\.[^.]+$/, ''))
    setLyrics('')
    setCaptionSegments([])
    setStoryboard(null)
    setStartAt(0)
    setError('')
  }

  async function createStoryboard() {
    if (!audioUrl) return setError('Escolha uma música da DCC ou envie um MP3.')
    if (!authHeaders) return setError('Entre na sua conta de compositor para usar o laboratório.')
    setError('')
    setScripting(true)
    try {
      let sourceLyrics = lyrics.trim()
      if (!sourceLyrics && uploadedFile.current) {
        const form = new FormData()
        form.append('audio', uploadedFile.current)
        const transcriptionResponse = await fetch('/api/compositores/studio/transcribe', { method: 'POST', headers: authHeaders, body: form })
        const transcription = await transcriptionResponse.json()
        if (!transcriptionResponse.ok) throw new Error(transcription.error || 'Não foi possível transcrever a música.')
        sourceLyrics = String(transcription.text || '').trim()
        setLyrics(sourceLyrics)
        setCaptionSegments(Array.isArray(transcription.segments) ? transcription.segments : [])
        setStoryboard(null)
        if (!sourceLyrics) throw new Error('Não foi possível reconhecer a letra neste áudio.')
        return
      }
      if (!sourceLyrics) throw new Error('Esta música ainda não tem letra. Envie um MP3 para transcrever ou escolha um projeto com letra.')
      const response = await fetch('/api/laboratorio-video/storyboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ lyrics: sourceLyrics, visualDirection: prompt }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível criar o roteiro.')
      setStoryboard(data.storyboard)
      setScenes(emptyScenes())
    } catch (err: any) {
      setError(err.message || 'Não foi possível criar o roteiro.')
    } finally {
      setScripting(false)
    }
  }

  async function generate() {
    if (!audioUrl) return setError('Escolha uma música da DCC ou envie um MP3.')
    if (!authHeaders) return setError('Entre na sua conta de compositor para usar o laboratório.')
    setError('')
    setGenerating(true)
    if (!storyboard) return setError('Primeiro use a IA para entender a letra e criar o roteiro.')
    setScenes(Array.from({ length: VEO_LAB_SCENE_COUNT }, () => ({ status: 'generating' })))
    try {
      const startScene = async (sceneIndex: number) => {
        const response = await fetch('/api/laboratorio-video/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ storyboard, aspectRatio, sceneIndex }),
        })
        const text = await response.text()
        let data: any = null
        try { data = JSON.parse(text) } catch { /* gateway responses can be HTML */ }
        if (!response.ok || !data?.operation) {
          throw new Error(data?.error || `Cena ${sceneIndex + 1}: o servidor respondeu ${response.status}.`)
        }
        return data.operation
      }
      const operations = await Promise.all(Array.from({ length: VEO_LAB_SCENE_COUNT }, (_, index) => startScene(index)))
      const next: Scene[] = operations.map((operation: any) => ({ operationName: operation.operationName, status: 'generating' }))
      setScenes(next)
      await Promise.all(next.map((scene, index) => pollScene(scene.operationName!, index)))
    } catch (err: any) {
      setError(err.message || 'A geração falhou.')
      setScenes((current) => current.map((scene) => scene.status === 'generating' ? { ...scene, status: 'error' } : scene))
    } finally {
      setGenerating(false)
    }
  }

  async function pollScene(operationName: string, index: number) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 1500 : 10000))
      const response = await fetch(`/api/laboratorio-video/status?operation=${encodeURIComponent(operationName)}`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok || data.error) {
        const message = data.error || `A cena ${index + 1} falhou.`
        setScenes((current) => current.map((scene, sceneIndex) => sceneIndex === index ? { ...scene, status: 'error', error: message } : scene))
        throw new Error(message)
      }
      if (data.done && data.videoUrl) {
        setScenes((current) => current.map((scene, sceneIndex) => sceneIndex === index ? { ...scene, status: 'ready', videoUrl: data.videoUrl } : scene))
        return
      }
    }
    throw new Error(`A cena ${index + 1} demorou além do esperado.`)
  }

  function startPreview() {
    if (!allReady || !audioRef.current) return
    setPreviewScene(0)
    setPreviewing(true)
    audioRef.current.currentTime = startAt
    setPreviewAudioTime(startAt)
    void audioRef.current.play()
    requestAnimationFrame(() => {
      if (finalVideoRef.current) {
        finalVideoRef.current.currentTime = 0
        void finalVideoRef.current.play()
      }
    })
    window.setTimeout(stopPreview, VEO_LAB_PREVIEW_SECONDS * 1000)
  }

  function stopPreview() {
    audioRef.current?.pause()
    if (audioRef.current) audioRef.current.volume = 1
    finalVideoRef.current?.pause()
    setPreviewing(false)
  }

  const synchronizedCaption = useMemo(() => {
    const segment = captionSegments.find((item) => previewAudioTime >= item.start && previewAudioTime <= item.end + 0.25)
    return segment?.text || storyboard?.scenes[previewScene]?.caption || ''
  }, [captionSegments, previewAudioTime, storyboard, previewScene])

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(126,34,206,0.22),transparent_32%),#050507] px-4 py-7 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/compositores/admin/studio-ia" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-white">
          <FiArrowLeft /> Voltar ao Studio IA
        </Link>

        <section className="mb-6 overflow-hidden rounded-[2rem] border border-purple-400/20 bg-black/55 p-6 shadow-2xl shadow-purple-950/30 sm:p-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-300/25 bg-purple-500/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
            <FiZap /> Experimento privado
          </div>
          <h1 className="text-3xl font-black sm:text-5xl">Laboratório de Vídeo <span className="text-purple-400">— Veo</span></h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300 sm:text-base">
            A IA entende a letra, cria uma história e transforma 30 segundos da música em cinco cenas cinematográficas conectadas.
          </p>
        </section>

        {!token && !loadingProjects && (
          <div className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-950/20 p-4 text-sm text-amber-100">
            Este laboratório é privado. <Link href="/compositores/login?redirect=/laboratorio-video" className="font-black underline">Entre como compositor</Link> para continuar.
          </div>
        )}
        {error && <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-950/25 p-4 text-sm text-red-100">{error}</div>}

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[1.75rem] border border-white/10 bg-gray-950/80 p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><FiMusic className="text-purple-400" /> 1. Escolha a música</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">Música criada na DCC</span>
                <select value={selectedProjectId} onChange={(event) => selectProject(event.target.value)} disabled={loadingProjects} className="w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none focus:border-purple-400">
                  <option value="">{loadingProjects ? 'Carregando...' : 'Escolher música'}</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                </select>
              </label>
              <label className="block cursor-pointer">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">Ou envie seu arquivo</span>
                <span className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-purple-400/40 bg-purple-950/20 px-3 py-3 text-sm font-bold text-purple-100 hover:bg-purple-950/35"><FiUpload /> Subir MP3</span>
                <input type="file" accept="audio/*,.mp3" onChange={uploadAudio} className="sr-only" />
              </label>
            </div>
            {audioUrl && <div className="mt-4 rounded-2xl border border-white/10 bg-black/60 p-4">
              <p className="mb-3 truncate text-sm font-bold text-purple-100">{audioName}</p>
              <audio ref={audioRef} src={audioUrl} controls className="w-full" onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 30)} />
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-gray-400"><span>{secondsLabel(startAt)}</span><span>Trecho selecionado: 30 segundos</span><span>{secondsLabel(Math.min(duration, startAt + 30))}</span></div>
              <input aria-label="Início do trecho" type="range" min={0} max={maxStart} step={1} value={Math.min(startAt, maxStart)} onChange={(event) => setStartAt(Number(event.target.value))} className="mt-2 w-full accent-purple-500" />
            </div>}

            <h2 className="mb-3 mt-6 flex items-center gap-2 text-xl font-black"><FiFilm className="text-purple-400" /> 2. Identidade do lançamento</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">Nome da música</span><input value={songTitle} onChange={(event) => setSongTitle(event.target.value)} placeholder="Nome que ficará no clipe" maxLength={100} className="w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none focus:border-purple-400" /></label>
              <label><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">Artista (opcional)</span><input value={artistName} onChange={(event) => setArtistName(event.target.value)} placeholder="Aparece no começo" maxLength={100} className="w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none focus:border-purple-400" /></label>
            </div>
            <label className="mt-3 block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">Referência visual (opcional)</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} maxLength={1800} placeholder="Deixe vazio para a IA decidir de acordo com a letra" className="w-full resize-none rounded-2xl border border-white/10 bg-black/70 p-4 text-sm leading-relaxed text-white outline-none placeholder:text-gray-600 focus:border-purple-400" /></label>
            <button type="button" onClick={() => setShowCaptions((current) => !current)} className={`mt-3 w-full rounded-xl border px-4 py-3 text-left text-sm font-bold ${showCaptions ? 'border-purple-400 bg-purple-500/20' : 'border-white/10 bg-black/50 text-gray-400'}`}>
              {showCaptions ? '●' : '○'} Legenda da letra no preview
            </button>

            <button disabled={scripting || generating || !token || !audioUrl} onClick={createStoryboard} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-fuchsia-400/40 bg-fuchsia-950/30 px-5 py-4 font-black text-fuchsia-100 transition hover:bg-fuchsia-950/50 disabled:cursor-not-allowed disabled:opacity-50">
              {scripting
                ? <><FiLoader className="animate-spin" /> {lyrics ? 'Criando o roteiro...' : 'Reconhecendo a letra...'}</>
                : <><FiFilm /> {lyrics ? 'Criar roteiro com esta letra' : 'Entender e mostrar a letra'}</>}
            </button>
            {error && <div className="mt-3 rounded-xl border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm leading-relaxed text-red-100">{error}</div>}
            {uploadedFile.current && !lyrics && <p className="mt-2 text-center text-[11px] text-amber-200/70">Ao criar o roteiro, o MP3 será transcrito usando 1 crédito do Studio.</p>}
            {lyrics && <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-950/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">Letra reconhecida</p>
                <span className="text-[10px] font-bold text-gray-500">Confira antes do roteiro</span>
              </div>
              <textarea value={lyrics} onChange={(event) => { setLyrics(event.target.value); setStoryboard(null) }} rows={10} className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-black/65 p-3 text-xs leading-relaxed text-gray-200 outline-none focus:border-emerald-400" />
              <p className="mt-2 text-[11px] leading-relaxed text-gray-500">Você pode corrigir qualquer palavra. O roteiro será criado exatamente com o texto acima.</p>
            </div>}

            {storyboard && <div className="mt-5 rounded-2xl border border-purple-400/25 bg-purple-950/15 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-300">Roteiro criado</p>
              <h3 className="mt-2 text-lg font-black">{storyboard.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-300">{storyboard.logline}</p>
              <div className="mt-4 space-y-2">{storyboard.scenes.map((scene, index) => <div key={index} className="rounded-xl border border-white/10 bg-black/45 p-3">
                <p className="text-xs font-black text-purple-200">{index + 1}. {scene.title} <span className="font-normal text-gray-500">· 6 s</span></p>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">{scene.story}</p>
              </div>)}</div>
              <p className="mt-3 text-[11px] leading-relaxed text-gray-500">Identidade fixa: {storyboard.characterBible}</p>
            </div>}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(['9:16', '16:9'] as const).map((ratio) => <button key={ratio} onClick={() => setAspectRatio(ratio)} className={`rounded-xl border px-4 py-3 text-left text-sm font-bold ${aspectRatio === ratio ? 'border-purple-400 bg-purple-500/20 text-white' : 'border-white/10 bg-black/50 text-gray-400'}`}>
                {ratio === '9:16' ? 'Reels / TikTok' : 'YouTube'} <span className="ml-1 text-xs opacity-60">{ratio}</span>
              </button>)}
            </div>
            <div className="mt-3 rounded-xl bg-white/[0.04] px-4 py-3 text-xs text-gray-400">Qualidade do teste: <strong className="text-gray-200">720p</strong> · 5 gerações de 8 s · preview usa 6 s de cada</div>
            <button disabled={generating || !token || !storyboard} onClick={generate} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-5 py-4 font-black shadow-lg shadow-purple-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
              {generating ? <><FiLoader className="animate-spin" /> Gerando cinco cenas...</> : <><FiZap /> Gerar as 5 cenas do preview</>}
            </button>
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-gray-950/80 p-5 sm:p-6">
            <h2 className="mb-4 text-xl font-black">3. Cenas do preview</h2>
            <div className="grid grid-cols-2 gap-3">
              {scenes.map((scene, index) => <div key={index} className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black ${aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'}`}>
                {scene.videoUrl ? <video src={scene.videoUrl} controls muted playsInline className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-gray-500">
                  {scene.status === 'generating' ? <FiLoader className="h-6 w-6 animate-spin text-purple-400" /> : scene.status === 'error' ? <span className="text-red-300">{scene.error || 'Falhou'}</span> : <FiFilm className="h-6 w-6" />}
                  <span>Cena {index + 1}</span>
                </div>}
                {scene.status === 'ready' && <span className="absolute right-2 top-2 rounded-full bg-emerald-500 p-1 text-white"><FiCheck /></span>}
              </div>)}
            </div>

            <div className="mt-5 rounded-2xl border border-purple-400/20 bg-black/70 p-4">
              <div className={`mx-auto overflow-hidden rounded-xl bg-black ${aspectRatio === '9:16' ? 'aspect-[9/16] max-h-[440px]' : 'aspect-video'}`}>
                {allReady ? <div className="relative h-full w-full">
                  <video key={previewScene} ref={finalVideoRef} src={scenes[previewScene].videoUrl} muted playsInline className="h-full w-full object-cover" />
                  {songTitle && <div className="absolute left-3 top-3 max-w-[75%] rounded-lg bg-black/55 px-3 py-2 text-sm font-black tracking-wide text-white shadow-lg backdrop-blur-sm">{songTitle}</div>}
                  {artistName && previewScene === 0 && <div className="absolute right-3 top-3 rounded-lg bg-black/55 px-3 py-2 text-xs font-bold text-white/90 backdrop-blur-sm">{artistName}</div>}
                  {showCaptions && synchronizedCaption && <div className="absolute inset-x-3 bottom-5 text-center"><span className="inline rounded-lg bg-black/70 px-3 py-2 text-sm font-bold leading-relaxed text-white shadow-lg [box-decoration-break:clone]">{synchronizedCaption}</span></div>}
                </div> : <div className="flex h-full items-center justify-center px-5 text-center text-sm text-gray-600">O preview sincronizado aparecerá aqui quando as cinco cenas estiverem prontas.</div>}
              </div>
              <button disabled={!allReady} onClick={previewing ? stopPreview : startPreview} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-purple-400/40 bg-purple-950/30 px-4 py-3 text-sm font-black text-purple-100 disabled:opacity-40">
                <FiPlay /> {previewing ? 'Parar preview' : 'Assistir com a música'}
              </button>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-gray-500">Nesta primeira versão, o laboratório sincroniza as cenas e a música no player. A exportação do MP4 final entra na próxima etapa do teste.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
