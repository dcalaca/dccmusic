'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiCreditCard,
  FiFileText,
  FiHeart,
  FiLoader,
  FiMic,
  FiMusic,
  FiPenTool,
  FiPlay,
  FiSliders,
  FiX,
  FiZap,
} from 'react-icons/fi'

const rootStudioStyles = ['Moda de Viola', 'Sertanejo Raiz']
const studioExtraStyles = ['Trap']
const fallbackStyles = ['Sertanejo', ...rootStudioStyles, ...studioExtraStyles, 'Pagode', 'Arrocha', 'Pop', 'Livre']
const customStyleOption = 'Outro / escrever meu estilo'
const titleMaxLength = 30
const ideaMaxLength = 1000
const moods = ['Romântica', 'Sofrência', 'Chiclete', 'Engraçada', 'Reflexiva', 'Balada', 'Triste', 'Motivacional']
const structures = ['Padrão', 'A/B/Refrão/C/Refrão', 'A/Refrão/A/Refrão']
const lineCounts = ['curta', 'média', 'longa']
const voiceGenders = ['Deixar a IA escolher', 'Voz masculina', 'Voz feminina', 'Dueto masculino e feminino']
const voiceTones = ['Deixar a IA escolher', 'Voz grave', 'Voz média', 'Voz aguda', 'Voz rouca', 'Voz suave', 'Voz forte']
const studioMusicCredits = 10
const themeSuggestions = [
  { id: 'amor', label: 'Amor', text: 'Uma história de amor verdadeira, com carinho, desejo e a vontade de ficar juntos.' },
  { id: 'termino', label: 'Término', text: 'O fim de um relacionamento, a dor da despedida e a dificuldade de seguir em frente.' },
  { id: 'sofrencia', label: 'Sofrência', text: 'Alguém que ainda ama, sofre em silêncio e não consegue esquecer a pessoa amada.' },
  { id: 'saudade', label: 'Saudade', text: 'A saudade de alguém especial, das memórias e dos momentos que não voltam mais.' },
  { id: 'perdao', label: 'Perdão', text: 'Um pedido de perdão sincero, com arrependimento e vontade de recomeçar.' },
  { id: 'fe', label: 'Fé', text: 'Uma mensagem de fé, esperança e força para atravessar os momentos difíceis.' },
  { id: 'festa', label: 'Festa', text: 'Uma noite de festa, alegria, amizade e vontade de curtir sem pensar no amanhã.' },
  { id: 'superacao', label: 'Superação', text: 'Uma pessoa que caiu, se levantou e descobriu a própria força no caminho.' },
]

function canCreateFromStudioStatus(status: any) {
  return Boolean(status?.canCreateMusic) ||
    Number(status?.credits?.remaining || 0) >= studioMusicCredits ||
    Number(status?.stats?.freeMusicRemaining || 0) > 0
}

async function getComposerBalanceStatus(token: string) {
  const response = await fetch('/api/compositores/me', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!response.ok) return null

  const data = await response.json()
  const statementBalance = Number(data?.statement?.summary?.currentCreditBalance)
  const currentCreditBalance = Number.isFinite(statementBalance)
    ? Math.max(0, statementBalance)
    : Math.max(0, Number(data?.studio?.creditsRemaining) || 0)
  const freeMusicRemaining = Number(data?.studio?.freeMusicRemaining) || 0

  return {
    canCreateMusic: currentCreditBalance >= studioMusicCredits || freeMusicRemaining > 0,
    currentCreditBalance,
    freeMusicRemaining,
  }
}

export default function NewStudioMusicPage() {
  const router = useRouter()
  const errorRef = useRef<HTMLDivElement>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [styles, setStyles] = useState(fallbackStyles)
  const [loadingStyles, setLoadingStyles] = useState(true)
  const [hasOwnLyric, setHasOwnLyric] = useState(false)
  const [existingLyric, setExistingLyric] = useState('')
  const [voices, setVoices] = useState<any[]>([])
  const [showLyricOptions, setShowLyricOptions] = useState(false)
  const [blockedCreation, setBlockedCreation] = useState(false)
  const [studioStatus, setStudioStatus] = useState<any>(null)
  const [upgradeModalMessage, setUpgradeModalMessage] = useState('')
  const [selectedTheme, setSelectedTheme] = useState('')
  const [form, setForm] = useState({
    title: '',
    style: 'Sertanejo',
    customStyle: '',
    mood: 'Sofrência',
    structure: 'Padrão',
    lineCount: 'média',
    wantInstruments: '',
    avoidInstruments: '',
    idea: '',
    avoidCliches: true,
    avoidChildishRhymes: true,
    avoidRepeatedWords: true,
    stickyChorus: true,
    popularLanguage: true,
    sophisticatedLanguage: false,
    voiceGender: 'Deixar a IA escolher',
    voiceTone: 'Deixar a IA escolher',
    voiceProfileId: '',
    extraInstructions: '',
  })

  useEffect(() => {
    const token = localStorage.getItem('composer_token')
    const composerData = localStorage.getItem('composer_data')

    if (!token || !composerData) {
      router.push('/compositores/login?redirect=/compositores/admin/studio-ia/novo')
      return
    }

    const checkStatus = async () => {
      try {
        const response = await fetch('/api/compositores/studio/status', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })

        if (response.status === 401) {
          localStorage.removeItem('composer_token')
          router.push('/compositores/login?redirect=/compositores/admin/studio-ia/novo')
          return
        }

        const statusData = await response.json()
        setStudioStatus(statusData)
        setBlockedCreation(false)
      } catch (err) {
        console.error('Erro ao verificar saldo Studio IA:', err)
      } finally {
        setCheckingAuth(false)
      }
    }

    checkStatus()
  }, [router])

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await fetch('/api/generos/list', { cache: 'no-store' })
        if (!response.ok) throw new Error('Erro ao buscar gêneros')

        const data = await response.json()
        const genreNames = (data || [])
          .map((genre: any) => String(genre.name || '').trim())
          .filter(Boolean)

        if (genreNames.length > 0) {
          const styleOptions = [
            ...genreNames.filter((name: string) => name !== customStyleOption),
            ...rootStudioStyles.filter((name) => !genreNames.some((genre: string) => genre.toLowerCase() === name.toLowerCase())),
            ...studioExtraStyles.filter((name) => !genreNames.some((genre: string) => genre.toLowerCase() === name.toLowerCase())),
            customStyleOption,
          ]
          setStyles(styleOptions)
          setForm((currentForm) => (
            styleOptions.includes(currentForm.style)
              ? currentForm
              : { ...currentForm, style: styleOptions[0] }
          ))
        }
      } catch (err) {
        console.error('Erro ao carregar gêneros do Studio IA:', err)
      } finally {
        setLoadingStyles(false)
      }
    }

    fetchGenres()
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('composer_token')
    if (!token) return

    const fetchVoices = async () => {
      try {
        const response = await fetch('/api/compositores/studio/voices', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const data = await response.json()
        if (response.ok) {
          setVoices((data.voices || []).filter((voice: any) => voice.status === 'ready' && voice.voiceId))
        }
      } catch {
        setVoices([])
      }
    }

    fetchVoices()
  }, [])

  const showUpgradeModal = (message: string) => {
    setError('')
    setBlockedCreation(false)
    setUpgradeModalMessage(message)
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 50)
  }

  const showError = (message: string) => {
    setError(message)
    window.setTimeout(() => {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  const applyThemeSuggestion = (themeId: string) => {
    const theme = themeSuggestions.find((item) => item.id === themeId)
    if (!theme) return
    setSelectedTheme(themeId)
    setHasOwnLyric(false)
    setForm((current) => ({
      ...current,
      idea: theme.text.slice(0, ideaMaxLength),
      mood: themeId === 'festa' ? 'Chiclete' : themeId === 'fe' || themeId === 'superacao' ? 'Motivacional' : current.mood,
    }))
    setError('')
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.title.trim()) {
      showError('Informe o nome da música.')
      return
    }
    if (form.style === customStyleOption && form.customStyle.trim().length < 3) {
      showError('Escreva o estilo musical que você quer.')
      return
    }
    if (hasOwnLyric && existingLyric.trim().length < 40) {
      showError('Cole a letra completa antes de continuar.')
      return
    }
    if (!hasOwnLyric && !form.idea.trim()) {
      showError('Descreva sobre o que será a música.')
      return
    }

    setLoading(true)
    try {
      const effectiveStyle = form.style === customStyleOption ? form.customStyle.trim() : form.style
      const token = localStorage.getItem('composer_token')
      if (!token) {
        router.push('/compositores/login?redirect=/compositores/admin/studio-ia/novo')
        return
      }

      const statusResponse = await fetch('/api/compositores/studio/status', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const statusData = await statusResponse.json()
      const canCreateMusic = canCreateFromStudioStatus(statusData)
      if (statusResponse.ok && !canCreateMusic) {
        const fallbackStatus = await getComposerBalanceStatus(token)
        if (fallbackStatus?.canCreateMusic) {
          window.dispatchEvent(new Event('studioBalanceChange'))
        } else {
          showUpgradeModal('Você já usou sua música grátis e está sem saldo. Para continuar criando, escolha um plano ou compre uma recarga avulsa.')
          return
        }
      }

      const projectResponse = await fetch('/api/compositores/studio/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          style: effectiveStyle,
          idea: hasOwnLyric ? form.idea || 'Letra informada pelo compositor.' : form.idea,
          lyric: hasOwnLyric ? existingLyric : undefined,
        }),
      })
      const projectData = await projectResponse.json()
      if (!projectResponse.ok) throw new Error(projectData.error || 'Erro ao criar projeto')

      if (projectData.project?.id && form.voiceProfileId) {
        localStorage.setItem(`studio_selected_voice:${projectData.project.id}`, form.voiceProfileId)
      }
      if (projectData.project?.id && form.extraInstructions.trim()) {
        localStorage.setItem(`studio_extra_instructions:${projectData.project.id}`, form.extraInstructions.trim())
      }

      if (hasOwnLyric) {
        router.push(`/compositores/admin/studio-ia/projetos/${projectData.project.id}`)
        return
      }

      const lyricResponse = await fetch('/api/compositores/studio/lyrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: projectData.project.id,
          ...form,
          style: effectiveStyle,
        }),
      })
      const lyricData = await lyricResponse.json()
      if (!lyricResponse.ok) throw new Error(lyricData.error || 'Erro ao gerar letra')

      router.push(`/compositores/admin/studio-ia/projetos/${projectData.project.id}`)
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao criar música'
      if (
        errorMessage.includes('Você já usou sua música grátis') ||
        errorMessage.toLowerCase().includes('recarga avulsa')
      ) {
        showUpgradeModal('Você já usou sua música grátis e está sem saldo. Para continuar criando, escolha um plano ou compre uma recarga avulsa.')
        return
      }
      showError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const creditsRemaining = Number(studioStatus?.credits?.remaining || 0)
  const freeMusicRemaining = Number(studioStatus?.stats?.freeMusicRemaining || 0)
  const musicsFromCredits = Math.floor(creditsRemaining / studioMusicCredits)
  const planName = studioStatus?.planName as string | null | undefined
  const renewLabel = studioStatus?.renewalDate
    ? new Date(studioStatus.renewalDate).toLocaleDateString('pt-BR')
    : studioStatus?.periodEnd
      ? new Date(studioStatus.periodEnd).toLocaleDateString('pt-BR')
      : null

  const activeStep = (() => {
    if (loading) return 4
    if ((hasOwnLyric && existingLyric.trim().length >= 40) || (!hasOwnLyric && form.idea.trim().length >= 20)) return 3
    if (form.voiceGender !== 'Deixar a IA escolher' || form.voiceTone !== 'Deixar a IA escolher' || form.voiceProfileId) return 2
    return 1
  })()

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070d]">
        <FiLoader className="h-10 w-10 animate-spin text-primary-400" />
      </div>
    )
  }

  if (blockedCreation) {
    return (
      <div className="min-h-screen bg-[#05070d] py-6 sm:py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <Link href="/studio-ia#planos" className="mb-6 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300 sm:mb-8">
              <FiArrowLeft /> Voltar para planos
            </Link>

            <div className="rounded-2xl border border-purple-700/60 bg-gradient-to-br from-purple-950/60 via-black to-gray-950 p-5 text-center sm:rounded-3xl sm:p-8">
              <FiZap className="mx-auto mb-4 h-14 w-14 text-purple-300" />
              <h1 className="mb-3 text-2xl font-black sm:text-3xl">Você está sem saldo no Studio IA</h1>
              <p className="mx-auto mb-6 max-w-xl text-gray-300">
                Para criar novas músicas, escolha um plano Studio IA ou compre uma recarga avulsa. Se você acabou de pagar, atualize a página em alguns segundos.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/studio-ia#planos"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white"
                >
                  <FiZap />
                  Ver planos
                </Link>
                <Link
                  href="/compositores/admin/studio-ia/recarga"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-700 px-5 py-3 font-bold text-purple-100 hover:bg-purple-950/40"
                >
                  <FiCreditCard />
                  Comprar recarga avulsa
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#05070d] py-5 sm:py-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.12),transparent_24%)]" />
      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Link href="/compositores/admin/studio-ia" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-300 transition hover:text-primary-200">
            <FiArrowLeft /> Voltar ao Studio
          </Link>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-5">
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(145deg,rgba(12,10,20,0.98),rgba(24,16,40,0.92))] p-5 shadow-2xl shadow-purple-950/20 sm:p-7"
              >
                <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />
                <div className="absolute -bottom-24 left-10 h-48 w-48 rounded-full bg-primary-500/10 blur-3xl" />

                <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_240px] lg:items-center">
                  <div>
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-purple-100">
                      <FiPenTool /> Studio IA
                    </div>
                    <h1 className="max-w-xl text-3xl font-black leading-tight text-white sm:text-5xl">
                      Sua próxima{' '}
                      <span className="bg-gradient-to-r from-primary-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                        música começa aqui
                      </span>
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
                      Conte sua ideia em poucas palavras e a IA cria uma letra completa, pronta para cantar.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {([
                        { label: 'Letra profissional', Icon: FiFileText },
                        { label: 'Pronta para cantar', Icon: FiMusic },
                        { label: 'Em segundos', Icon: FiClock },
                      ] as const).map(({ label, Icon }) => (
                        <div
                          key={label}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-semibold text-gray-200"
                        >
                          <Icon className="h-3.5 w-3.5 text-primary-300" />
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-black/35 p-3 backdrop-blur">
                    <div className="overflow-hidden rounded-[1.15rem] border border-purple-300/15 bg-gradient-to-br from-purple-950/80 via-gray-950 to-black p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-fuchsia-500 text-white shadow-lg shadow-purple-950/40">
                          <FiPlay className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">Chave Falsa</p>
                          <p className="truncate text-xs text-purple-200/70">Sertanejo · Sofrência</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-end gap-1 px-1">
                        {[18, 28, 16, 34, 22, 40, 24, 32, 18, 36, 20, 30, 14, 26].map((height, index) => (
                          <div
                            key={index}
                            className="flex-1 rounded-full bg-gradient-to-t from-primary-600 to-fuchsia-400"
                            style={{ height }}
                          />
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-purple-100/60">
                        <span>Exemplo de resultado</span>
                        <span>03:12</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.section>

              <StepRail activeStep={activeStep} />

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gray-950/85 p-3 shadow-2xl shadow-black/30 backdrop-blur sm:p-5"
              >
                <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-purple-300/50 to-transparent" />

                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                    <SectionTitle icon={<FiMusic />} title="Informações da música" subtitle="Preencha o básico para a IA criar a letra." />

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <label className="block text-xs font-bold text-gray-100 sm:text-sm">Nome da música</label>
                          <span className="text-[11px] font-semibold text-gray-500">{form.title.length}/{titleMaxLength}</span>
                        </div>
                        <input
                          value={form.title}
                          onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, titleMaxLength) })}
                          maxLength={titleMaxLength}
                          placeholder="Ex: Chave Falsa"
                          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-primary-400 focus:bg-black/55"
                        />
                        <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
                          Use um nome curto para reduzir erro na criação.
                        </p>
                      </div>

                      <Select
                        label={loadingStyles ? 'Estilo musical (carregando...)' : 'Estilo musical'}
                        value={form.style}
                        options={styles}
                        onChange={(value) => setForm({ ...form, style: value })}
                      />
                      {form.style === customStyleOption ? (
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-gray-100 sm:text-sm">Digite o estilo</label>
                          <input
                            value={form.customStyle}
                            onChange={(e) => setForm({ ...form, customStyle: e.target.value })}
                            placeholder="Ex: piseiro romântico"
                            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-primary-400 focus:bg-black/55"
                          />
                        </div>
                      ) : (
                        <Select label="Clima da música" value={form.mood} options={moods} onChange={(value) => setForm({ ...form, mood: value })} />
                      )}
                      {form.style === customStyleOption && (
                        <Select label="Clima da música" value={form.mood} options={moods} onChange={(value) => setForm({ ...form, mood: value })} />
                      )}
                      <Select label="Tamanho da letra" value={form.lineCount} options={lineCounts} onChange={(value) => setForm({ ...form, lineCount: value })} />
                    </div>
                  </section>

                  <section className="rounded-[1.5rem] border border-purple-300/15 bg-purple-950/[0.16] p-4 sm:p-5">
                    <SectionTitle icon={<FiMic />} title="Direção de voz" subtitle="Opcional, mas ajuda no resultado final." />

                    <div className="mt-5 grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select label="Tipo de voz" value={form.voiceGender} options={voiceGenders} onChange={(value) => setForm({ ...form, voiceGender: value })} />
                        <Select label="Característica" value={form.voiceTone} options={voiceTones} onChange={(value) => setForm({ ...form, voiceTone: value })} />
                      </div>

                      <div className="rounded-2xl border border-purple-300/15 bg-black/30 p-3.5">
                        <label className="mb-1.5 block text-xs font-bold text-purple-100 sm:text-sm">Voz cadastrada</label>
                        <select
                          value={form.voiceProfileId}
                          onChange={(e) => setForm({ ...form, voiceProfileId: e.target.value })}
                          className="w-full rounded-2xl border border-purple-300/20 bg-gray-950 px-4 py-3.5 text-sm text-white outline-none transition focus:border-primary-400"
                        >
                          <option className="bg-gray-950 text-white" value="">Não usar voz clonada</option>
                          {voices.map((voice) => (
                            <option className="bg-gray-950 text-white" key={voice.id} value={voice.id}>{voice.displayName}</option>
                          ))}
                        </select>
                        <p className="mt-2 text-[11px] leading-relaxed text-purple-100/70">
                          Se não escolher, a IA segue apenas o tipo e característica de voz acima.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:col-span-2">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <SectionTitle
                        icon={<FiFileText />}
                        title={hasOwnLyric ? 'Letra pronta' : 'Ideia da música'}
                        subtitle={hasOwnLyric ? 'Cole a letra completa para criar o projeto.' : 'Fale sobre sua ideia, história ou sentimento.'}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setHasOwnLyric((current) => !current)
                          setError('')
                        }}
                        className="inline-flex w-full items-center justify-center rounded-2xl border border-primary-400/30 bg-primary-500/10 px-4 py-2.5 text-xs font-black text-primary-100 transition hover:border-primary-300/60 hover:bg-primary-500/20 sm:w-fit"
                      >
                        {hasOwnLyric ? 'Quero gerar com IA' : 'Já tenho a letra'}
                      </button>
                    </div>

                    {!hasOwnLyric && (
                      <div className="mb-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Sugestões de temas</p>
                        <div className="flex flex-wrap gap-2">
                          {themeSuggestions.map((theme) => (
                            <button
                              key={theme.id}
                              type="button"
                              onClick={() => applyThemeSuggestion(theme.id)}
                              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                                selectedTheme === theme.id
                                  ? 'border-primary-400/60 bg-primary-500/20 text-primary-100'
                                  : 'border-white/10 bg-black/25 text-gray-300 hover:border-primary-400/40 hover:text-white'
                              }`}
                            >
                              {theme.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="relative">
                      <textarea
                        value={hasOwnLyric ? existingLyric : form.idea}
                        onChange={(e) => {
                          if (hasOwnLyric) {
                            setExistingLyric(e.target.value)
                          } else {
                            setSelectedTheme('')
                            setForm({ ...form, idea: e.target.value.slice(0, ideaMaxLength) })
                          }
                        }}
                        rows={hasOwnLyric ? 10 : 6}
                        maxLength={hasOwnLyric ? undefined : ideaMaxLength}
                        placeholder={hasOwnLyric ? 'Cole aqui a letra completa da música...' : 'Ex: Um compositor descobre que a pessoa que ele amava usava uma chave falsa para entrar e sair da vida dele...'}
                        className="w-full resize-none rounded-[1.35rem] border border-white/10 bg-black/40 px-4 py-4 text-sm leading-relaxed text-white outline-none transition placeholder:text-gray-600 focus:border-primary-400 focus:bg-black/55"
                      />
                      {!hasOwnLyric && (
                        <p className="mt-2 text-right text-[11px] font-semibold text-gray-500">
                          {form.idea.length}/{ideaMaxLength}
                        </p>
                      )}
                    </div>

                    {hasOwnLyric && (
                      <p className="mt-3 text-xs font-semibold text-green-300">
                        Neste modo, salvamos sua letra no projeto sem gerar letra com IA. Ao criar o projeto, o sistema só reorganiza as quebras de linha para a IA cantar melhor — sem mudar nenhuma palavra.
                      </p>
                    )}
                  </section>

                  <section className="lg:col-span-2">
                    <button
                      type="button"
                      onClick={() => setShowLyricOptions((current) => !current)}
                      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-left text-sm font-black text-gray-100 transition hover:border-primary-400/50 hover:bg-white/[0.06]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <FiSliders className="text-primary-300" /> Ajustes finos
                      </span>
                      <FiChevronDown className={`h-4 w-4 transition-transform ${showLyricOptions ? 'rotate-180' : ''}`} />
                    </button>

                    {showLyricOptions && (
                      <div className="mt-3 space-y-3">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {[
                            ['avoidCliches', 'Evitar clichês'],
                            ['avoidChildishRhymes', 'Evitar rimas infantis'],
                            ['avoidRepeatedWords', 'Evitar palavras repetidas'],
                            ['stickyChorus', 'Refrão mais chiclete'],
                            ['popularLanguage', 'Linguagem mais popular'],
                            ['sophisticatedLanguage', 'Linguagem mais sofisticada'],
                          ].map(([key, label]) => (
                            <label key={key} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-xs font-bold text-gray-200 transition hover:border-primary-400/30 sm:text-sm">
                              <input
                                type="checkbox"
                                checked={Boolean((form as any)[key])}
                                onChange={(e) => setForm({ ...form, [key]: e.target.checked } as any)}
                                className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-primary-600"
                              />
                              {label}
                            </label>
                          ))}
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                          <Select label="Estrutura da música" value={form.structure} options={structures} onChange={(value) => setForm({ ...form, structure: value })} />
                          <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
                            Use Padrão para deixar a IA escolher a melhor organização da música.
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <label className="mb-1.5 block text-xs font-bold text-gray-100 sm:text-sm">Instrumentos que você quer (opcional)</label>
                            <input
                              value={form.wantInstruments}
                              onChange={(e) => setForm({ ...form, wantInstruments: e.target.value })}
                              placeholder="Ex: viola, violão, piano"
                              className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-primary-400 focus:bg-black/50"
                            />
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <label className="mb-1.5 block text-xs font-bold text-gray-100 sm:text-sm">Instrumentos para evitar (opcional)</label>
                            <input
                              value={form.avoidInstruments}
                              onChange={(e) => setForm({ ...form, avoidInstruments: e.target.value })}
                              placeholder="Ex: acordeon, sanfona"
                              className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-primary-400 focus:bg-black/50"
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-purple-300/15 bg-black/25 p-3">
                          <label className="block text-xs font-bold text-purple-100 sm:text-sm" htmlFor="new-studio-extra-instructions">
                            Outras instruções para a música
                          </label>
                          <textarea
                            id="new-studio-extra-instructions"
                            value={form.extraInstructions}
                            onChange={(e) => setForm({ ...form, extraInstructions: e.target.value.slice(0, 700) })}
                            rows={3}
                            maxLength={700}
                            placeholder="Ex.: usar minha voz cadastrada com interpretação masculina calma e expressiva."
                            className="mt-3 w-full resize-none rounded-2xl border border-purple-300/20 bg-gray-950 px-4 py-3 text-sm leading-relaxed text-white outline-none transition placeholder:text-gray-600 focus:border-primary-400"
                          />
                          <p className="mt-2 text-right text-[11px] text-gray-500">
                            {form.extraInstructions.length}/700
                          </p>
                        </div>
                      </div>
                    )}
                  </section>
                </div>

                {error && (
                  <div ref={errorRef} className="mt-4 rounded-2xl border border-red-500/40 bg-red-950/50 p-3 text-sm text-red-100">
                    {error}
                  </div>
                )}

                <div className="mt-5 rounded-[1.5rem] border border-purple-300/15 bg-gradient-to-r from-purple-950/45 via-gray-950 to-fuchsia-950/35 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {hasOwnLyric ? 'Salvar letra e abrir o projeto' : 'Gerar letra profissional'}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-300">
                        Gerar a letra <span className="font-bold text-green-300">não consome créditos</span>. A criação da música depois custa{' '}
                        <span className="font-bold text-purple-200">{studioMusicCredits} créditos</span>.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 via-purple-500 to-fuchsia-500 px-6 py-4 text-base font-black text-white shadow-lg shadow-purple-950/40 transition hover:scale-[1.01] hover:from-primary-400 hover:via-purple-400 hover:to-fuchsia-400 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto lg:min-w-[280px]"
                    >
                      {loading ? <FiLoader className="animate-spin" /> : <FiArrowRight />}
                      {loading
                        ? (hasOwnLyric ? 'Salvando letra...' : 'Criando letra...')
                        : (hasOwnLyric ? 'Salvar e Criar Projeto' : 'Criar minha música')}
                      {!loading && !hasOwnLyric && (
                        <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-bold text-purple-50">
                          Letra grátis
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
              <div className="overflow-hidden rounded-[1.5rem] border border-purple-300/20 bg-gradient-to-br from-purple-950/50 via-gray-950 to-black p-5 shadow-xl shadow-purple-950/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-purple-200/70">
                      {planName || 'Studio IA'}
                    </p>
                    <p className="mt-2 text-3xl font-black text-white">{creditsRemaining}</p>
                    <p className="text-sm font-semibold text-purple-100/80">créditos disponíveis</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-purple-300/20 bg-purple-500/10 text-purple-200">
                    <FiZap className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-300">
                  <p>
                    Dá para criar cerca de <span className="font-bold text-white">{musicsFromCredits}</span> música{musicsFromCredits === 1 ? '' : 's'}.
                  </p>
                  {freeMusicRemaining > 0 && (
                    <p className="font-bold text-green-300">+ {freeMusicRemaining} música grátis</p>
                  )}
                  {renewLabel && (
                    <p className="text-xs text-gray-500">Renovação / período: {renewLabel}</p>
                  )}
                </div>

                <Link
                  href="/compositores/admin/studio-ia/recarga"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-400/30 bg-white/5 px-4 py-3 text-sm font-bold text-purple-100 transition hover:bg-white/10"
                >
                  <FiCreditCard /> Ver meus créditos
                </Link>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-gray-950/90 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <FiHeart className="text-fuchsia-300" />
                  <h2 className="text-base font-black text-white">Exemplo de resultado</h2>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <p className="text-sm font-black text-white">Coração em Silêncio</p>
                  <p className="mt-1 text-xs text-gray-400">Sertanejo · Romântica</p>
                  <div className="mt-4 grid gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">Você escreve</p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-400">
                        Alguém ama em silêncio e não tem coragem de dizer.
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-300">A IA cria</p>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-gray-200">
                        {`[A]
Guardo no peito um segredo
Que nunca tive coragem de falar

[Refrão]
Meu coração em silêncio
Só sabe te amar`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          {upgradeModalMessage && (
            <UpgradeModal
              message={upgradeModalMessage}
              onClose={() => setUpgradeModalMessage('')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function StepRail({ activeStep }: { activeStep: number }) {
  const steps = [
    { id: 1, title: 'Informações', subtitle: 'Conte sobre sua música' },
    { id: 2, title: 'Direção de voz', subtitle: 'Defina o estilo vocal' },
    { id: 3, title: 'Ideia da música', subtitle: 'Fale sobre sua ideia' },
    { id: 4, title: 'Criar música', subtitle: 'IA compondo para você' },
  ]

  return (
    <div className="overflow-x-auto rounded-[1.5rem] border border-white/10 bg-gray-950/70 p-3 sm:p-4">
      <div className="flex min-w-[640px] items-stretch gap-2">
        {steps.map((step, index) => {
          const done = activeStep > step.id
          const current = activeStep === step.id
          return (
            <div key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
              <div className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 py-3 ${
                current
                  ? 'border-primary-400/40 bg-primary-500/10'
                  : done
                    ? 'border-green-400/20 bg-green-500/5'
                    : 'border-white/5 bg-black/20'
              }`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                  current
                    ? 'bg-gradient-to-br from-primary-500 to-fuchsia-500 text-white'
                    : done
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-white/5 text-gray-500'
                }`}>
                  {done ? <FiCheck /> : step.id}
                </div>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-black ${current || done ? 'text-white' : 'text-gray-400'}`}>{step.title}</p>
                  <p className="truncate text-[11px] text-gray-500">{step.subtitle}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`h-px w-4 shrink-0 ${done ? 'bg-green-400/40' : 'bg-white/10'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function UpgradeModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[110] flex items-start justify-center bg-black/80 px-4 pt-24 backdrop-blur"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md rounded-3xl border border-purple-600/70 bg-gradient-to-br from-gray-950 via-purple-950/80 to-black p-7 text-center shadow-2xl shadow-purple-950/60"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/30 p-2 text-gray-300 hover:bg-white/10 hover:text-white"
          aria-label="Fechar"
        >
          <FiX className="h-4 w-4" />
        </button>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-600/20 text-purple-200">
          <FiZap className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-black text-white">Você está sem saldo no Studio IA</h2>
        <p className="mt-3 text-sm leading-relaxed text-purple-100/90">{message}</p>
        <div className="mt-6 grid gap-3">
          <Link
            href="/studio-ia#planos"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white hover:from-primary-500 hover:to-purple-500"
          >
            <FiZap />
            Ver planos
          </Link>
          <Link
            href="/compositores/admin/studio-ia/recarga"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-600 px-5 py-3 font-bold text-purple-100 hover:bg-purple-950/50"
          >
            <FiCreditCard />
            Comprar recarga avulsa
          </Link>
        </div>
      </motion.div>
    </motion.div>
  )
}

function SectionTitle({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary-300/20 bg-primary-400/10 text-primary-200">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-black text-white sm:text-lg">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{subtitle}</p>
      </div>
    </div>
  )
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-gray-100 sm:text-sm">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm text-white outline-none transition focus:border-primary-400 focus:bg-black/55"
      >
        {options.map((option) => (
          <option className="bg-gray-950 text-white" key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}
