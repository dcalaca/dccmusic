import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { googleCanVerifyEmail, verifyGoogleIdentity } from '@/lib/google-identity'
import { hasComposerAccountDeletionBlock } from '@/lib/dcc-emails'
import { getDetectedCountry } from '@/lib/localization'
import { normalizeName, formatDisplayName } from '@/lib/normalize'
import { PARTNER_COOKIE, PARTNER_SESSION_COOKIE, applyComposerPartnerAttribution } from '@/lib/partners'
import { sendMetaCompleteRegistrationEvent } from '@/lib/meta-conversions'

export const dynamic = 'force-dynamic'
const COOKIE = 'dcc_google_nonce'
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/compositores/google', maxAge: 300 }
function config() {
  return { clientId: process.env.GOOGLE_CLIENT_ID?.trim() || '301783166545-uvk7oetb3guj8r2qc0a3otn5e6m3qf9b.apps.googleusercontent.com', secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET }
}
function reply(body: object, status = 200) {
  const response = NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(COOKIE, '', { ...cookieOptions, maxAge: 0 })
  return response
}
export async function GET() {
  const { clientId, secret } = config()
  if (!clientId || !secret) return NextResponse.json({ enabled: false }, { headers: { 'Cache-Control': 'no-store' } })
  const nonce = randomBytes(32).toString('base64url')
  const response = NextResponse.json({ enabled: true, clientId, nonce }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(COOKIE, jwt.sign({ nonce, purpose: 'google-login' }, secret, { expiresIn: '5m' }), cookieOptions)
  return response
}
export async function POST(request: NextRequest) {
  const { clientId, secret } = config()
  if (!clientId || !secret) return reply({ code: 'unavailable' }, 503)
  if (request.headers.get('origin') !== request.nextUrl.origin) return reply({ code: 'invalid' }, 403)
  try {
    const signedNonce = request.cookies.get(COOKIE)?.value
    if (!signedNonce) throw new Error('invalid')
    const challenge = jwt.verify(signedNonce, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload
    if (challenge.purpose !== 'google-login' || typeof challenge.nonce !== 'string') throw new Error('invalid')
    const body = await request.json()
    if (typeof body.credential !== 'string') throw new Error('invalid')
    const identity = await verifyGoogleIdentity(body.credential, clientId, challenge.nonce)
    const email = identity.email.trim().toLowerCase()
    const { data: linked, error: linkedError } = await supabaseAdmin.from('dccmusic_composers').select('*').eq('google_sub', identity.sub).maybeSingle()
    if (linkedError) throw new Error('unavailable')
    let composer = linked
    let created = false
    if (!composer) {
      // Only Google-authoritative email addresses may link to an existing account.
      if (!googleCanVerifyEmail(identity)) return reply({ code: 'emailVerification' }, 403)
      const { data: existing, error } = await supabaseAdmin.from('dccmusic_composers').select('*').eq('email', email).maybeSingle()
      if (error) throw new Error('unavailable')
      if (existing) {
        if (existing.google_sub && existing.google_sub !== identity.sub) throw new Error('invalid')
        const { data, error: updateError } = await supabaseAdmin.from('dccmusic_composers').update({ google_sub: identity.sub, email_verified: true, email_verified_at: existing.email_verified_at || new Date().toISOString() }).eq('id', existing.id).is('google_sub', null).select('*').maybeSingle()
        if (updateError || !data) throw new Error('invalid')
        composer = data
      } else {
        if (await hasComposerAccountDeletionBlock(email)) return reply({ code: 'deletedAccount' }, 403)
        const suffix = randomUUID().slice(0, 8)
        const name = formatDisplayName(identity.name?.trim().slice(0, 100) || email.split('@')[0])
        // Keep hash-based password storage; the random password is never disclosed.
        const passwordHash = await bcrypt.hash(randomBytes(48).toString('base64url'), 10)
        const payload = { name, account_name: name, slug: `${normalizeName(name).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'compositor'}-${suffix}`, email, password_hash: passwordHash, google_sub: identity.sub, email_verified: true, email_verified_at: new Date().toISOString(), country: getDetectedCountry(request.headers) }
        let { data, error: insertError } = await supabaseAdmin.from('dccmusic_composers').insert(payload).select('*').single()
        if (insertError?.code === '23505' && /name/i.test(insertError.message + insertError.details)) {
          const retry = await supabaseAdmin.from('dccmusic_composers').insert({ ...payload, name: `${name} ${suffix}` }).select('*').single()
          data = retry.data
          insertError = retry.error
        }
        if (insertError || !data) throw new Error('unavailable')
        composer = data
        created = true
        const partnerCode = typeof body.partnerAttribution?.code === 'string' ? body.partnerAttribution.code : request.cookies.get(PARTNER_COOKIE)?.value
        if (partnerCode) await applyComposerPartnerAttribution({ composerId: composer.id, partnerCode, sessionId: request.cookies.get(PARTNER_SESSION_COOKIE)?.value || null }).catch(() => console.warn('[GOOGLE LOGIN] Partner attribution failed'))
        await sendMetaCompleteRegistrationEvent({ request, eventId: `composer_registration:${composer.id}`, eventSourceUrl: request.headers.get('referer') || request.url, email, externalId: composer.id, contentName: 'Cadastro de compositor' }).catch(() => console.warn('[GOOGLE LOGIN] Registration event failed'))
      }
    }
    const token = jwt.sign({ composerId: composer.id, email: composer.email, name: composer.name, requiresPasswordChange: false }, secret, { expiresIn: '30d' })
    return reply({ token, created, composer: { id: composer.id, name: composer.name, slug: composer.slug, email: composer.email, isPremium: composer.is_premium, subscription_expires_at: composer.subscription_expires_at } })
  } catch (error) {
    const code = error instanceof Error && error.message === 'unavailable' ? 'unavailable' : 'invalid'
    return reply({ code }, code === 'unavailable' ? 503 : 401)
  }
}
