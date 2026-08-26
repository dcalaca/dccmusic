import { Buffer } from 'node:buffer'
import { supabaseAdmin } from './supabase'

const STUDIO_COVER_BUCKET = 'studio-assets'
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 // 24h
const SIGN_RETRY_DELAYS_MS = [0, 150, 500]

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function isSupabaseSignedUrl(url: string) {
  return url.includes('/storage/v1/object/sign/')
}

function isExpiredSupabaseSignedUrl(url: string) {
  try {
    if (!isSupabaseSignedUrl(url)) return false
    const token = new URL(url).searchParams.get('token')
    if (!token) return false
    const payload = decodeJwtPayload(token)
    const exp = Number(payload?.exp)
    if (!Number.isFinite(exp)) return false
    return Date.now() / 1000 >= exp - 60
  } catch {
    return false
  }
}

function isTransientStorageError(error: any) {
  const message = String(error?.message || error || '').toLowerCase()
  return (
    message.includes('too many connections') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('temporarily unavailable')
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Recupera o path do arquivo a partir de uma signed URL antiga do Supabase. */
function extractPathFromSignedUrl(url: string): string | null {
  try {
    if (!isSupabaseSignedUrl(url)) return null

    const token = new URL(url).searchParams.get('token')
    if (token) {
      const payload = decodeJwtPayload(token)
      const signedPath = String(payload?.url || '')
      if (signedPath.startsWith(`${STUDIO_COVER_BUCKET}/`)) {
        return signedPath.slice(STUDIO_COVER_BUCKET.length + 1)
      }
      if (signedPath) return signedPath
    }

    const marker = `/object/sign/${STUDIO_COVER_BUCKET}/`
    const index = url.indexOf(marker)
    if (index >= 0) {
      const pathWithQuery = url.slice(index + marker.length)
      return decodeURIComponent(pathWithQuery.split('?')[0] || '') || null
    }

    return null
  } catch {
    return null
  }
}

async function createStudioCoverSignedUrl(path: string) {
  let lastError: any = null

  for (const delay of SIGN_RETRY_DELAYS_MS) {
    if (delay) await sleep(delay)

    const { data, error } = await supabaseAdmin.storage
      .from(STUDIO_COVER_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

    if (!error && data?.signedUrl) return data.signedUrl
    lastError = error || new Error('URL assinada vazia')
    if (!isTransientStorageError(lastError)) break
  }

  console.warn('[studio-cover-url] falha ao assinar capa após retry:', lastError?.message || lastError, path)
  return null
}

export async function getStudioCoverImageUrl(cover: any) {
  if (!cover) return null

  const pathFromColumn = typeof cover.image_path === 'string' ? cover.image_path.trim() : ''
  if (pathFromColumn) {
    const signed = await createStudioCoverSignedUrl(pathFromColumn)
    if (signed) return signed
  }

  const fallbackUrl = typeof cover.image_url === 'string' ? cover.image_url.trim() : ''
  if (!fallbackUrl) return null

  // Signed URL antiga no banco: tenta recriar a partir do path embutido no token.
  if (isSupabaseSignedUrl(fallbackUrl)) {
    const pathFromUrl = extractPathFromSignedUrl(fallbackUrl)
    if (pathFromUrl) {
      const resigned = await createStudioCoverSignedUrl(pathFromUrl)
      if (resigned) return resigned
    }
    if (isExpiredSupabaseSignedUrl(fallbackUrl)) return null
  }

  return fallbackUrl
}