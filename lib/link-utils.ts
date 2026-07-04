/**
 * Função auxiliar para obter a URL base do site
 * Prioriza variáveis de ambiente e depois usa a URL de produção conhecida
 */
export function getBaseUrl(): string {
  // Em produção, usar variáveis de ambiente
  if (typeof window === 'undefined') {
    // Server-side
    return process.env.NEXT_PUBLIC_BASE_URL || 
           process.env.NEXTAUTH_URL || 
           'https://www.dccmusic.online'
  } else {
    // Client-side - usar a URL atual, mas preferir domínio oficial
    const origin = window.location.origin
    // Se estiver em preview do Vercel, usar domínio oficial
    if (origin.includes('vercel.app')) {
      return 'https://www.dccmusic.online'
    }
    return origin
  }
}

/**
 * Gera a URL completa de um link rastreável
 */
export function getTrackedLinkUrl(shortCode: string): string {
  const baseUrl = getBaseUrl()
  return `${baseUrl}/l/${shortCode}`
}
