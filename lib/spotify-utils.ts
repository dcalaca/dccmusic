/**
 * Utilitários para trabalhar com URLs e imagens do Spotify
 */

/**
 * Extrai o ID da track do Spotify de uma URL
 * Exemplo: https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC
 * Retorna: 4uLU6hMCjMI75M1A2tKUQC
 */
export function extractSpotifyTrackId(spotifyUrl: string | null | undefined): string | null {
  if (!spotifyUrl) return null
  
  // Padrões de URL do Spotify
  const patterns = [
    /spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?track\/([a-zA-Z0-9]+)/i,
    /spotify:track:([a-zA-Z0-9]+)/i,
  ]
  
  for (const pattern of patterns) {
    const match = spotifyUrl.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  
  return null
}

export function isSpotifyUrl(url: string | null | undefined): boolean {
  if (!url) return false

  const trimmed = url.trim()

  if (/^spotify:/i.test(trimmed)) {
    return true
  }

  try {
    const parsedUrl = new URL(trimmed)
    const host = parsedUrl.hostname.toLowerCase()

    return (
      host === 'spotify.com' ||
      host.endsWith('.spotify.com') ||
      host === 'spotify.link' ||
      host.endsWith('.spotify.link') ||
      host === 'spoti.fi'
    )
  } catch {
    return /spotify\.com|spotify\.link|spoti\.fi/i.test(trimmed)
  }
}

export function isSoundCloudUrl(url: string | null | undefined): boolean {
  if (!url) return false

  const trimmed = url.trim()

  try {
    const parsedUrl = new URL(trimmed)
    const host = parsedUrl.hostname.toLowerCase()

    return host === 'soundcloud.com' || host.endsWith('.soundcloud.com')
  } catch {
    return /soundcloud\.com/i.test(trimmed)
  }
}

export function canFetchMusicImage(url: string | null | undefined): boolean {
  return isSpotifyUrl(url) || isSoundCloudUrl(url)
}

/**
 * Gera a URL da imagem da capa do Spotify usando o ID da track
 * O Spotify fornece imagens em diferentes tamanhos através do oEmbed
 * Mas podemos usar uma URL direta também
 */
export function getSpotifyImageUrl(spotifyUrl: string | null | undefined): string | null {
  if (!isSpotifyUrl(spotifyUrl)) return null
  
  // Usar o oEmbed do Spotify para buscar a imagem
  // Formato: https://open.spotify.com/oembed?url=SPOTIFY_URL
  // Isso retorna JSON com a imagem, mas requer uma chamada HTTP
  
  // Alternativa: usar uma URL direta conhecida (mas pode não funcionar sempre)
  // Por enquanto, vamos usar o oEmbed via API route
  
  return `/api/spotify/image?url=${encodeURIComponent(spotifyUrl || '')}`
}

/**
 * Busca a imagem do Spotify usando o oEmbed
 */
export async function fetchSpotifyImage(spotifyUrl: string | null | undefined): Promise<string | null> {
  if (!spotifyUrl) return null
  
  try {
    if (!isSpotifyUrl(spotifyUrl)) return null
    
    // Usar o oEmbed do Spotify
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`
    const response = await fetch(oembedUrl)
    
    if (!response.ok) return null
    
    const data = await response.json()
    
    // O oEmbed retorna a imagem no campo 'thumbnail_url'
    return data.thumbnail_url || null
  } catch (error) {
    console.error('Erro ao buscar imagem do Spotify:', error)
    return null
  }
}
