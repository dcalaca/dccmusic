// ============================================
// Sistema de Geolocalização por IP
// ============================================
// Faz lookup de geolocalização com cache para reduzir custos
// Suporta múltiplos provedores (ipapi.co, ip-api.com, etc.)

export interface GeoLocation {
  country?: string
  region?: string
  city?: string
  asn?: string
  isp?: string
  latitude?: number
  longitude?: number
}

// Cache em memória (em produção, considere usar Redis ou similar)
const geoCache = new Map<string, { data: GeoLocation; expiresAt: number }>()

// Configuração
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 horas
const GEO_API_ENABLED = process.env.GEO_API_ENABLED !== 'false' // Por padrão habilitado
const GEO_API_PROVIDER = process.env.GEO_API_PROVIDER || 'ipapi' // ipapi, ipapi-com, ipinfo

/**
 * Mascara IP para privacidade (ex: 192.168.1.100 -> 192.168.1.0/24)
 */
export function maskIP(ip: string, maskBits: number = 24): string {
  try {
    // Para IPv4
    if (ip.includes('.')) {
      const parts = ip.split('.')
      if (maskBits >= 24) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
      } else if (maskBits >= 16) {
        return `${parts[0]}.${parts[1]}.0.0/16`
      } else if (maskBits >= 8) {
        return `${parts[0]}.0.0.0/8`
      }
    }
    // Para IPv6 (simplificado)
    if (ip.includes(':')) {
      const parts = ip.split(':')
      return `${parts[0]}:${parts[1]}::/32`
    }
  } catch {
    // Se falhar, retornar IP original
  }
  return ip
}

/**
 * Verifica se IP é localhost/privado (não deve ser geolocalizado)
 */
function isPrivateIP(ip: string): boolean {
  if (!ip || ip === 'unknown') return true
  
  // IPv4 privado
  if (ip.startsWith('127.') || ip.startsWith('192.168.') || 
      ip.startsWith('10.') || ip.startsWith('172.16.')) {
    return true
  }
  
  // IPv6 localhost
  if (ip === '::1' || ip.startsWith('fe80:')) {
    return true
  }
  
  return false
}

/**
 * Busca geolocalização usando ipapi.co (gratuito, 1000 req/dia)
 */
async function fetchFromIpapi(ip: string): Promise<GeoLocation | null> {
  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: {
        'User-Agent': 'DCCMusic-LinkTracker/1.0',
      },
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    
    if (data.error) {
      return null
    }
    
    return {
      country: data.country_name || data.country_code,
      region: data.region || data.region_code,
      city: data.city,
      asn: data.asn,
      isp: data.org,
      latitude: data.latitude,
      longitude: data.longitude,
    }
  } catch (error) {
    console.error('Erro ao buscar geolocalização (ipapi.co):', error)
    return null
  }
}

/**
 * Busca geolocalização usando ip-api.com (gratuito, 45 req/min)
 */
async function fetchFromIpApiCom(ip: string): Promise<GeoLocation | null> {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,as,isp,lat,lon`, {
      headers: {
        'User-Agent': 'DCCMusic-LinkTracker/1.0',
      },
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    
    if (data.status === 'fail') {
      return null
    }
    
    return {
      country: data.country,
      region: data.regionName,
      city: data.city,
      asn: data.as,
      isp: data.isp,
      latitude: data.lat,
      longitude: data.lon,
    }
  } catch (error) {
    console.error('Erro ao buscar geolocalização (ip-api.com):', error)
    return null
  }
}

/**
 * Busca geolocalização de um IP
 * Usa cache para evitar múltiplas requisições do mesmo IP
 */
export async function getGeoLocation(ip: string): Promise<GeoLocation | null> {
  // Se geolocalização está desabilitada, retornar null
  if (!GEO_API_ENABLED) {
    return null
  }
  
  // Validar IP
  if (!ip || ip === 'unknown' || isPrivateIP(ip)) {
    return null
  }
  
  // Verificar cache
  const cached = geoCache.get(ip)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }
  
  // Buscar geolocalização
  let geo: GeoLocation | null = null
  
  try {
    switch (GEO_API_PROVIDER) {
      case 'ipapi':
        geo = await fetchFromIpapi(ip)
        break
      case 'ipapi-com':
        geo = await fetchFromIpApiCom(ip)
        break
      default:
        geo = await fetchFromIpapi(ip)
    }
    
    // Armazenar no cache
    if (geo) {
      geoCache.set(ip, {
        data: geo,
        expiresAt: Date.now() + CACHE_TTL_MS,
      })
    }
  } catch (error) {
    console.error('Erro ao buscar geolocalização:', error)
  }
  
  return geo
}

/**
 * Limpa cache expirado (chamar periodicamente)
 */
export function cleanExpiredCache(): void {
  const now = Date.now()
  for (const [ip, cached] of geoCache.entries()) {
    if (cached.expiresAt <= now) {
      geoCache.delete(ip)
    }
  }
}

/**
 * Limpa todo o cache (útil para testes)
 */
export function clearCache(): void {
  geoCache.clear()
}
