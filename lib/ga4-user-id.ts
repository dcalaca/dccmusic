const GA4_ID = 'G-CNBQFWQ9QT'

export function validGa4UserId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/** Scope identity to Analytics only; never change global gtag, Ads, Meta or OpenAI identity. */
export function syncGa4UserId() {
  if (typeof window === 'undefined') return
  const w = window as any
  if (typeof w.gtag !== 'function') return
  let userId: string | null = null
  try {
    const composer = JSON.parse(window.localStorage.getItem('composer_data') || 'null')
    if (window.localStorage.getItem('composer_token') && validGa4UserId(composer?.id)) userId = composer.id
  } catch { /* Missing or inaccessible auth data means anonymous. */ }
  if (w.__dccGa4UserId === userId) return
  w.gtag('config', GA4_ID, { user_id: userId, send_page_view: false })
  w.__dccGa4UserId = userId
}
