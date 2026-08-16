/**
 * Redirecionamentos permanentes de slugs antigos para a URL canônica atual.
 * Use quando um artigo for unificado, renomeado ou removido em favor de outro.
 */
export const blogRedirects: Record<string, string> = {
  // 'slug-antigo': 'slug-novo',
}

export function getBlogRedirect(slug: string) {
  return blogRedirects[slug]
}
