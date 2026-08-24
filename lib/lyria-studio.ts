export type LyriaStudioSettings = {
  title: string
  style: string
  mood: string
  structure: string
  lineCount: string
  songLanguage: string
  idea: string
  voiceGender: string
  voiceTone: string
  wantInstruments: string
  avoidInstruments: string
  extraInstructions: string
  avoidCliches: boolean
  avoidChildishRhymes: boolean
  avoidRepeatedWords: boolean
  stickyChorus: boolean
  popularLanguage: boolean
  sophisticatedLanguage: boolean
}

function clean(value: unknown, limit = 500) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

export function normalizeLyriaStudioSettings(value: unknown): LyriaStudioSettings {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}

  return {
    title: clean(source.title, 60),
    style: clean(source.style, 120) || 'Sertanejo',
    mood: clean(source.mood, 80) || 'Sofrência',
    structure: clean(source.structure, 120) || 'Padrão',
    lineCount: clean(source.lineCount, 20) || 'média',
    songLanguage: clean(source.songLanguage, 80) || 'Português (Brasil)',
    idea: clean(source.idea, 1200),
    voiceGender: clean(source.voiceGender, 80) || 'Deixar a IA escolher',
    voiceTone: clean(source.voiceTone, 80) || 'Deixar a IA escolher',
    wantInstruments: clean(source.wantInstruments, 250),
    avoidInstruments: clean(source.avoidInstruments, 250),
    extraInstructions: clean(source.extraInstructions, 700),
    avoidCliches: source.avoidCliches !== false,
    avoidChildishRhymes: source.avoidChildishRhymes !== false,
    avoidRepeatedWords: source.avoidRepeatedWords !== false,
    stickyChorus: source.stickyChorus !== false,
    popularLanguage: source.popularLanguage !== false,
    sophisticatedLanguage: source.sophisticatedLanguage === true,
  }
}

function isRootCountry(style: string) {
  return /moda de viola|sertanejo raiz|mod[aã]o|viola caipira/i.test(style)
}

export function buildLyriaCreativeDirection(settings: LyriaStudioSettings) {
  const spanish = /espa[ñn]|colombia|paraguay/i.test(settings.songLanguage)
  const voice = [settings.voiceGender, settings.voiceTone]
    .filter((item) => item !== 'Deixar a IA escolher')

  return [
    `Create one complete, original, professional studio-quality song titled "${settings.title || 'Sem título'}".`,
    `MANDATORY MUSICAL GENRE AND IDENTITY: ${settings.style}. Keep this specific genre recognizable throughout the complete song.`,
    isRootCountry(settings.style)
      ? 'This is traditional Brazilian caipira / sertanejo raiz / moda de viola, never modern universitário, agronejo, electronic pop, or arrocha. Use traditional storytelling, authentic countryside identity and viola caipira when not forbidden.'
      : 'Use an original arrangement faithful to the selected genre; avoid a generic interchangeable pop backing track.',
    `EMOTIONAL MOOD: ${settings.mood}.`,
    `VOCAL LANGUAGE: ${settings.songLanguage}. Sing with natural native pronunciation${spanish ? ' and the selected country’s cultural identity' : ' and authentic Brazilian Portuguese phrasing'}.`,
    voice.length ? `MANDATORY VOCAL DIRECTION: ${voice.join(', ')}.` : 'Choose an expressive lead voice appropriate to the song and genre.',
    settings.idea ? `SONG STORY AND MEANING: ${settings.idea}.` : '',
    settings.structure !== 'Padrão' ? `Requested song structure: ${settings.structure}.` : '',
    settings.wantInstruments ? `FEATURE THESE REQUESTED INSTRUMENTS PROMINENTLY: ${settings.wantInstruments}.` : '',
    settings.avoidInstruments ? `FORBIDDEN INSTRUMENTS: ${settings.avoidInstruments}. Do not use these sounds anywhere in the song.` : '',
    settings.extraInstructions ? `ADDITIONAL MANDATORY ARTISTIC DIRECTION: ${settings.extraInstructions}.` : '',
    'Deliver a polished full arrangement, expressive musical dynamics, clear lead vocals, coherent intro and ending, and a professional radio-ready mix.',
  ].filter(Boolean).join('\n')
}

export function buildLyriaLyricPrompt(settings: LyriaStudioSettings, duration: number) {
  const guidelines = [
    settings.avoidCliches && 'evitar clichês baratos',
    settings.avoidChildishRhymes && 'evitar rimas infantis ou forçadas',
    settings.avoidRepeatedWords && 'evitar repetição excessiva de palavras',
    settings.stickyChorus && 'criar um refrão memorável e forte, sem ficar infantil',
    settings.popularLanguage && 'usar linguagem popular, natural e emocional',
    settings.sophisticatedLanguage && 'usar linguagem sofisticada, madura e poética',
  ].filter(Boolean).join('; ')

  return [
    'Você é compositor profissional. Crie uma letra original completa, cantável, emocional e pronta para gravação.',
    `Nome da música: ${settings.title}.`,
    `Gênero musical obrigatório: ${settings.style}.`,
    `Clima: ${settings.mood}.`,
    `Idioma obrigatório: ${settings.songLanguage}. Respeite o sotaque e a cultura musical do país.`,
    `História e tema informados pelo compositor: ${settings.idea}.`,
    `Estrutura desejada: ${settings.structure}. Tamanho da letra: ${settings.lineCount}.`,
    `Duração prevista da música: ${duration} segundos. A letra precisa caber naturalmente nesse tempo.`,
    guidelines ? `Diretrizes: ${guidelines}.` : '',
    isRootCountry(settings.style) ? 'Trate como moda de viola e sertanejo raiz tradicional, com linguagem caipira madura; não use sertanejo universitário ou pop moderno.' : '',
    settings.extraInstructions ? `Orientações extras: ${settings.extraInstructions}.` : '',
    'Organize por seções como [Verso 1], [Pré-Refrão], [Refrão], [Verso 2] e [Final].',
    'Escreva linhas curtas ou médias, com respiração natural e sem atropelar sílabas. Não repita a música inteira.',
    'Nunca escreva título, nome da música, nome do artista, gênero, explicações, Markdown, asteriscos ou qualquer cabeçalho fora das seções da letra.',
    'Comece diretamente com uma seção como [Verso 1] e responda exclusivamente com as frases que devem ser cantadas.',
  ].filter(Boolean).join('\n')
}
