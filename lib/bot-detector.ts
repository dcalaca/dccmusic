// ============================================
// Sistema de Detecção de Bots e Pré-visualizações
// ============================================
// Classifica cliques em: BOT_PREVIEW, HUMAN_CLICK, UNKNOWN
// Baseado em User-Agent, comportamento e headers HTTP

export type ClickType = 'BOT_PREVIEW' | 'HUMAN_CLICK' | 'UNKNOWN'

export interface ClickClassification {
  type: ClickType
  reason: string
  confidence: 'high' | 'medium' | 'low'
  inferredSource?: string
}

// Lista de padrões de User-Agent que indicam bots/preview
// Fácil de atualizar conforme novos bots aparecem
const BOT_PATTERNS = [
  // Facebook/Meta
  'facebookexternalhit',
  'facebot',
  'facebookcatalog',
  'facebookplatform',
  
  // Twitter/X
  'twitterbot',
  'twitter',
  
  // WhatsApp (cuidado: pode ser WebView humano também)
  // Verificaremos contexto adicional
  
  // Telegram
  'telegrambot',
  'telegram',
  
  // Outros bots conhecidos
  'slackbot',
  'discordbot',
  'linkedinbot',
  'googlebot',
  'bingbot',
  'yandexbot',
  'baiduspider',
  'duckduckbot',
  'applebot',
  'crawler',
  'spider',
  'bot',
  'preview',
  'scraper',
  'fetcher',
  'crawling',
  'headless',
  'phantom',
  'selenium',
  'webdriver',
  'puppeteer',
  'playwright',
]

// Padrões que indicam navegadores reais (humanos)
const HUMAN_BROWSER_PATTERNS = [
  'mozilla/5.0',
  'chrome/',
  'safari/',
  'firefox/',
  'edg/',
  'opera/',
  'opr/',
]

// Padrões de origem conhecidos
const SOURCE_PATTERNS: Array<{ pattern: RegExp; source: string }> = [
  { pattern: /whatsapp/i, source: 'WhatsApp' },
  { pattern: /instagram/i, source: 'Instagram' },
  { pattern: /facebook/i, source: 'Facebook' },
  { pattern: /telegram/i, source: 'Telegram' },
  { pattern: /twitter/i, source: 'Twitter/X' },
  { pattern: /linkedin/i, source: 'LinkedIn' },
  { pattern: /slack/i, source: 'Slack' },
  { pattern: /discord/i, source: 'Discord' },
  { pattern: /messenger/i, source: 'Messenger' },
]

/**
 * Detecta origem provável baseada em User-Agent e referrer
 */
export function inferSource(userAgent?: string | null, referer?: string | null): string | undefined {
  // Primeiro tentar pelo referrer
  if (referer) {
    try {
      const url = new URL(referer)
      const hostname = url.hostname.toLowerCase()
      
      if (hostname.includes('whatsapp')) return 'WhatsApp'
      if (hostname.includes('facebook') || hostname.includes('fb.com')) return 'Facebook'
      if (hostname.includes('instagram')) return 'Instagram'
      if (hostname.includes('twitter') || hostname.includes('x.com')) return 'Twitter/X'
      if (hostname.includes('linkedin')) return 'LinkedIn'
      if (hostname.includes('telegram')) return 'Telegram'
      if (hostname.includes('slack')) return 'Slack'
      if (hostname.includes('discord')) return 'Discord'
    } catch {
      // URL inválida, continuar
    }
  }
  
  // Depois tentar pelo User-Agent
  if (userAgent) {
    const ua = userAgent.toLowerCase()
    
    for (const { pattern, source } of SOURCE_PATTERNS) {
      if (pattern.test(ua)) {
        return source
      }
    }
  }
  
  return undefined
}

/**
 * Verifica se o User-Agent contém padrões de bot conhecidos
 */
function isBotPattern(userAgent: string): boolean {
  const ua = userAgent.toLowerCase()
  
  for (const pattern of BOT_PATTERNS) {
    if (ua.includes(pattern.toLowerCase())) {
      return true
    }
  }
  
  return false
}

/**
 * Verifica se o User-Agent parece ser de um navegador real
 */
function isHumanBrowser(userAgent: string): boolean {
  const ua = userAgent.toLowerCase()
  
  // Deve conter pelo menos um padrão de navegador real
  const hasBrowserPattern = HUMAN_BROWSER_PATTERNS.some(pattern => 
    ua.includes(pattern.toLowerCase())
  )
  
  if (!hasBrowserPattern) {
    return false
  }
  
  // Não deve conter padrões de bot (exceto se for claramente um navegador)
  if (isBotPattern(userAgent)) {
    // Exceção: alguns bots podem fingir ser navegadores, mas geralmente
    // não têm todos os sinais de navegador real
    return false
  }
  
  return true
}

/**
 * Analisa headers HTTP para sinais de navegação humana
 */
function analyzeHeaders(headers: {
  accept?: string | null
  acceptLanguage?: string | null
  acceptEncoding?: string | null
  referer?: string | null
}): { isHuman: boolean; signals: string[] } {
  const signals: string[] = []
  let humanScore = 0
  
  // Accept header deve incluir text/html para navegação normal
  if (headers.accept) {
    const accept = headers.accept.toLowerCase()
    if (accept.includes('text/html')) {
      humanScore++
      signals.push('Accept: text/html')
    } else if (accept.includes('*/*')) {
      // Alguns bots usam */*, mas não é tão comum em navegadores reais
      signals.push('Accept: */* (suspeito)')
    }
  }
  
  // Accept-Language geralmente presente em navegadores reais
  if (headers.acceptLanguage) {
    humanScore++
    signals.push('Accept-Language presente')
  }
  
  // Accept-Encoding geralmente presente
  if (headers.acceptEncoding) {
    humanScore++
    signals.push('Accept-Encoding presente')
  }
  
  // Referer pode indicar navegação humana (mas não é obrigatório)
  if (headers.referer) {
    signals.push('Referer presente')
  }
  
  return {
    isHuman: humanScore >= 2, // Pelo menos 2 sinais positivos
    signals,
  }
}

/**
 * Classifica um clique baseado em User-Agent, headers e contexto
 */
export function classifyClick(data: {
  userAgent?: string | null
  referer?: string | null
  accept?: string | null
  acceptLanguage?: string | null
  acceptEncoding?: string | null
  ipAddress?: string | null
}): ClickClassification {
  const { userAgent, referer, accept, acceptLanguage, acceptEncoding } = data
  
  // Caso 1: Sem User-Agent = UNKNOWN
  if (!userAgent || userAgent.trim() === '') {
    return {
      type: 'UNKNOWN',
      reason: 'User-Agent ausente',
      confidence: 'high',
      inferredSource: inferSource(userAgent, referer),
    }
  }
  
  const ua = userAgent.toLowerCase()
  
  // Caso 2: Padrões explícitos de bot/preview
  if (isBotPattern(userAgent)) {
    // Detectar qual bot específico
    let botName = 'Bot desconhecido'
    for (const pattern of BOT_PATTERNS) {
      if (ua.includes(pattern.toLowerCase())) {
        botName = pattern
        break
      }
    }
    
    return {
      type: 'BOT_PREVIEW',
      reason: `User-Agent contém padrão de bot: ${botName}`,
      confidence: 'high',
      inferredSource: inferSource(userAgent, referer),
    }
  }
  
  // Caso 3: WhatsApp - precisa análise cuidadosa
  if (ua.includes('whatsapp')) {
    const headerAnalysis = analyzeHeaders({
      accept,
      acceptLanguage,
      acceptEncoding,
      referer,
    })
    
    // Se não tem sinais de navegação humana, provavelmente é preview
    if (!headerAnalysis.isHuman && !referer) {
      return {
        type: 'BOT_PREVIEW',
        reason: 'WhatsApp sem sinais de navegação humana (provavelmente preview)',
        confidence: 'medium',
        inferredSource: 'WhatsApp',
      }
    }
    
    // Se tem sinais de navegação humana, provavelmente é WebView real
    if (headerAnalysis.isHuman) {
      return {
        type: 'HUMAN_CLICK',
        reason: 'WhatsApp com sinais de navegação humana (WebView)',
        confidence: 'high',
        inferredSource: 'WhatsApp',
      }
    }
    
    // Caso ambíguo
    return {
      type: 'UNKNOWN',
      reason: 'WhatsApp com sinais ambíguos',
      confidence: 'low',
      inferredSource: 'WhatsApp',
    }
  }
  
  // Caso 4: Navegador real detectado
  if (isHumanBrowser(userAgent)) {
    const headerAnalysis = analyzeHeaders({
      accept,
      acceptLanguage,
      acceptEncoding,
      referer,
    })
    
    if (headerAnalysis.isHuman) {
      return {
        type: 'HUMAN_CLICK',
        reason: `Navegador real detectado (${headerAnalysis.signals.join(', ')})`,
        confidence: 'high',
        inferredSource: inferSource(userAgent, referer),
      }
    }
    
    // Navegador real mas sem muitos sinais de headers
    return {
      type: 'HUMAN_CLICK',
      reason: 'Navegador real detectado (headers limitados)',
      confidence: 'medium',
      inferredSource: inferSource(userAgent, referer),
    }
  }
  
  // Caso 5: Não identificado claramente
  return {
    type: 'UNKNOWN',
    reason: 'Não foi possível determinar com certeza (padrão não reconhecido)',
    confidence: 'low',
    inferredSource: inferSource(userAgent, referer),
  }
}

/**
 * Verifica se dois cliques podem estar relacionados (preview seguido de clique humano)
 * Usado para detectar sequências típicas de WhatsApp/Facebook
 */
export function areRelated(
  click1: { ipAddress?: string | null; clickedAt: Date; type: ClickType },
  click2: { ipAddress?: string | null; clickedAt: Date; type: ClickType },
  timeWindowMinutes: number = 10
): boolean {
  // Devem ter o mesmo IP
  if (click1.ipAddress !== click2.ipAddress || !click1.ipAddress) {
    return false
  }
  
  // Devem estar dentro da janela de tempo
  const timeDiff = Math.abs(click1.clickedAt.getTime() - click2.clickedAt.getTime())
  const timeWindowMs = timeWindowMinutes * 60 * 1000
  
  if (timeDiff > timeWindowMs) {
    return false
  }
  
  // Um deve ser BOT_PREVIEW e o outro HUMAN_CLICK
  const isPreviewFirst = click1.type === 'BOT_PREVIEW' && click2.type === 'HUMAN_CLICK'
  const isHumanFirst = click1.type === 'HUMAN_CLICK' && click2.type === 'BOT_PREVIEW'
  
  return isPreviewFirst || isHumanFirst
}
