import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import {
  addStudioCreditTransaction,
  canCreateStudioMusicWithCredits,
  getFreeMusicUsage,
  getCurrentProjectAssets,
  getProjectForComposer,
  getStudioCallbackUrl,
  getStudioAccess,
  getStudioCreditUsage,
  STUDIO_MUSIC_CREDITS,
} from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'
import { getStudioVersionAudioUrls } from '@/lib/studio-audio-backup'
import { ensureMurekaVocalClone } from '@/lib/mureka-voice'
import { getMurekaFirstStylePrompt, isMurekaFirstStyle } from '@/lib/studio-mureka-first-styles'
import {
  getComposerEmailIdentity,
  sendAdminStudioAlertEmail,
  sendLowStudioCreditsEmail,
} from '@/lib/dcc-emails'
import { getAppNumberSetting } from '@/lib/app-settings'
import { normalizeStudioLyricStructure } from '@/lib/studio-lyric-normalizer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const STUDIO_TITLE_MAX_LENGTH = 30
const MUSIC_CREATION_UNAVAILABLE_MESSAGE = 'Sua letra foi salva, mas não conseguimos iniciar a criação da música agora. Tente novamente mais tarde.'
const MAX_STUDIO_MUSIC_DURATION_INSTRUCTION = 'Each returned audio track must contain only one complete song version, with a hard maximum duration of 4 minutes and 30 seconds. End each audio after the final section. Do not restart the song inside the same audio, do not repeat the entire song inside the same audio, do not append another full version in the same file, and do not create extended outros, long solos, or repeated loops.'
const TWO_VERSION_VARIATION_INSTRUCTION = 'If the provider returns two audio tracks, make them two clearly different alternative versions of the same song: different intro, arrangement, instrumental details, vocal interpretation, dynamics, or groove. Keep the same lyrics, language, genre, and emotional intention, but avoid making the two returned tracks identical.'
const STUDIO_CREATIVE_VARIATION_INSTRUCTION = 'criar melodia inédita e abordagem diferente a cada geração, mantendo o gênero escolhido e variando introdução, levada, arranjo, interpretação vocal e progressão melódica'
const MUREKA_CREATIVE_VARIATION_INSTRUCTION = 'Create an original melody and a fresh approach for each generation while keeping the chosen genre, varying intro, groove, arrangement, vocal interpretation and melodic progression.'
const MAX_STUDIO_MUSIC_NEGATIVE_TAGS = 'long song, repeated full song, extended outro, long solo, duplicate version, unclear vocals, rushed vocals'
const MUREKA_LYRICS_MAX_CHARS = 3000
const LONG_LYRIC_PREFER_MUREKA_CHARS_DEFAULT = Number(process.env.STUDIO_LONG_LYRIC_PREFER_MUREKA_CHARS || '1500') || 1500
const STUDIO_LONG_LYRIC_SETTING_KEY = 'studio.long_lyric_prefer_mureka_chars'

type StudioSongCountry = 'BR' | 'PT' | 'PY' | 'CO' | 'MX'

const INSTRUMENT_TRANSLATIONS: Record<string, string> = {
  'acordeon': 'accordion',
  'acordeom': 'accordion',
  'acordeão': 'accordion',
  'acordeao': 'accordion',
  'sanfona': 'accordion',
  'gaita': 'harmonica',
  'viola caipira': 'viola caipira',
  'viola': 'viola caipira',
  'violao': 'acoustic guitar',
  'violão': 'acoustic guitar',
  'guitarra': 'electric guitar',
  'guitarra eletrica': 'electric guitar',
  'bateria': 'drums',
  'percussao': 'percussion',
  'percussão': 'percussion',
  'piano': 'piano',
  'teclado': 'keyboard',
  'sintetizador': 'synth',
  'saxofone': 'saxophone',
  'sax': 'saxophone',
  'trompete': 'trumpet',
  'trombone': 'trombone',
  'flauta': 'flute',
  'cavaquinho': 'cavaquinho',
  'pandeiro': 'tambourine',
  'violino': 'violin',
  'baixo': 'bass guitar',
  'contrabaixo': 'bass guitar',
  'banjo': 'banjo',
  'cuica': 'cuica',
  'cuíca': 'cuica',
  'zabumba': 'zabumba',
  'triangulo': 'triangle',
  'triângulo': 'triangle',
  'orgao': 'organ',
  'órgão': 'organ',
}

function getForbiddenInstruments(description?: string | null) {
  const text = String(description || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const found = new Set<string>()

  if (!text) return [] as string[]

  const markerMatch = text.match(/instrumentos?[^:]*(?:proibidos?|para evitar|a evitar|que nao quero|sem)\s*:?\s*([^\n]+)/)
  const explicitList = markerMatch ? markerMatch[1] : ''

  for (const [pt, en] of Object.entries(INSTRUMENT_TRANSLATIONS)) {
    const normalizedPt = pt
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
    const phrasePatterns = [
      `sem ${normalizedPt}`,
      `sem o ${normalizedPt}`,
      `sem a ${normalizedPt}`,
      `proibido ${normalizedPt}`,
      `proibida ${normalizedPt}`,
      `nao quero ${normalizedPt}`,
      `evitar ${normalizedPt}`,
      `nada de ${normalizedPt}`,
      `tirar ${normalizedPt}`,
      `remover ${normalizedPt}`,
    ]
    const inExplicitList = explicitList
      ? new RegExp(`(^|[^a-z])${normalizedPt}([^a-z]|$)`).test(explicitList)
      : false

    if (inExplicitList || phrasePatterns.some((pattern) => text.includes(pattern))) {
      found.add(en)
    }
  }

  return Array.from(found)
}

function getDesiredInstruments(description?: string | null) {
  const text = String(description || '')
  const match = text.match(/instrumentos? (?:desejados?|que quero|que ele quer|preferidos?)\s*:?\s*([^\n]+)/i)
  return match ? match[1].trim() : ''
}

function hasUserProductionDetails(description?: string | null) {
  const text = String(description || '').toLowerCase()
  return [
    'instrumentos desejados',
    'instrumentos que quero',
    'instrumentos preferidos',
    'instrumentos para evitar',
    'voz masculina',
    'voz feminina',
    'voz grave',
    'voz média',
    'voz media',
    'voz aguda',
    'voz rouca',
    'voz suave',
    'voz forte',
    'dueto masculino e feminino',
    'instruções extras do compositor',
    'instrucoes extras do compositor',
  ].some((marker) => text.includes(marker))
}

function stripForbiddenInstrumentsFromStyle(style: string, forbidden: string[]) {
  if (forbidden.length === 0) return style

  let result = style
  for (const term of forbidden) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const segmentRegex = new RegExp(`[^,]*\\b${escaped}\\b[^,]*(,|$)`, 'gi')
    result = result.replace(segmentRegex, '')
  }

  return result
    .replace(/,\s*,/g, ', ')
    .replace(/^\s*,\s*/, '')
    .replace(/\s*,\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function getVoicePrompt(description?: string | null) {
  const descriptionText = String(description || '').toLowerCase()
  const parts: string[] = []
  const wantsMale = descriptionText.includes('voz masculina')
  const wantsFemale = descriptionText.includes('voz feminina')
  const wantsDuet = descriptionText.includes('dueto masculino e feminino')
  const wantsDeep = descriptionText.includes('voz grave')

  if (wantsDuet) parts.push('male and female duet vocals')
  if (wantsMale && wantsDeep) parts.push('deep male baritone vocal', 'low male voice')
  if (wantsFemale && wantsDeep) parts.push('deep female contralto vocal', 'low female voice')
  if (!wantsMale && !wantsFemale && wantsDeep) parts.push('deep low-register vocal', 'baritone vocal tone')
  if (wantsMale && !wantsDeep) parts.push('male vocal')
  if (wantsFemale && !wantsDeep) parts.push('female vocal')
  if (descriptionText.includes('voz média')) parts.push('medium vocal range')
  if (descriptionText.includes('voz aguda')) parts.push('high voice')
  if (descriptionText.includes('voz rouca')) parts.push('raspy voice')
  if (descriptionText.includes('voz suave')) parts.push('soft voice')
  if (descriptionText.includes('voz forte')) parts.push('powerful voice')

  return parts
}

function getVoiceNegativeTags(style?: string | null, description?: string | null) {
  if (isModaDeViolaStyle(style)) {
    return ''
  }

  return MAX_STUDIO_MUSIC_NEGATIVE_TAGS
}

function getInspirationInstruction(description?: string | null) {
  const match = String(description || '').match(/Instrução obrigatória de inspiração:\s*([^\n]+)/i)
  return match?.[1]?.trim() || ''
}

function getSunoCreativeDirection(description?: string | null) {
  return getInspirationInstruction(description) || STUDIO_CREATIVE_VARIATION_INSTRUCTION
}

function getSongCountry(description?: string | null): StudioSongCountry {
  const value = String(description || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (value.includes('mexico')) return 'MX'
  if (value.includes('colombia')) return 'CO'
  if (value.includes('paraguay')) return 'PY'
  if (value.includes('portugal')) return 'PT'
  // Compatibilidade com projetos antigos que só gravavam "Español" sem o país.
  if (value.includes('idioma da musica: espa')) return 'PY'
  return 'BR'
}

function getVocalLanguageInstruction(description?: string | null) {
  const country = getSongCountry(description)
  if (country === 'MX') return 'vocal en español mexicano, pronunciación natural de México'
  if (country === 'CO') return 'vocal en español colombiano, pronunciación natural de Colombia'
  if (country === 'PY') return 'vocal en español paraguayo, pronunciación natural de Paraguay'
  if (country === 'PT') return 'vocal em português europeu, pronúncia natural de Portugal'
  return 'vocal em português do Brasil'
}

function getMurekaLanguageInstructions(description?: string | null) {
  const country = getSongCountry(description)
  if (country === 'MX') {
    return [
      'Use natural Mexican Spanish vocal phrasing and pronunciation.',
      'The lyrics are in Mexican Spanish; preserve their emotional meaning and section structure.',
      'Use a polished production that respects the selected Mexican regional or Latin genre.',
    ]
  }
  if (country === 'CO') {
    return [
      'Use natural Colombian Spanish vocal phrasing and pronunciation.',
      'The lyrics are in Colombian Spanish; preserve their emotional meaning and section structure.',
      'Use a polished production that respects the selected Colombian or Latin genre.',
    ]
  }
  if (country === 'PY') {
    return [
      'Use natural Paraguayan Spanish vocal phrasing and pronunciation.',
      'The lyrics are in Paraguayan Spanish; preserve their emotional meaning and section structure.',
      'Use a polished production that respects the selected Paraguayan or Latin genre.',
    ]
  }
  if (country === 'PT') {
    return [
      'Use natural European Portuguese vocal phrasing and pronunciation from Portugal.',
      'The lyrics are in European Portuguese; preserve their emotional meaning and section structure.',
      'Use a polished production that respects the selected Portuguese genre.',
    ]
  }
  return [
    'Use Brazilian Portuguese vocal phrasing and pronunciation.',
    'The lyrics are in Brazilian Portuguese; preserve their emotional meaning and section structure.',
    'Create a polished full song arrangement, radio-ready, modern mix, professional Brazilian production.',
  ]
}

function getMurekaCreativeDirection(description?: string | null) {
  const inspirationInstruction = getInspirationInstruction(description)
  return inspirationInstruction
    ? `Mandatory inspiration direction: ${inspirationInstruction}.`
    : MUREKA_CREATIVE_VARIATION_INSTRUCTION
}

function buildSunoStyle(style: string | null, mood: string | null, description?: string | null) {
  const forbiddenInstruments = getForbiddenInstruments(description)
  const desiredInstruments = getDesiredInstruments(description)
  const stylePrompt = stripForbiddenInstrumentsFromStyle(getBrazilianStylePrompt(style, description), forbiddenInstruments)
  const normalizedMood = String(mood || '').trim()
  const hasMood = normalizedMood && normalizedMood.toLowerCase() !== 'livre'
  const parts = [
    stylePrompt,
    hasMood ? `clima ${normalizedMood}` : null,
    getSunoCreativeDirection(description),
    ...getVoicePrompt(description),
    desiredInstruments ? `instrumentos: ${desiredInstruments}` : null,
    getVocalLanguageInstruction(description),
    'interpretação natural e expressiva',
    'dicção clara sem atropelar palavras',
    'fraseado com pausas e respiração natural',
    'duração máxima de 4 minutos e 30 segundos',
    'uma única versão completa',
    'encerrar depois do final',
    'não repetir a música inteira',
    'se gerar duas faixas, criar duas versões alternativas diferentes',
    'música objetiva sem final longo',
  ].filter(Boolean)

  return parts.join(', ').slice(0, 1000)
}

function normalizeExtraInstructions(value: any) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700)
}

function appendExtraInstructionsToStyle(stylePrompt: string, extraInstructions: string) {
  if (!extraInstructions) return stylePrompt
  return `${stylePrompt}, instruções extras do compositor: ${extraInstructions}`.slice(0, 1000)
}

function getSunoStyleWeight(description?: string | null) {
  return hasUserProductionDetails(description) ? 0.55 : 0.38
}

function getSunoWeirdnessConstraint(description?: string | null) {
  return hasUserProductionDetails(description) ? 0.2 : 0.32
}

function normalizeStyleName(style?: string | null) {
  return String(style || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function isModaDeViolaStyle(style?: string | null) {
  const normalized = normalizeStyleName(style)
  return (
    normalized.includes('moda de viola') ||
    normalized.includes('modao') ||
    normalized.includes('modao raiz') ||
    normalized.includes('viola caipira') ||
    normalized.includes('sertanejo raiz') ||
    normalized.includes('caipira raiz') ||
    normalized.includes('tiao carreiro') ||
    normalized.includes('pardinho')
  )
}

// Mantém apenas a IDENTIDADE do gênero (sem impor instrumentos ou arranjo fixo),
// para não fazer todas as músicas saírem iguais e para respeitar o que o usuário escreve.
function getBrazilianStylePrompt(style?: string | null, description?: string | null) {
  const normalized = normalizeStyleName(style)
  const userStyle = String(style || '').trim()
  const country = getSongCountry(description)

  if (!userStyle) {
    if (country === 'MX') return 'regional Mexican music'
    if (country === 'PT') return 'Portuguese popular music'
    if (country === 'CO') return 'Colombian popular music'
    if (country === 'PY') return 'Paraguayan popular music'
    return 'Brazilian popular music'
  }

  // Fora do Brasil, nunca converte "pop", "rock" ou "trap" para a versão brasileira.
  // Isso evita o vazamento cultural que já aconteceu nas primeiras localizações.
  if (country !== 'BR') {
    if (country === 'MX') {
      if (normalized.includes('regional mexicano')) return 'regional Mexican music, modern authentic Mexican production'
      if (normalized.includes('corridos tumbados')) return 'corridos tumbados, modern regional Mexican, requinto and bass-driven groove'
      if (normalized === 'corrido' || normalized.includes('corrido tradicional')) return 'Mexican corrido, narrative regional Mexican music'
      if (normalized.includes('banda sinaloense')) return 'banda sinaloense, regional Mexican brass band'
      if (normalized.includes('norteno')) return 'norteño, regional Mexican accordion and bajo sexto style'
      if (normalized.includes('sierreno')) return 'sierreño, regional Mexican acoustic guitar style'
      if (normalized.includes('mariachi')) return 'Mexican mariachi'
      if (normalized.includes('ranchera')) return 'Mexican ranchera'
      if (normalized.includes('cumbia mexicana')) return 'Mexican cumbia'
      if (normalized.includes('duranguense')) return 'duranguense, regional Mexican dance music'
    }
    if (country === 'PT') {
      if (normalized === 'fado' || normalized.includes('fado ')) return 'Portuguese fado'
      if (normalized.includes('pop portugues')) return 'Portuguese pop from Portugal'
      if (normalized.includes('rock portugues')) return 'Portuguese rock from Portugal'
      if (normalized.includes('hip-hop tuga')) return 'Portuguese hip-hop, hip-hop tuga'
      if (normalized.includes('pimba')) return 'Portuguese pimba music'
    }
    return userStyle
  }

  if (isModaDeViolaStyle(style)) {
    return 'sertanejo raiz caipira, viola caipira, moda de viola'
  }

  if (normalized.includes('mpb') || normalized.includes('musica popular brasileira')) {
    return 'MPB, Música Popular Brasileira, sophisticated and poetic Brazilian style'
  }
  if (normalized.includes('funk')) return 'Brazilian funk'
  if (normalized.includes('trap')) return 'Brazilian trap'
  if (normalized.includes('rap')) return 'Brazilian rap'
  if (normalized.includes('rock')) return 'Brazilian rock'
  if (normalized.includes('pop')) return 'Brazilian pop'
  if (normalized.includes('gospel')) return 'Brazilian gospel'

  // Dica de época quando o usuário cita "anos 80/90" no estilo digitado (não força instrumentos).
  if (normalized.includes('anos 80') || normalized.includes('decada de 80') || normalized.includes('80s')) {
    return `${userStyle}, 1980s romantic pop style, retro 80s vibe`
  }
  if (normalized.includes('anos 90') || normalized.includes('decada de 90') || normalized.includes('90s')) {
    return `${userStyle}, 1990s style, retro 90s vibe`
  }

  // Para os demais (sertanejo, pagode, forró, arrocha, piseiro, samba, ou estilo digitado
  // pelo usuário), envia exatamente o que ele escolheu/escreveu.
  return userStyle
}

// PRINCÍPIO: o gênero que o usuário escolheu é o que vale.
// Este "freio" só existe para impedir que a IA derive para sertanejo quando o usuário
// escolheu algo de FORA da família sertaneja/raiz (drift comum no romântico brasileiro).
// Para qualquer gênero da família sertaneja/raiz (Sertanejo, Sertanejo Brega, Moda de Viola,
// Vanerão, Arrocha, etc.), o freio NÃO liga, para não brigar com a escolha do usuário.
function getGenreNegativeTags(style?: string | null) {
  const normalized = normalizeStyleName(style)
  if (isModaDeViolaStyle(style)) {
    return [] as string[]
  }

  const sertanejoFamily = [
    'sertanejo',
    'arrocha',
    'sofrencia',
    'modao',
    'moda de viola',
    'viola',
    'caipira',
    'vanerao',
    'vaneirao',
    'vaneira',
    'vaquejada',
    'agronejo',
    'raiz',
  ]
  const choseSertanejoFamily = sertanejoFamily.some((genre) => normalized.includes(genre))
  if (choseSertanejoFamily) return [] as string[]

  return [
    'sertanejo',
    'sertanejo universitario',
    'sertanejo romantico',
    'arrocha',
    'modao',
    'musica caipira',
    'country',
  ]
}

function getMurekaVoiceInstructions(description?: string | null) {
  const descriptionText = String(description || '').toLowerCase()
  const instructions: string[] = []
  const wantsMale = descriptionText.includes('voz masculina')
  const wantsFemale = descriptionText.includes('voz feminina')
  const wantsDuet = descriptionText.includes('dueto masculino e feminino')

  if (wantsDuet) {
    instructions.push('Must use a clear male and female duet vocal performance.')
  } else if (wantsMale) {
    instructions.push('Must use a male lead vocal. Avoid female lead vocal.')
  } else if (wantsFemale) {
    instructions.push('Must use a female lead vocal. Avoid male lead vocal.')
  } else {
    instructions.push('Use a natural expressive lead vocal that matches the genre.')
  }

  if (descriptionText.includes('voz grave')) {
    instructions.push('Voice tone must be deep, low-register and full-bodied. Avoid high pitched, thin or falsetto vocals.')
  }
  if (descriptionText.includes('voz média')) {
    instructions.push('Voice tone should be medium range, balanced and natural.')
  }
  if (descriptionText.includes('voz aguda')) {
    instructions.push('Voice tone should be high-register, bright and controlled.')
  }
  if (descriptionText.includes('voz rouca')) {
    instructions.push('Voice texture should be raspy, emotional and slightly rough.')
  }
  if (descriptionText.includes('voz suave')) {
    instructions.push('Voice texture should be soft, warm and intimate.')
  }
  if (descriptionText.includes('voz forte')) {
    instructions.push('Voice delivery should be powerful, confident and expressive.')
  }

  return instructions
}

function buildMurekaFirstStylePrompt(corePrompt: string, mood: string | null, description?: string | null) {
  const forbiddenInstruments = getForbiddenInstruments(description)
  const desiredInstruments = getDesiredInstruments(description)
  const parts = [
    corePrompt,
    mood ? `Must express this mood clearly: ${mood}.` : 'Use an emotional, commercial and engaging mood.',
    ...getMurekaVoiceInstructions(description),
    desiredInstruments ? `Use these instruments requested by the user: ${desiredInstruments}.` : null,
    forbiddenInstruments.length > 0
      ? `Avoid these instruments requested by the user: ${forbiddenInstruments.join(', ')}.`
      : null,
    ...getMurekaLanguageInstructions(description),
    getMurekaCreativeDirection(description),
    MAX_STUDIO_MUSIC_DURATION_INSTRUCTION,
    'Avoid robotic vocals, distorted vocals, unclear pronunciation, spoken-only performance, weak melody, amateur arrangement.',
  ].filter(Boolean)

  return parts.join(', ').slice(0, 1024)
}

function buildMurekaPromptForStyle(style: string | null, mood: string | null, description?: string | null) {
  const murekaFirstPrompt = getMurekaFirstStylePrompt(style)
  if (murekaFirstPrompt) {
    return buildMurekaFirstStylePrompt(murekaFirstPrompt, mood, description)
  }
  return buildMurekaPrompt(style, mood, description)
}

function buildMurekaPrompt(style: string | null, mood: string | null, description?: string | null) {
  const forbiddenInstruments = getForbiddenInstruments(description)
  const desiredInstruments = getDesiredInstruments(description)
  const stylePrompt = stripForbiddenInstrumentsFromStyle(getBrazilianStylePrompt(style, description), forbiddenInstruments)
  const country = getSongCountry(description)
  const countryStyleLabel = country === 'MX'
    ? 'Mexican regional or Latin music style'
    : country === 'CO'
      ? 'Colombian or Latin music style'
      : country === 'PY'
        ? 'Paraguayan or Latin music style'
        : country === 'PT'
          ? 'Portuguese music style from Portugal'
          : 'Brazilian music style'
  const parts = [
    `${countryStyleLabel}: ${stylePrompt}.`,
    mood ? `Must express this mood clearly: ${mood}.` : 'Use an emotional, commercial and engaging mood.',
    ...getMurekaVoiceInstructions(description),
    desiredInstruments ? `Use these instruments requested by the user: ${desiredInstruments}.` : null,
    forbiddenInstruments.length > 0
      ? `Avoid these instruments requested by the user: ${forbiddenInstruments.join(', ')}.`
      : null,
    ...getMurekaLanguageInstructions(description),
    getMurekaCreativeDirection(description),
    MAX_STUDIO_MUSIC_DURATION_INSTRUCTION,
    'Avoid robotic vocals, distorted vocals, unclear pronunciation, spoken-only performance, weak melody, amateur arrangement.',
  ].filter(Boolean)

  return parts.join(', ').slice(0, 1024)
}

function summarizeSunoError(response: Response, result: any) {
  return {
    httpStatus: response.status,
    httpStatusText: response.statusText,
    code: result?.code ?? null,
    message: result?.message || result?.msg || result?.error || result?.data?.message || null,
    raw: result,
  }
}

function summarizeMurekaError(response: Response, result: any) {
  return {
    httpStatus: response.status,
    httpStatusText: response.statusText,
    message: result?.error?.message || result?.message || result?.failed_reason || null,
    traceId: result?.trace_id || null,
    raw: result,
  }
}

function adminErrorDetailsHtml(input: {
  project: any
  composer: any
  payload: any
  errorSummary: any
  lyricContent: string
}) {
  const safeJson = JSON.stringify(input.errorSummary, null, 2).slice(0, 3500)
  return `
    <div style="background:#030712; border:1px solid #374151; border-radius:14px; padding:16px; margin-top:18px;">
      <p><strong>Projeto:</strong> ${input.project.title}</p>
      <p><strong>Project ID:</strong> ${input.project.id}</p>
      <p><strong>Composer ID:</strong> ${input.composer.composerId}</p>
      <p><strong>Estilo enviado:</strong> ${input.payload.style}</p>
      <p><strong>Título enviado:</strong> ${input.payload.title}</p>
      <p><strong>Tamanho da letra:</strong> ${input.lyricContent.length} caracteres</p>
      <p><strong>HTTP:</strong> ${input.errorSummary.httpStatus} ${input.errorSummary.httpStatusText || ''}</p>
      <p><strong>Mensagem do fornecedor interno:</strong> ${input.errorSummary.message || 'Não informada'}</p>
    </div>
    <div style="background:#111827; border:1px solid #374151; border-radius:14px; padding:16px; margin-top:14px;">
      <p><strong>Resposta técnica:</strong></p>
      <pre style="white-space:pre-wrap; word-break:break-word; color:#d1d5db; font-size:12px;">${safeJson}</pre>
    </div>
  `
}

async function notifyAfterMusicGeneration(input: {
  composer: any
  composerId: string
}) {
  const [{ limits: latestLimits }, identity] = await Promise.all([
    getStudioAccess(input.composerId),
    getComposerEmailIdentity(input.composerId),
  ])
  const usageAfter = await getStudioCreditUsage(input.composerId, latestLimits)
  const remainingMusics = Math.floor(usageAfter.remaining / STUDIO_MUSIC_CREDITS)

  if (identity && usageAfter.remaining <= STUDIO_MUSIC_CREDITS) {
    await sendLowStudioCreditsEmail({
      ...identity,
      remainingCredits: usageAfter.remaining,
      remainingMusics,
      monthKey: usageAfter.monthKey,
    }).catch((emailError) => {
      console.error('[Studio IA] Erro ao enviar aviso de saldo baixo:', emailError)
    })
  }

  if ([10, 25, 50].includes(usageAfter.musicGenerations)) {
    await sendAdminStudioAlertEmail({
      title: 'Compositor usando bastante o Studio IA',
      message: `${identity?.name || input.composer.name || 'Compositor'} chegou a ${usageAfter.musicGenerations} músicas geradas no mês.`,
      eventKey: `studio-high-usage/${input.composerId}/${usageAfter.monthKey}/${usageAfter.musicGenerations}`,
      metadata: {
        composerId: input.composerId,
        musicGenerations: usageAfter.musicGenerations,
        monthKey: usageAfter.monthKey,
      },
    }).catch(() => null)
  }
}

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { hasAccess, limits } = await getStudioAccess(composer.composerId)
    const usage = await getStudioCreditUsage(composer.composerId, limits)
    const hasPaidCredits = canCreateStudioMusicWithCredits(usage)
    let isFreeGeneration = false

    if (!hasAccess && !hasPaidCredits) {
      const freeMusicUsage = await getFreeMusicUsage(composer.composerId)
      if (freeMusicUsage.remaining <= 0) {
        return NextResponse.json(
          {
            error: 'Você já usou sua música grátis. Assine um plano DCC Studio IA ou faça uma recarga avulsa para criar novas músicas.',
          },
          { status: 403 }
        )
      }
      isFreeGeneration = true
    }

    if (!isFreeGeneration && !hasPaidCredits) {
      return NextResponse.json(
        { error: `Você atingiu seu saldo de músicas do DCC Studio IA. Faça uma recarga avulsa para continuar criando ainda este mês.` },
        { status: 429 }
      )
    }

    const sunoApiKey = process.env.SUNOAPI_KEY?.trim()
    const murekaApiKey = process.env.MUREKA_API_KEY?.trim()
    if (!sunoApiKey && !murekaApiKey) {
      return NextResponse.json(
        { error: 'A geração musical não está configurada no servidor.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const project = await getProjectForComposer(body.projectId, composer.composerId)
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    let selectedVoice: any = null
    if (body.voiceProfileId) {
      const { data: voice, error: voiceError } = await supabaseAdmin
        .from('studio_voice_profiles')
        .select('id, display_name, voice_id, status, is_available, provider_payload, source_audio_path, source_audio_storage_provider, source_audio_content_type, source_audio_size_bytes, verify_audio_path, verify_audio_storage_provider, verify_audio_content_type, verify_audio_size_bytes')
        .eq('id', body.voiceProfileId)
        .eq('composer_id', composer.composerId)
        .maybeSingle()

      if (voiceError) throw voiceError
      if (!voice || voice.status !== 'ready' || !voice.is_available || !voice.voice_id) {
        return NextResponse.json({ error: 'A voz selecionada ainda não está pronta para uso.' }, { status: 400 })
      }
      selectedVoice = voice
    }

    const { lyric } = await getCurrentProjectAssets(project.id)
    const lyricContent = (body.lyric || lyric?.content || '').trim()
    if (lyricContent.length < 40) {
      return NextResponse.json({ error: 'Gere ou escreva uma letra antes de criar a música.' }, { status: 400 })
    }

    // Proteção de backend: a estrutura da letra é sempre normalizada antes da geração.
    // O cliente não pode desativar esta etapa, inclusive em chamadas antigas/diretas à API.
    const improveStructureForAi = true
    const lyricNormalization = improveStructureForAi
      ? normalizeStudioLyricStructure(lyricContent)
      : {
          lyric: lyricContent,
          changed: false,
          usedOriginal: true,
          linesBefore: lyricContent.split(/\r?\n/).filter((line: string) => line.trim()).length,
          linesAfter: lyricContent.split(/\r?\n/).filter((line: string) => line.trim()).length,
        }
    const lyricForGeneration = lyricNormalization.lyric

    if (lyricNormalization.changed) {
      await supabaseAdmin
        .from('studio_lyrics')
        .update({ is_current: false, updated_at: new Date().toISOString() })
        .eq('project_id', project.id)
        .eq('composer_id', composer.composerId)

      const { error: normalizedLyricError } = await supabaseAdmin
        .from('studio_lyrics')
        .insert({
          project_id: project.id,
          composer_id: composer.composerId,
          content: lyricForGeneration,
          is_current: true,
          prompt: {
            source: 'structure_normalizer',
            improveStructureForAi: true,
            linesBefore: lyricNormalization.linesBefore,
            linesAfter: lyricNormalization.linesAfter,
          },
        })

      if (normalizedLyricError) throw normalizedLyricError
    }

    const { data: inspirationRequest } = await supabaseAdmin
      .from('studio_inspiration_requests')
      .select('*')
      .eq('composer_id', composer.composerId)
      .eq('target_project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let inspirationUploadUrl: string | null = null
    const inspirationInstruction = String(inspirationRequest?.request_payload?.inspirationInstruction || '').trim()
    const requestedInspirationAudioWeight = Number(inspirationRequest?.request_payload?.audioWeight)
    const inspirationAudioWeight = Number.isFinite(requestedInspirationAudioWeight)
      ? Math.min(0.75, Math.max(0.3, requestedInspirationAudioWeight))
      : 0.75
    if (inspirationRequest?.source_version_id) {
      const { data: sourceVersion, error: sourceVersionError } = await supabaseAdmin
        .from('studio_versions')
        .select('*')
        .eq('id', inspirationRequest.source_version_id)
        .eq('composer_id', composer.composerId)
        .maybeSingle()

      if (sourceVersionError) throw sourceVersionError
      if (sourceVersion) {
        const sourceAudio = await getStudioVersionAudioUrls(sourceVersion)
        inspirationUploadUrl = sourceAudio.audioUrl || sourceAudio.streamAudioUrl || null
      }
      if (!inspirationUploadUrl) {
        return NextResponse.json({ error: 'Não foi possível carregar o áudio de inspiração.' }, { status: 400 })
      }
    }

    const projectDescriptionForGeneration = [
      project.description,
      inspirationInstruction ? `Instrução obrigatória de inspiração: ${inspirationInstruction}` : null,
    ].filter(Boolean).join('\n')
    const extraInstructions = normalizeExtraInstructions(body.extraInstructions)
    const extraInstructionsAlreadyInProject = extraInstructions &&
      projectDescriptionForGeneration.toLowerCase().includes(extraInstructions.toLowerCase())
    const extraInstructionsForPrompt = extraInstructionsAlreadyInProject ? '' : extraInstructions
    const descriptionWithExtraInstructions = [
      projectDescriptionForGeneration,
      extraInstructionsForPrompt ? `Instruções extras do compositor: ${extraInstructionsForPrompt}` : null,
    ].filter(Boolean).join('\n')
    const baseSunoStyle = buildSunoStyle(project.style, project.mood, descriptionWithExtraInstructions)
    const sunoStyleWeight = getSunoStyleWeight(descriptionWithExtraInstructions)
    const sunoWeirdnessConstraint = getSunoWeirdnessConstraint(descriptionWithExtraInstructions)

    const sunoPayload: any = {
      prompt: lyricForGeneration.slice(0, 5000),
      style: appendExtraInstructionsToStyle(baseSunoStyle, extraInstructionsForPrompt),
      title: project.title.slice(0, STUDIO_TITLE_MAX_LENGTH),
      customMode: true,
      instrumental: false,
      model: 'V5_5',
      callBackUrl: getStudioCallbackUrl('/api/studio/suno/callback'),
      styleWeight: sunoStyleWeight,
      weirdnessConstraint: sunoWeirdnessConstraint,
      negativeTags: getVoiceNegativeTags(project.style, descriptionWithExtraInstructions),
    }

    if (selectedVoice?.voice_id) {
      sunoPayload.personaId = selectedVoice.voice_id
      sunoPayload.personaModel = 'voice_persona'
    }

    const sunoEndpoint = inspirationUploadUrl
      ? 'https://api.sunoapi.org/api/v1/generate/upload-cover'
      : 'https://api.sunoapi.org/api/v1/generate'
    const sunoRequestPayload = inspirationUploadUrl
      ? {
          ...sunoPayload,
          uploadUrl: inspirationUploadUrl,
          audioWeight: inspirationAudioWeight,
          styleWeight: Math.max(sunoStyleWeight, 0.55),
        }
      : sunoPayload

    const failedAttempts: any[] = []
    let providerResult: {
      provider: 'sunoapi' | 'mureka'
      taskId: string
      payload: any
      result: any
    } | null = null
    const lyricCharCount = lyricForGeneration.length
    const longLyricPreferMurekaChars = await getAppNumberSetting(
      STUDIO_LONG_LYRIC_SETTING_KEY,
      LONG_LYRIC_PREFER_MUREKA_CHARS_DEFAULT
    )
    const isMurekaFirstByStyle = isMurekaFirstStyle(project.style)
    const isLongLyricForMureka =
      lyricCharCount >= longLyricPreferMurekaChars &&
      lyricCharCount <= MUREKA_LYRICS_MAX_CHARS
    const preferMurekaReason = inspirationUploadUrl
      ? 'none'
      : isMurekaFirstByStyle
        ? 'mureka_first_style'
        : isLongLyricForMureka
          ? 'long_lyric'
          : 'none'
    const preferMureka = preferMurekaReason !== 'none'

    const trySuno = async () => {
      if (providerResult || !sunoApiKey) return

      try {
        const response = await fetch(sunoEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sunoApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sunoRequestPayload),
        })

        const result = await response.json().catch(() => null)

        if (response.ok && result?.code === 200 && result?.data?.taskId) {
          providerResult = {
            provider: 'sunoapi',
            taskId: result.data.taskId,
            payload: sunoRequestPayload,
            result,
          }
        } else {
          const errorSummary = summarizeSunoError(response, result)
          console.error('[Studio IA] Erro no fornecedor Suno:', result)
          failedAttempts.push({ provider: 'sunoapi', errorSummary })
        }
      } catch (error: any) {
        const errorSummary = {
          message: error?.message || 'Falha de rede no fornecedor Suno',
          raw: { name: error?.name, cause: error?.cause?.message || null },
        }
        console.error('[Studio IA] Falha de rede no fornecedor Suno:', error)
        failedAttempts.push({ provider: 'sunoapi', errorSummary })
      }
    }

    const tryMureka = async () => {
      if (providerResult || !murekaApiKey || inspirationUploadUrl) return

      let murekaVocalClone: Awaited<ReturnType<typeof ensureMurekaVocalClone>> | null = null

      if (selectedVoice) {
        try {
          murekaVocalClone = await ensureMurekaVocalClone(selectedVoice)
        } catch (error: any) {
          const errorSummary = {
            message: error?.message || 'Falha ao preparar voz no Mureka',
            raw: { name: error?.name, cause: error?.cause?.message || null },
          }
          console.error('[Studio IA] Falha ao preparar voz no Mureka:', error)
          failedAttempts.push({ provider: 'mureka-vocal-clone', errorSummary })
        }
      }

      const canUseMureka = !selectedVoice || Boolean(murekaVocalClone?.vocalId)
      const murekaPayload = canUseMureka ? {
        lyrics: lyricForGeneration.slice(0, MUREKA_LYRICS_MAX_CHARS),
        model: 'auto',
        n: 2,
        prompt: buildMurekaPromptForStyle(project.style, project.mood, projectDescriptionForGeneration),
        ...(murekaVocalClone?.vocalId ? { vocal_id: murekaVocalClone.vocalId } : {}),
        stream: true,
      } : null

      try {
        if (!murekaPayload) throw new Error('Voz selecionada ainda não tem vocal_id Mureka.')
        const response = await fetch('https://api.mureka.ai/v1/song/generate', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${murekaApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(murekaPayload),
        })

        const result = await response.json().catch(() => null)
        const taskId = result?.id || result?.data?.taskId || result?.data?.id

        if (response.ok && taskId) {
          providerResult = {
            provider: 'mureka',
            taskId,
            payload: murekaPayload,
            result,
          }
        } else {
          const errorSummary = summarizeMurekaError(response, result)
          console.error('[Studio IA] Erro no fornecedor Mureka:', result)
          failedAttempts.push({ provider: 'mureka', errorSummary })
        }
      } catch (error: any) {
        const errorSummary = {
          message: error?.message || 'Falha de rede no fornecedor Mureka',
          raw: { name: error?.name, cause: error?.cause?.message || null },
        }
        console.error('[Studio IA] Falha de rede no fornecedor Mureka:', error)
        failedAttempts.push({ provider: 'mureka', errorSummary })
      }
    }

    if (preferMureka) {
      await tryMureka()
      await trySuno()
    } else {
      await trySuno()
      await tryMureka()
    }

    if (!providerResult) {
      await sendAdminStudioAlertEmail({
        title: 'Falha ao iniciar música no Studio IA',
        message: `Os fornecedores musicais recusaram a geração do projeto "${project.title}".`,
        eventKey: `studio-music-api-error/${project.id}/${Date.now()}`,
        metadata: {
          composerId: composer.composerId,
          projectId: project.id,
          failedAttempts,
          payload: sunoPayload,
          selectedVoiceId: selectedVoice?.id || null,
        },
        detailsHtml: adminErrorDetailsHtml({
          project,
          composer,
          payload: sunoPayload,
          errorSummary: failedAttempts,
          lyricContent: lyricForGeneration,
        }),
      }).catch(() => null)
      return NextResponse.json(
        { error: MUSIC_CREATION_UNAVAILABLE_MESSAGE },
        { status: 500 }
      )
    }

    const { provider, taskId, payload, result } = providerResult
    const providerAttemptLog = {
      finalProvider: provider,
      preferMureka,
      preferMurekaReason,
      lyricCharCount,
      longLyricThreshold: longLyricPreferMurekaChars,
      murekaLyricsMaxChars: MUREKA_LYRICS_MAX_CHARS,
      lyricNormalized: lyricNormalization.changed,
      lyricNormalizationUsedOriginal: lyricNormalization.usedOriginal,
      lyricLinesBefore: lyricNormalization.linesBefore,
      lyricLinesAfter: lyricNormalization.linesAfter,
      improveStructureForAi,
      attempts: failedAttempts,
      fallbackUsed: failedAttempts.length > 0 && (
        preferMureka ? provider !== 'mureka' : provider !== 'sunoapi'
      ),
      createdAt: new Date().toISOString(),
    }
    const shouldAttachProviderAttemptLog =
      preferMureka || failedAttempts.length > 0 || lyricNormalization.changed || improveStructureForAi
    const requestPayload = shouldAttachProviderAttemptLog
      ? {
          ...(typeof payload === 'object' && payload !== null ? payload : {}),
          providerAttemptLog,
        }
      : payload
    const responsePayload = shouldAttachProviderAttemptLog
      ? {
          ...(typeof result === 'object' && result !== null ? result : {}),
          providerAttemptLog,
        }
      : result

    const { data: generation, error } = await supabaseAdmin
      .from('studio_generations')
      .insert({
        project_id: project.id,
        composer_id: composer.composerId,
        provider,
        provider_task_id: taskId,
        status: 'processing',
        request_payload: requestPayload,
        response_payload: responsePayload,
      })
      .select('*')
      .single()

    if (error) throw error

    if (inspirationRequest?.id) {
      await supabaseAdmin
        .from('studio_inspiration_requests')
        .update({
          status: 'processing',
          provider_task_id: taskId,
          request_payload: requestPayload,
          response_payload: responsePayload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inspirationRequest.id)
    }

    await Promise.all([
      addStudioCreditTransaction({
        composerId: composer.composerId,
        projectId: project.id,
        action: isFreeGeneration ? 'free_music_generation' : 'music_generation',
        amount: isFreeGeneration ? 0 : STUDIO_MUSIC_CREDITS,
        description: isFreeGeneration ? 'Música grátis de boas-vindas no DCC Studio IA' : 'Geração de música no DCC Studio IA',
        metadata: { taskId, free: isFreeGeneration, topup: !hasAccess && !isFreeGeneration },
      }),
      supabaseAdmin
        .from('studio_projects')
        .update({ status: 'generating', updated_at: new Date().toISOString() })
        .eq('id', project.id),
    ])

    if (!isFreeGeneration) {
      notifyAfterMusicGeneration({
        composer,
        composerId: composer.composerId,
      }).catch((notificationError) => {
        console.error('[Studio IA] Erro pós-geração:', notificationError)
      })
    }

    return NextResponse.json({
      success: true,
      generationId: generation.id,
      taskId,
      lyric: lyricForGeneration,
      lyricNormalized: lyricNormalization.changed,
      message: lyricNormalization.changed
        ? 'Estrutura da letra ajustada para a IA. Geração iniciada.'
        : 'Geração iniciada. A música pode levar alguns minutos para finalizar.',
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro criar música:', error)
    return NextResponse.json({ error: MUSIC_CREATION_UNAVAILABLE_MESSAGE }, { status: 500 })
  }
}
