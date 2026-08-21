import { createHmac, timingSafeEqual } from 'node:crypto'

export function getVeoLabApiKey() {
  return process.env.GEMINI_API_KEY
    || process.env.GOOGLE_AI_API_KEY
    || process.env.GOOGLE_API_KEY
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    || process.env.GOOGLE_CLOUD_API_KEY
    || ''
}

function mediaSecret() {
  return process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || ''
}

export function signVeoLabMediaUri(uri: string) {
  const secret = mediaSecret()
  if (!secret) return ''
  return createHmac('sha256', secret).update(uri).digest('hex')
}

export function verifyVeoLabMediaUri(uri: string, signature: string) {
  const expected = signVeoLabMediaUri(uri)
  if (!expected || !signature || expected.length !== signature.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
