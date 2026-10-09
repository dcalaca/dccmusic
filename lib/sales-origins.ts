export function salesOrigin(source: unknown, clickIds?: Record<string, unknown> | null): string {
  const value = String(source || '').trim().toLowerCase()
  if (!value && clickIds) {
    if (clickIds.gclid || clickIds.gbraid || clickIds.wbraid) return 'Google'
    if (clickIds.msclkid) return 'Bing'
    if (clickIds.fbclid) return 'Meta'
    if (clickIds.ttclid) return 'TikTok'
  }
  if (!value) return 'Não identificada'
  if (['direct', '(direct)'].includes(value)) return 'Acesso direto'
  if (['ig', 'instagram', 'instagram.com', 'l.instagram.com'].includes(value)) return 'Instagram'
  if (['meta', 'fb', 'facebook', 'facebook.com', 'm.facebook.com', 'l.facebook.com', 'lm.facebook.com'].includes(value)) return 'Meta / Facebook'
  if (['google', 'google.com', 'www.google.com', 'google.com.br', 'www.google.com.br', 'com.google.android.googlequicksearchbox'].includes(value)) return 'Google'
  if (['bing', 'bing.com', 'www.bing.com', 'microsoft'].includes(value)) return 'Bing'
  if (['email', 'e-mail', 'gmail', 'com.google.android.gm', 'mail.google.com'].includes(value)) return 'E-mail'
  if (['openai', 'chatgpt', 'chatgpt.com', 'chat.openai.com'].includes(value)) return 'ChatGPT / OpenAI'
  if (['tiktok', 'tiktok.com', 'www.tiktok.com'].includes(value)) return 'TikTok'
  if (value === 'affiliate') return 'Parceiros / Afiliados'
  if (value === 'blog') return 'Blog'
  return value
}

export type OriginSale = {
  id: string; buyer: string; email: string; paidAt: string; product: string
  origin: string; rawSource: string; medium: string; campaign: string
  amount: number; currency: string
}

export function summarizeOrigins(rows: OriginSale[]) {
  const groups = new Map<string, { origin: string; count: number; amounts: Record<string, number> }>()
  for (const row of rows) {
    const group = groups.get(row.origin) || { origin: row.origin, count: 0, amounts: {} }
    group.count++
    group.amounts[row.currency] = (group.amounts[row.currency] || 0) + row.amount
    groups.set(row.origin, group)
  }
  return Array.from(groups.values()).sort((a, b) => b.count - a.count)
}
