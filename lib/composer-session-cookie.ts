const COOKIE_NAME = 'dcc_composer_ui'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export type ComposerSessionPreview = {
  id?: string
  name?: string
  email?: string
  isPremium?: boolean
}

function cookieDomainSuffix() {
  if (typeof window === 'undefined') return ''
  const host = window.location.hostname
  if (host === 'dccmusic.online' || host.endsWith('.dccmusic.online')) {
    return '; Domain=.dccmusic.online'
  }
  return ''
}

function cookieSecurity() {
  if (typeof window === 'undefined') return ''
  return window.location.protocol === 'https:' ? '; Secure' : ''
}

export function writeComposerSessionCookie(composer: Record<string, unknown> | null | undefined) {
  if (typeof document === 'undefined' || !composer) return

  const preview: ComposerSessionPreview = {
    id: typeof composer.id === 'string' ? composer.id : undefined,
    name: typeof composer.name === 'string' ? composer.name : undefined,
    email: typeof composer.email === 'string' ? composer.email : undefined,
    isPremium: Boolean(composer.isPremium),
  }

  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(preview))}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${cookieDomainSuffix()}${cookieSecurity()}`
}

export function readComposerSessionCookie(): ComposerSessionPreview | null {
  if (typeof document === 'undefined') return null

  const prefix = `${COOKIE_NAME}=`
  const raw = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length)

  if (!raw) return null

  try {
    const parsed = JSON.parse(decodeURIComponent(raw))
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as ComposerSessionPreview
  } catch {
    return null
  }
}

export function clearComposerSessionCookie() {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${cookieDomainSuffix()}${cookieSecurity()}`
}

export function isComposerBlogSubdomain() {
  if (typeof window === 'undefined') return false
  return window.location.hostname.startsWith('blog.')
}
