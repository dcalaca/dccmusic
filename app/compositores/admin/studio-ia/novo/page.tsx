'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useLocalization } from '@/components/LocalizationProvider'
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
const customStyleOptionEs = 'Otro / escribir mi estilo'
const customStyleOptionEn = 'Other / enter my style'
const titleMaxLength = 30
const ideaMaxLength = 1000
const moods = ['Romântica', 'Sofrência', 'Chiclete', 'Engraçada', 'Reflexiva', 'Balada', 'Triste', 'Motivacional']
const structures = ['Padrão', 'A/B/Refrão/C/Refrão', 'A/Refrão/A/Refrão']
const lineCounts = ['curta', 'média', 'longa']
const voiceGenders = ['Deixar a IA escolher', 'Voz masculina', 'Voz feminina', 'Dueto masculino e feminino']
const voiceTones = ['Deixar a IA escolher', 'Voz grave', 'Voz média', 'Voz aguda', 'Voz rouca', 'Voz suave', 'Voz forte']
const studioMusicCredits = 10
const songLanguages = [
  'English (United States)',
  'English (United Kingdom)',
  'Português (Brasil)',
  'Português (Portugal)',
  'Español (Paraguay)',
  'Español (Colombia)',
  'Español (México)',
  'Español (España)',
]
const commonSpanishStyles = [
  'Pop latino',
  'Balada romántica',
  'Rock en español',
  'Rap / Hip-hop',
  'Trap latino',
  'Música cristiana',
]
const paraguayStyles = [
  'Guarania paraguaya',
  'Polca paraguaya',
  'Cumbia paraguaya',
  'Cachaca paraguaya',
  'Reggaetón',
  ...commonSpanishStyles,
]
const colombiaStyles = [
  'Música popular colombiana',
  'Vallenato',
  'Cumbia colombiana',
  'Salsa colombiana',
  'Champeta',
  'Reggaetón colombiano',
  'Música llanera / Joropo',
  'Carranga',
  'Bambuco',
  'Porro colombiano',
  ...commonSpanishStyles,
]
const portugalStyles = [
  'Pop português',
  'Fado',
  'Música popular portuguesa',
  'Pimba',
  'Rock português',
  'Hip-hop tuga',
  'Folk português',
  'Balada portuguesa',
  'Música cristã',
]
const mexicoStyles = [
  'Regional mexicano',
  'Corridos tumbados',
  'Corrido',
  'Banda sinaloense',
  'Norteño',
  'Sierreño',
  'Mariachi',
  'Ranchera',
  'Cumbia mexicana',
  'Duranguense',
  'Reggaetón',
  ...commonSpanishStyles,
  'Emo / Pop-punk',
]
const spainStyles = [
  'Flamenco',
  'Flamenco pop',
  'Rumba flamenca',
  'Pop español',
  'Rock español',
  'Indie español',
  'Cantautor',
  'Copla',
  'Reggaetón',
  'Urbano latino',
  'Electrónica',
  ...commonSpanishStyles,
]
const unitedStatesStyles = [
  'Pop',
  'Hip-Hop / Rap',
  'R&B',
  'Country',
  'Rock',
  'Alternative / Indie',
  'EDM / Dance',
  'Gospel',
  'Jazz',
  'Blues',
  'Folk',
  'Soul',
  'Funk',
  'Metal',
  'Punk',
  'Latin Pop / Reggaeton',
  customStyleOptionEn,
]
const unitedKingdomStyles = [
  'UK Pop',
  'Indie Rock',
  'Alternative Rock',
  'Britpop',
  'Grime',
  'UK Drill',
  'UK Garage',
  'Drum and Bass',
  'Electronic / Dance',
  'R&B',
  'Soul',
  'Folk',
  'Singer-Songwriter',
  'Rock',
  'Punk',
  'Metal',
  'Gospel',
  customStyleOptionEn,
]
const paraguayStyleOptions = [...paraguayStyles, customStyleOptionEs]
const colombiaStyleOptions = [...colombiaStyles, customStyleOptionEs]
const portugalStyleOptions = [...portugalStyles, customStyleOption]
const mexicoStyleOptions = [...mexicoStyles, customStyleOptionEs]
const spainStyleOptions = [...spainStyles, customStyleOptionEs]

function getStudioCountryPreset(country: string) {
  if (country === 'US') {
    return { language: 'English (United States)', defaultStyle: 'Pop', styleOptions: unitedStatesStyles, isSpanish: false }
  }
  if (country === 'GB') {
    return { language: 'English (United Kingdom)', defaultStyle: 'UK Pop', styleOptions: unitedKingdomStyles, isSpanish: false }
  }
  if (country === 'PY') {
    return { language: 'Español (Paraguay)', defaultStyle: 'Guarania paraguaya', styleOptions: paraguayStyleOptions, isSpanish: true }
  }
  if (country === 'CO') {
    return { language: 'Español (Colombia)', defaultStyle: 'Música popular colombiana', styleOptions: colombiaStyleOptions, isSpanish: true }
  }
  if (country === 'PT') {
    return { language: 'Português (Portugal)', defaultStyle: 'Pop português', styleOptions: portugalStyleOptions, isSpanish: false }
  }
  if (country === 'MX') {
    return { language: 'Español (México)', defaultStyle: 'Regional mexicano', styleOptions: mexicoStyleOptions, isSpanish: true }
  }
  if (country === 'ES') {
    return { language: 'Español (España)', defaultStyle: 'Flamenco pop', styleOptions: spainStyleOptions, isSpanish: true }
  }
  return { language: 'Português (Brasil)', defaultStyle: 'Sertanejo', styleOptions: null as string[] | null, isSpanish: false }
}

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
const themeSuggestionsEsPy = [
  { id: 'amor', label: 'Amor', text: 'Una historia de amor verdadero, con cariño, deseo y ganas de permanecer juntos.' },
  { id: 'termino', label: 'Ruptura', text: 'El final de una relación, el dolor de la despedida y la dificultad de seguir adelante.' },
  { id: 'sofrencia', label: 'Desamor', text: 'Alguien que todavía ama, sufre en silencio y no logra olvidar a la persona amada.' },
  { id: 'saudade', label: 'Añoranza', text: 'La añoranza de alguien especial, de los recuerdos y de los momentos que ya no volverán.' },
  { id: 'perdao', label: 'Perdón', text: 'Un pedido sincero de perdón, con arrepentimiento y deseos de comenzar de nuevo.' },
  { id: 'fe', label: 'Fe', text: 'Un mensaje de fe, esperanza y fortaleza para atravesar los momentos difíciles.' },
  { id: 'festa', label: 'Fiesta', text: 'Una noche de fiesta, alegría y amistad, con ganas de disfrutar sin pensar en mañana.' },
  { id: 'superacao', label: 'Superación', text: 'Una persona que cayó, volvió a levantarse y descubrió su propia fuerza en el camino.' },
]
const themeSuggestionsEn = [
  { id: 'amor', label: 'Love', text: 'A true love story filled with affection, desire, and the wish to stay together.' },
  { id: 'termino', label: 'Breakup', text: 'The end of a relationship, the pain of saying goodbye, and the struggle to move on.' },
  { id: 'sofrencia', label: 'Heartbreak', text: 'Someone who is still in love, suffers in silence, and cannot forget the person they loved.' },
  { id: 'saudade', label: 'Missing someone', text: 'Missing someone special, the memories they shared, and moments that will never return.' },
  { id: 'perdao', label: 'Forgiveness', text: 'A sincere apology filled with regret and the desire to start over.' },
  { id: 'fe', label: 'Faith', text: 'A message of faith, hope, and strength to get through difficult times.' },
  { id: 'festa', label: 'Party', text: 'A night of celebration, joy, friendship, and living in the moment.' },
  { id: 'superacao', label: 'Overcoming', text: 'Someone who fell, got back up, and discovered their own strength along the way.' },
]

const englishOptionLabels: Record<string, string> = {
  'Romântica': 'Romantic',
  'Sofrência': 'Heartbreak',
  'Chiclete': 'Catchy',
  'Engraçada': 'Funny',
  'Reflexiva': 'Reflective',
  'Balada': 'Ballad',
  'Triste': 'Sad',
  'Motivacional': 'Motivational',
  'Padrão': 'Standard',
  'A/B/Refrão/C/Refrão': 'A/B/Chorus/C/Chorus',
  'A/Refrão/A/Refrão': 'A/Chorus/A/Chorus',
  'curta': 'Short',
  'média': 'Medium',
  'longa': 'Long',
  'Deixar a IA escolher': 'Let AI choose',
  'Voz masculina': 'Male voice',
  'Voz feminina': 'Female voice',
  'Dueto masculino e feminino': 'Male and female duet',
  'Voz grave': 'Low voice',
  'Voz média': 'Mid-range voice',
  'Voz aguda': 'High voice',
  'Voz rouca': 'Raspy voice',
  'Voz suave': 'Soft voice',
  'Voz forte': 'Powerful voice',
}

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
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { country } = useLocalization()
  const isParaguay = country === 'PY'
  const isColombia = country === 'CO'
  const isPortugal = country === 'PT'
  const isMexico = country === 'MX'
  const isSpain = String(country) === 'ES'
  const isEnglish = String(country) === 'US' || String(country) === 'GB'
  const countryPreset = getStudioCountryPreset(country)
  const isSpanish = countryPreset.isSpanish
  const localizedThemeSuggestions = isEnglish ? themeSuggestionsEn : isSpanish ? themeSuggestionsEsPy : themeSuggestions
  const localizedStructures = isSpanish
    ? ['Estándar', 'A/B/Estribillo/C/Estribillo', 'A/Estribillo/A/Estribillo']
    : structures
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
    style: countryPreset.defaultStyle,
    customStyle: '',
    mood: 'Sofrência',
    structure: isSpanish ? 'Estándar' : 'Padrão',
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
    songLanguage: countryPreset.language,
  })
  const isCustomStyle = form.style === customStyleOption || form.style === customStyleOptionEs || form.style === customStyleOptionEn

  useEffect(() => {
    const preset = getStudioCountryPreset(country)
    if (preset.styleOptions) setStyles(preset.styleOptions)
    setForm((current) => ({
      ...current,
      songLanguage: preset.language,
      style: preset.styleOptions && !preset.styleOptions.includes(current.style)
        ? preset.defaultStyle
        : current.style,
      structure: preset.isSpanish
        ? (current.structure === 'Padrão' ? 'Estándar' : current.structure)
        : (current.structure === 'Estándar' ? 'Padrão' : current.structure),
    }))
  }, [country])

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
        if (!response.ok) throw new Error(t('studio.new.errors.loadGenres'))

        const data = await response.json()
        const genreNames = (data || [])
          .map((genre: any) => String(genre.name || '').trim())
          .filter(Boolean)
        const preset = getStudioCountryPreset(country)

        if (preset.styleOptions) {
          setStyles(preset.styleOptions)
          setForm((currentForm) => (
            preset.styleOptions!.includes(currentForm.style)
              ? currentForm
              : { ...currentForm, style: preset.defaultStyle }
          ))
        } else if (genreNames.length > 0) {
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
  }, [country])

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
    const theme = localizedThemeSuggestions.find((item) => item.id === themeId)
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
      showError(t('studio.create.validation.title'))
      return
    }
    if (isCustomStyle && form.customStyle.trim().length < 3) {
      showError(t('studio.create.validation.customStyle'))
      return
    }
    if (hasOwnLyric && existingLyric.trim().length < 40) {
      showError(t('studio.create.validation.lyrics'))
      return
    }
    if (!hasOwnLyric && !form.idea.trim()) {
      showError(t('studio.create.validation.idea'))
      return
    }

    setLoading(true)
    try {
      const effectiveStyle = isCustomStyle ? form.customStyle.trim() : form.style
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
          showUpgradeModal(t('studio.create.errors.noCredits'))
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
          idea: hasOwnLyric ? form.idea || t('studio.create.lyricsProvided') : form.idea,
          lyric: hasOwnLyric ? existingLyric : undefined,
        }),
      })
      const projectData = await projectResponse.json()
      if (!projectResponse.ok) throw new Error(t('studio.create.errors.project'))

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
          Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId: projectData.project.id,
          ...form,
          style: effectiveStyle,
        }),
      })
      const lyricData = await lyricResponse.json()
      if (!lyricResponse.ok) throw new Error(t('studio.create.errors.lyrics'))

      router.push(`/compositores/admin/studio-ia/projetos/${projectData.project.id}`)
    } catch (err: any) {
      const errorMessage = err.message || t('studio.create.errors.song')
      if (
        errorMessage.includes('Você já usou sua música grátis') ||
        errorMessage.toLowerCase().includes('recarga avulsa')
      ) {
        showUpgradeModal(t('studio.create.errors.noCredits'))
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
    ? new Date(studioStatus.renewalDate).toLocaleDateString(i18n.language)
    : studioStatus?.periodEnd
      ? new Date(studioStatus.periodEnd).toLocaleDateString(i18n.language)
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
              <FiArrowLeft /> {t('studio.create.backToPlans')}
            </Link>

            <div className="rounded-2xl border border-purple-700/60 bg-gradient-to-br from-purple-950/60 via-black to-gray-950 p-5 text-center sm:rounded-3xl sm:p-8">
              <FiZap className="mx-auto mb-4 h-14 w-14 text-purple-300" />
              <h1 className="mb-3 text-2xl font-black sm:text-3xl">{t('studio.create.noCreditsTitle')}</h1>
              <p className="mx-auto mb-6 max-w-xl text-gray-300">
                {t('studio.create.noCreditsDescription')}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/studio-ia#planos"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white"
                >
                  <FiZap />
                  {t('studio.create.viewPlans')}
                </Link>
                <Link
                  href="/compositores/admin/studio-ia/recarga"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-700 px-5 py-3 font-bold text-purple-100 hover:bg-purple-950/40"
                >
                  <FiCreditCard />
                  {t('studio.create.buyTopup')}
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
            <FiArrowLeft /> {t('studio.create.backToStudio')}
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
                      <FiPenTool /> {t('studio.create.badge')}
                    </div>
                    <h1 className="max-w-xl text-3xl font-black leading-tight text-white sm:text-5xl">
                      {t('studio.create.heroPrefix')}
                      <span className="bg-gradient-to-r from-primary-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                        {t('studio.create.heroHighlight')}
                      </span>
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
                      {t('studio.create.heroDescription')}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {([
                        { label: isEnglish ? 'Professional lyrics' : 'Letra profissional', Icon: FiFileText },
                        { label: isEnglish ? 'Ready to sing' : 'Pronta para cantar', Icon: FiMusic },
                        { label: isEnglish ? 'In seconds' : 'Em segundos', Icon: FiClock },
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
                          <p className="truncate text-sm font-black text-white">{isEnglish ? 'False Key' : 'Chave Falsa'}</p>
                          <p className="truncate text-xs text-purple-200/70">{t('studio.new.preview.style')}</p>
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
                        <span>{t('studio.create.sample.title')}</span>
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
                    <SectionTitle
                      icon={<FiMusic />}
                      title={t('studio.create.sections.detailsTitle')}
                      subtitle={t('studio.create.sections.detailsSubtitle')}
                    />

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <label className="block text-xs font-bold text-gray-100 sm:text-sm">{t('studio.create.fields.title')}</label>
                          <span className="text-[11px] font-semibold text-gray-500">{form.title.length}/{titleMaxLength}</span>
                        </div>
                        <input
                          value={form.title}
                          onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, titleMaxLength) })}
                          maxLength={titleMaxLength}
                          placeholder={t('studio.create.placeholders.title')}
                          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-primary-400 focus:bg-black/55"
                        />
                        <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
                          {t('studio.create.hints.shortTitle')}
                        </p>
                      </div>

                      <Select
                        label={loadingStyles
                          ? t('studio.create.fields.styleLoading')
                          : t('studio.create.fields.style')}
                        value={form.style}
                        options={styles}
                        onChange={(value) => setForm({ ...form, style: value })}
                      />
                      {isCustomStyle ? (
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-gray-100 sm:text-sm">{t('studio.create.fields.customStyle')}</label>
                          <input
                            value={form.customStyle}
                            onChange={(e) => setForm({ ...form, customStyle: e.target.value })}
                            placeholder={isEnglish ? 'Example: cinematic indie pop' : isMexico ? 'Ej.: corrido romántico con sierreño' : isSpain ? 'Ej.: flamenco pop con guitarra española' : isPortugal ? 'Ex.: fado pop contemporâneo' : 'Ex: piseiro romântico'}
                            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-primary-400 focus:bg-black/55"
                          />
                        </div>
                      ) : (
                        <Select label={t('studio.create.fields.mood')} value={form.mood} options={moods} optionLabels={isEnglish ? englishOptionLabels : undefined} onChange={(value) => setForm({ ...form, mood: value })} />
                      )}
                      {isCustomStyle && (
                        <Select label={t('studio.create.fields.mood')} value={form.mood} options={moods} optionLabels={isEnglish ? englishOptionLabels : undefined} onChange={(value) => setForm({ ...form, mood: value })} />
                      )}
                      <Select label={t('studio.create.fields.lyricsLength')} value={form.lineCount} options={lineCounts} optionLabels={isEnglish ? englishOptionLabels : undefined} onChange={(value) => setForm({ ...form, lineCount: value })} />
                      <Select label={t('studio.create.fields.language')} value={form.songLanguage} options={songLanguages} onChange={(value) => setForm({ ...form, songLanguage: value })} />
                    </div>
                  </section>

                  <section className="rounded-[1.5rem] border border-purple-300/15 bg-purple-950/[0.16] p-4 sm:p-5">
                    <SectionTitle icon={<FiMic />} title={t('studio.create.sections.voiceTitle')} subtitle={t('studio.create.sections.voiceSubtitle')} />

                    <div className="mt-5 grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select label={t('studio.create.fields.voiceType')} value={form.voiceGender} options={voiceGenders} optionLabels={isEnglish ? englishOptionLabels : undefined} onChange={(value) => setForm({ ...form, voiceGender: value })} />
                        <Select label={t('studio.create.fields.voiceTone')} value={form.voiceTone} options={voiceTones} optionLabels={isEnglish ? englishOptionLabels : undefined} onChange={(value) => setForm({ ...form, voiceTone: value })} />
                      </div>

                      <div className="rounded-2xl border border-purple-300/15 bg-black/30 p-3.5">
                        <label className="mb-1.5 block text-xs font-bold text-purple-100 sm:text-sm">{t('studio.create.fields.savedVoice')}</label>
                        <select
                          value={form.voiceProfileId}
                          onChange={(e) => setForm({ ...form, voiceProfileId: e.target.value })}
                          className="w-full rounded-2xl border border-purple-300/20 bg-gray-950 px-4 py-3.5 text-sm text-white outline-none transition focus:border-primary-400"
                        >
                          <option className="bg-gray-950 text-white" value="">{t('studio.create.fields.noClonedVoice')}</option>
                          {voices.map((voice) => (
                            <option className="bg-gray-950 text-white" key={voice.id} value={voice.id}>{voice.displayName}</option>
                          ))}
                        </select>
                        <p className="mt-2 text-[11px] leading-relaxed text-purple-100/70">
                          {t('studio.create.hints.savedVoice')}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:col-span-2">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <SectionTitle
                        icon={<FiFileText />}
                        title={hasOwnLyric ? t('studio.create.sections.lyricsReady') : t('studio.create.sections.ideaTitle')}
                        subtitle={hasOwnLyric ? t('studio.create.sections.lyricsReadySubtitle') : t('studio.create.sections.ideaSubtitle')}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setHasOwnLyric((current) => !current)
                          setError('')
                        }}
                        className="inline-flex w-full items-center justify-center rounded-2xl border border-primary-400/30 bg-primary-500/10 px-4 py-2.5 text-xs font-black text-primary-100 transition hover:border-primary-300/60 hover:bg-primary-500/20 sm:w-fit"
                      >
                        {hasOwnLyric ? t('studio.create.actions.useAI') : t('studio.create.actions.haveLyrics')}
                      </button>
                    </div>

                    {!hasOwnLyric && (
                      <div className="mb-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">{t('studio.create.themeIdeas')}</p>
                        <div className="flex flex-wrap gap-2">
                          {localizedThemeSuggestions.map((theme) => (
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
                        placeholder={hasOwnLyric ? t('studio.create.placeholders.lyrics') : t('studio.create.placeholders.idea')}
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
                        {t('studio.create.hints.ownLyrics')}
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
                        <FiSliders className="text-primary-300" /> {t('studio.create.advanced')}
                      </span>
                      <FiChevronDown className={`h-4 w-4 transition-transform ${showLyricOptions ? 'rotate-180' : ''}`} />
                    </button>

                    {showLyricOptions && (
                      <div className="mt-3 space-y-3">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {[
                            ['avoidCliches', isEnglish ? 'Avoid clichés' : isSpanish ? 'Evitar clichés' : 'Evitar clichês'],
                            ['avoidChildishRhymes', isEnglish ? 'Avoid childish rhymes' : isSpanish ? 'Evitar rimas infantiles' : 'Evitar rimas infantis'],
                            ['avoidRepeatedWords', isEnglish ? 'Avoid repeated words' : isSpanish ? 'Evitar palabras repetidas' : 'Evitar palavras repetidas'],
                            ['stickyChorus', isEnglish ? 'Make the chorus catchier' : isSpanish ? 'Estribillo más pegadizo' : 'Refrão mais chiclete'],
                            ['popularLanguage', isEnglish ? 'Use everyday language' : isSpanish ? 'Lenguaje más popular' : 'Linguagem mais popular'],
                            ['sophisticatedLanguage', isEnglish ? 'Use sophisticated language' : isSpanish ? 'Lenguaje más sofisticado' : 'Linguagem mais sofisticada'],
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
                          <Select label={t('studio.create.fields.structure')} value={form.structure} options={localizedStructures} optionLabels={isEnglish ? englishOptionLabels : undefined} onChange={(value) => setForm({ ...form, structure: value })} />
                          <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
                            {isEnglish
                              ? 'Use Standard to let AI choose the best song structure.'
                              : isSpanish
                              ? 'Usa Estándar para que la IA elija la mejor organización de la canción.'
                              : 'Use Padrão para deixar a IA escolher a melhor organização da música.'}
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <label className="mb-1.5 block text-xs font-bold text-gray-100 sm:text-sm">{t('studio.new.instruments')}</label>
                            <input
                              value={form.wantInstruments}
                              onChange={(e) => setForm({ ...form, wantInstruments: e.target.value })}
                              placeholder={isParaguay
                                ? 'Ej.: guitarra, arpa paraguaya, piano'
                                : isColombia
                                  ? 'Ej.: acordeón, caja vallenata, guitarra'
                                  : isMexico
                                    ? 'Ej.: acordeón, bajo sexto, trompeta, tololoche'
                                    : isPortugal
                                      ? 'Ex.: guitarra portuguesa, viola, piano'
                                      : isEnglish
                                        ? 'Example: acoustic guitar, piano, strings'
                                        : 'Ex: viola, violão, piano'}
                              className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-primary-400 focus:bg-black/50"
                            />
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <label className="mb-1.5 block text-xs font-bold text-gray-100 sm:text-sm">{isEnglish ? 'Instruments to avoid (optional)' : isSpanish ? 'Instrumentos que quieres evitar (opcional)' : 'Instrumentos para evitar (opcional)'}</label>
                            <input
                              value={form.avoidInstruments}
                              onChange={(e) => setForm({ ...form, avoidInstruments: e.target.value })}
                              placeholder={isEnglish ? 'Example: synthesizer, electric guitar' : isSpanish ? 'Ej.: sintetizador, guitarra eléctrica' : 'Ex: acordeon, sanfona'}
                              className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-primary-400 focus:bg-black/50"
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-purple-300/15 bg-black/25 p-3">
                          <label className="block text-xs font-bold text-purple-100 sm:text-sm" htmlFor="new-studio-extra-instructions">
                            {t('studio.create.fields.extraInstructions')}
                          </label>
                          <textarea
                            id="new-studio-extra-instructions"
                            value={form.extraInstructions}
                            onChange={(e) => setForm({ ...form, extraInstructions: e.target.value.slice(0, 700) })}
                            rows={3}
                            maxLength={700}
                            placeholder={isEnglish
                              ? 'Example: use my saved voice with a calm, expressive male performance.'
                              : isSpanish
                              ? 'Ej.: usar mi voz registrada con una interpretación masculina tranquila y expresiva.'
                              : 'Ex.: usar minha voz cadastrada com interpretação masculina calma e expressiva.'}
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
                        {hasOwnLyric
                          ? (isEnglish ? 'Save lyrics and open project' : 'Salvar letra e abrir o projeto')
                          : (isEnglish ? 'Generate professional lyrics' : 'Gerar letra profissional')}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-300">
                        {isEnglish ? (
                          <>Generating lyrics <span className="font-bold text-green-300">uses no credits</span>. Creating the song afterward costs{' '}
                            <span className="font-bold text-purple-200">{studioMusicCredits} credits</span>.</>
                        ) : (
                          <>Gerar a letra <span className="font-bold text-green-300">não consome créditos</span>. A criação da música depois custa{' '}
                            <span className="font-bold text-purple-200">{studioMusicCredits} créditos</span>.</>
                        )}
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
                        ? (hasOwnLyric ? (isEnglish ? 'Saving lyrics...' : 'Salvando letra...') : (isEnglish ? 'Creating lyrics...' : 'Criando letra...'))
                        : (hasOwnLyric ? (isEnglish ? 'Save and Create Project' : 'Salvar e Criar Projeto') : (isEnglish ? 'Create my song' : 'Criar minha música'))}
                      {!loading && !hasOwnLyric && (
                        <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-bold text-purple-50">
                          {t('studio.new.freeLyrics')}
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
                    <p className="text-sm font-semibold text-purple-100/80">{t('studio.create.sidebar.creditsAvailable')}</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-purple-300/20 bg-purple-500/10 text-purple-200">
                    <FiZap className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-300">
                  <p>
                    {isEnglish ? (
                      <>You can create about <span className="font-bold text-white">{musicsFromCredits}</span> song{musicsFromCredits === 1 ? '' : 's'}.</>
                    ) : (
                      <>Dá para criar cerca de <span className="font-bold text-white">{musicsFromCredits}</span> música{musicsFromCredits === 1 ? '' : 's'}.</>
                    )}
                  </p>
                  {freeMusicRemaining > 0 && (
                    <p className="font-bold text-green-300">+ {freeMusicRemaining} {isEnglish ? `free song${freeMusicRemaining === 1 ? '' : 's'}` : 'música grátis'}</p>
                  )}
                  {renewLabel && (
                    <p className="text-xs text-gray-500">{t('studio.create.sidebar.renewal')}: {renewLabel}</p>
                  )}
                </div>

                <Link
                  href="/compositores/admin/studio-ia/recarga"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-400/30 bg-white/5 px-4 py-3 text-sm font-bold text-purple-100 transition hover:bg-white/10"
                >
                  <FiCreditCard /> {t('studio.create.sidebar.viewCredits')}
                </Link>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-gray-950/90 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <FiHeart className="text-fuchsia-300" />
                  <h2 className="text-base font-black text-white">{t('studio.create.sample.title')}</h2>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <p className="text-sm font-black text-white">{t('studio.new.preview.title')}</p>
                  <p className="mt-1 text-xs text-gray-400">{t('studio.new.preview.romanticStyle')}</p>
                  <div className="mt-4 grid gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">{t('studio.create.sample.youWrite')}</p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-400">
                        {t('studio.new.preview.idea')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-300">{t('studio.create.sample.aiCreates')}</p>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-gray-200">
                        {isEnglish
                          ? `[Verse]
I keep a secret in my heart
I never found the words to say

[Chorus]
My heart speaks in silence
But it only calls your name`
                          : `[A]
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
  const { t } = useTranslation()
  const steps = [1, 2, 3, 4].map((id) => ({
    id,
    title: t(`studio.create.steps.${id}.title`),
    subtitle: t(`studio.create.steps.${id}.subtitle`),
  }))

  return (
    <div className="overflow-x-auto rounded-[1.5rem] border border-white/10 bg-gray-950/70 p-3 sm:p-4">
      <div className="flex min-w-[640px] items-stretch gap-2">
        {steps.map((step, index) => {
          const done = activeStep > step.id
          const current = activeStep === step.id
          return (
            <div key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
              <div className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 py-3 ${
                current ? 'border-primary-400/40 bg-primary-500/10' : done ? 'border-green-400/20 bg-green-500/5' : 'border-white/5 bg-black/20'
              }`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                  current ? 'bg-gradient-to-br from-primary-500 to-fuchsia-500 text-white' : done ? 'bg-green-500/20 text-green-300' : 'bg-white/5 text-gray-500'
                }`}>
                  {done ? <FiCheck /> : step.id}
                </div>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-black ${current || done ? 'text-white' : 'text-gray-400'}`}>{step.title}</p>
                  <p className="truncate text-[11px] text-gray-500">{step.subtitle}</p>
                </div>
              </div>
              {index < steps.length - 1 && <div className={`h-px w-4 shrink-0 ${done ? 'bg-green-400/40' : 'bg-white/10'}`} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function UpgradeModal({ message, onClose }: { message: string; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[110] flex items-start justify-center bg-black/80 px-4 pt-24 backdrop-blur">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: -12 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative w-full max-w-md rounded-3xl border border-purple-600/70 bg-gradient-to-br from-gray-950 via-purple-950/80 to-black p-7 text-center shadow-2xl shadow-purple-950/60">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/30 p-2 text-gray-300 hover:bg-white/10 hover:text-white" aria-label={t('common.actions.close')}>
          <FiX className="h-4 w-4" />
        </button>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-600/20 text-purple-200"><FiZap className="h-8 w-8" /></div>
        <h2 className="text-2xl font-black text-white">{t('studio.create.noCreditsTitle')}</h2>
        <p className="mt-3 text-sm leading-relaxed text-purple-100/90">{message}</p>
        <div className="mt-6 grid gap-3">
          <Link href="/studio-ia#planos" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white hover:from-primary-500 hover:to-purple-500">
            <FiZap /> {t('studio.create.viewPlans')}
          </Link>
          <Link href="/compositores/admin/studio-ia/recarga" className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-600 px-5 py-3 font-bold text-purple-100 hover:bg-purple-950/50">
            <FiCreditCard /> {t('studio.create.buyTopup')}
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

function Select({ label, value, options, optionLabels, onChange }: { label: string; value: string; options: string[]; optionLabels?: Record<string, string>; onChange: (value: string) => void }) {
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
            {optionLabels?.[option] || option}
          </option>
        ))}
      </select>
    </div>
  )
}
