import { redirect } from 'next/navigation'

function safeInternalPath(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return ''
  return raw
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { return?: string; redirect?: string }
}) {
  const next = safeInternalPath(searchParams?.redirect) || safeInternalPath(searchParams?.return)
  redirect(next ? `/compositores/login?redirect=${encodeURIComponent(next)}` : '/compositores/login')
}
