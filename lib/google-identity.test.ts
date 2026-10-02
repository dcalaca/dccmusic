import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateKeyPairSync, sign } from 'crypto'
import { googleCanVerifyEmail, verifyGoogleIdentity } from './google-identity'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const clientId = 'test.apps.googleusercontent.com'
function token(overrides: Record<string, unknown> = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: clientId, sub: '123', email: 'test@gmail.com', email_verified: true, nonce: 'challenge', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, ...overrides })).toString('base64url')
  return `${header}.${payload}.${sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url')}`
}
afterEach(() => vi.unstubAllGlobals())
describe('Google identity verification', () => {
  it('validates the signed identity and rejects forged claims', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'test' }] }) }))
    await expect(verifyGoogleIdentity(token(), clientId, 'challenge')).resolves.toMatchObject({ sub: '123' })
    for (const overrides of [{ aud: 'other-client' }, { nonce: 'other-browser' }, { exp: 1 }, { iss: 'https://attacker.example' }, { email_verified: false }, { azp: 'other-client' }]) {
      await expect(verifyGoogleIdentity(token(overrides), clientId, 'challenge')).rejects.toThrow()
    }
    const forged = token().split('.')
    forged[1] = Buffer.from(JSON.stringify({ email: 'victim@gmail.com' })).toString('base64url')
    await expect(verifyGoogleIdentity(forged.join('.'), clientId, 'challenge')).rejects.toThrow()
  })
  it('does not trust third-party email ownership for automatic linking', () => {
    expect(googleCanVerifyEmail({ email: 'user@gmail.com', email_verified: true })).toBe(true)
    expect(googleCanVerifyEmail({ email: 'user@company.com', email_verified: true, hd: 'company.com' })).toBe(true)
    expect(googleCanVerifyEmail({ email: 'user@outlook.com', email_verified: true })).toBe(false)
    expect(googleCanVerifyEmail({ email: 'user@gmail.com', email_verified: false })).toBe(false)
  })
})
