// Parser simples de User Agent (sem dependências externas)
// Extrai informações básicas do navegador, sistema operacional e dispositivo

export interface ParsedUserAgent {
  browser: string
  browserVersion: string
  os: string
  osVersion: string
  device: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
  deviceType: string
}

export function parseUserAgent(userAgent?: string | null): ParsedUserAgent | null {
  if (!userAgent) return null

  const ua = userAgent.toLowerCase()
  
  // Detectar bots primeiro
  if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
    return {
      browser: 'Bot',
      browserVersion: '',
      os: 'Unknown',
      osVersion: '',
      device: 'bot',
      deviceType: 'Bot',
    }
  }

  // Detectar dispositivo
  let device: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown' = 'unknown'
  let deviceType = 'Unknown'

  if (ua.includes('mobile') || ua.includes('android') && !ua.includes('tablet')) {
    device = 'mobile'
    deviceType = 'Mobile'
  } else if (ua.includes('tablet') || ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'))) {
    device = 'tablet'
    deviceType = 'Tablet'
  } else {
    device = 'desktop'
    deviceType = 'Desktop'
  }

  // Detectar navegador
  let browser = 'Unknown'
  let browserVersion = ''

  if (ua.includes('edg/')) {
    browser = 'Edge'
    const match = ua.match(/edg\/([\d.]+)/)
    browserVersion = match ? match[1] : ''
  } else if (ua.includes('chrome/') && !ua.includes('edg')) {
    browser = 'Chrome'
    const match = ua.match(/chrome\/([\d.]+)/)
    browserVersion = match ? match[1] : ''
  } else if (ua.includes('firefox/')) {
    browser = 'Firefox'
    const match = ua.match(/firefox\/([\d.]+)/)
    browserVersion = match ? match[1] : ''
  } else if (ua.includes('safari/') && !ua.includes('chrome')) {
    browser = 'Safari'
    const match = ua.match(/version\/([\d.]+).*safari/)
    browserVersion = match ? match[1] : ''
  } else if (ua.includes('opera/') || ua.includes('opr/')) {
    browser = 'Opera'
    const match = ua.match(/(?:opera|opr)\/([\d.]+)/)
    browserVersion = match ? match[1] : ''
  }

  // Detectar sistema operacional
  let os = 'Unknown'
  let osVersion = ''

  if (ua.includes('windows')) {
    os = 'Windows'
    if (ua.includes('windows nt 10')) osVersion = '10/11'
    else if (ua.includes('windows nt 6.3')) osVersion = '8.1'
    else if (ua.includes('windows nt 6.2')) osVersion = '8'
    else if (ua.includes('windows nt 6.1')) osVersion = '7'
  } else if (ua.includes('mac os x') || ua.includes('macintosh')) {
    os = 'macOS'
    const match = ua.match(/mac os x ([\d_]+)/)
    if (match) {
      osVersion = match[1].replace(/_/g, '.')
    }
  } else if (ua.includes('android')) {
    os = 'Android'
    const match = ua.match(/android ([\d.]+)/)
    osVersion = match ? match[1] : ''
  } else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    os = 'iOS'
    const match = ua.match(/os ([\d_]+)/)
    if (match) {
      osVersion = match[1].replace(/_/g, '.')
    }
  } else if (ua.includes('linux')) {
    os = 'Linux'
  }

  return {
    browser,
    browserVersion,
    os,
    osVersion,
    device,
    deviceType,
  }
}

export function formatUserAgentInfo(parsed: ParsedUserAgent | null): string {
  if (!parsed) return 'N/A'
  
  const parts: string[] = []
  
  if (parsed.browser !== 'Unknown') {
    parts.push(`${parsed.browser}${parsed.browserVersion ? ` ${parsed.browserVersion}` : ''}`)
  }
  
  if (parsed.os !== 'Unknown') {
    parts.push(`${parsed.os}${parsed.osVersion ? ` ${parsed.osVersion}` : ''}`)
  }
  
  if (parsed.deviceType !== 'Unknown') {
    parts.push(parsed.deviceType)
  }
  
  return parts.length > 0 ? parts.join(' • ') : 'N/A'
}
