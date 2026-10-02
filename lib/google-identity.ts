import { createPublicKey, verify } from 'crypto'

export interface GoogleIdentity {
  sub: string
  email: string
  email_verified: boolean
  name?: string
  hd?: string
  nonce: string
}

let keys: { expires: number; values: any[] } | undefined

export function googleCanVerifyEmail(identity: Pick<GoogleIdentity, 'email' | 'email_verified' | 'hd'>) {
  return identity.email_verified === true && (identity.email.toLowerCase().endsWith('@gmail.com') || !!identity.hd)
}

export async function verifyGoogleIdentity(credential: string, clientId: string, nonce: string): Promise<GoogleIdentity> {
  if (credential.length > 16384) throw new Error('invalid')
  const parts = credential.split('.')
  if (parts.length !== 3) throw new Error('invalid')
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('invalid')
  if (!keys || keys.expires < Date.now()) {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', { cache: 'no-store', signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error('invalid')
    const body = await response.json()
    if (!Array.isArray(body.keys)) throw new Error('invalid')
    keys = { expires: Date.now() + 3600000, values: body.keys }
  }
  const jwk = keys.values.find(key => key.kid === header.kid && key.kty === 'RSA')
  if (!jwk || !verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) throw new Error('invalid')
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  const now = Math.floor(Date.now() / 1000)
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(payload.iss) || payload.aud !== clientId || (payload.azp && payload.azp !== clientId) || typeof payload.exp !== 'number' || payload.exp <= now || typeof payload.iat !== 'number' || payload.iat > now + 60 || payload.nonce !== nonce || typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string' || payload.email_verified !== true) throw new Error('invalid')
  return payload
}
