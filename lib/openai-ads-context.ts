/** Server-side checkout context, kept separate from other advertising platforms. */
export function openAIAdsCheckoutContext(request: Request) {
  try {
    const cookie = request.headers.get('cookie') || ''
    const rawCookie = (name: string) => cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))?.[1]
    const canonical = new URL(process.env.NEXTAUTH_URL || 'https://www.dccmusic.online')
    let sourceUrl = canonical.origin + '/compositores/admin/studio-ia'
    const referer = request.headers.get('referer')
    if (referer) {
      const url = new URL(referer)
      if (['http:', 'https:'].includes(url.protocol) &&
          [canonical.origin, new URL(request.url).origin].includes(url.origin)) sourceUrl = url.origin + url.pathname
    }
    return {
      // Attribution references are opaque: never decode, transform, or log them.
      oppref: rawCookie('__oppref'),
      obref: rawCookie('__obref'),
      source_url: sourceUrl,
      user_agent: request.headers.get('user-agent') || undefined,
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
    }
  } catch {
    return {}
  }
}
