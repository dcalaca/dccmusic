import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from './supabase'
import { createTrackedLink } from './db'
import { getBaseUrl, getTrackedLinkUrl } from './link-utils'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const MAGIC_LINK_TTL_DAYS = 7

type RecipientType = 'composer' | 'site_user'

type CampaignButtonInput = {
  campaignId: string
  campaignName?: string | null
  recipientType: RecipientType
  recipientId: string
  recipientEmail: string
  recipientName?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
}

type MagicLoginRecord = {
  id: string
  campaign_id: string | null
  recipient_type: RecipientType
  recipient_id: string
  recipient_email: string
  destination_path: string
  expires_at: string
  used_at: string | null
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function getSiteUrl() {
  return getBaseUrl().replace(/\/$/, '')
}

function isKnownDccHost(hostname: string, siteHostname: string) {
  return hostname === siteHostname ||
    hostname === 'dccmusic.online' ||
    hostname === 'www.dccmusic.online' ||
    hostname.endsWith('.dccmusic.online')
}

function toAbsoluteUrl(value: string) {
  const siteUrl = getSiteUrl()
  return new URL(value, siteUrl).toString()
}

function getInternalPath(value?: string | null) {
  const rawValue = String(value || '').trim()
  if (!rawValue) return null
  if (rawValue.startsWith('//')) return null

  try {
    const siteUrl = getSiteUrl()
    const site = new URL(siteUrl)
    const target = new URL(rawValue, siteUrl)

    if (!isKnownDccHost(target.hostname, site.hostname)) return null

    return `${target.pathname}${target.search}${target.hash}` || '/'
  } catch {
    return null
  }
}

function getMagicLinkExpiration() {
  return new Date(Date.now() + MAGIC_LINK_TTL_DAYS * 24 * 60 * 60 * 1000)
}

async function createMagicLoginToken(input: {
  campaignId: string
  recipientType: RecipientType
  recipientId: string
  recipientEmail: string
  destinationPath: string
}) {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = sha256(token)
  const expiresAt = getMagicLinkExpiration()

  const { error } = await supabaseAdmin
    .from('admin_email_campaign_magic_links')
    .insert({
      campaign_id: input.campaignId,
      recipient_type: input.recipientType,
      recipient_id: input.recipientId,
      recipient_email: input.recipientEmail,
      destination_path: input.destinationPath,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    })

  if (error) throw error

  return token
}

export async function createCampaignButtonUrl(input: CampaignButtonInput) {
  const rawCtaUrl = String(input.ctaUrl || '').trim()
  if (!rawCtaUrl) return null

  const siteUrl = getSiteUrl()
  const internalPath = getInternalPath(rawCtaUrl)
  let destinationUrl = toAbsoluteUrl(rawCtaUrl)

  if (internalPath) {
    const magicToken = await createMagicLoginToken({
      campaignId: input.campaignId,
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      recipientEmail: input.recipientEmail,
      destinationPath: internalPath,
    })

    destinationUrl = `${siteUrl}/api/email-magic-login?token=${encodeURIComponent(magicToken)}`
  }

  const link = await createTrackedLink({
    title: `Campanha: ${input.campaignName || input.campaignId} - ${input.recipientEmail}`,
    destinationUrl,
    createdBy: 'admin_email_campaign',
    notes: JSON.stringify({
      type: 'admin_email_campaign_cta',
      campaignId: input.campaignId,
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      recipientEmail: input.recipientEmail,
      ctaLabel: input.ctaLabel || null,
      autoLogin: Boolean(internalPath),
    }),
  })

  return getTrackedLinkUrl(link.shortCode)
}

function assertSafeDestinationPath(value: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

async function markMagicLinkAsUsed(record: MagicLoginRecord) {
  const { data, error } = await supabaseAdmin
    .from('admin_email_campaign_magic_links')
    .update({ used_at: new Date().toISOString() })
    .eq('id', record.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Este link já foi usado.')
}

export async function consumeMagicLoginToken(rawToken: string) {
  const token = String(rawToken || '').trim()
  if (!token) throw new Error('Link de acesso inválido.')

  const { data, error } = await supabaseAdmin
    .from('admin_email_campaign_magic_links')
    .select('*')
    .eq('token_hash', sha256(token))
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Link de acesso inválido.')

  const record = data as MagicLoginRecord

  if (record.used_at) throw new Error('Este link já foi usado.')
  if (new Date(record.expires_at) < new Date()) throw new Error('Este link expirou.')

  await markMagicLinkAsUsed(record)

  if (record.recipient_type === 'composer') {
    const { data: composer, error: composerError } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name, slug, email, is_premium, subscription_expires_at, email_verified')
      .eq('id', record.recipient_id)
      .maybeSingle()

    if (composerError) throw composerError
    if (!composer?.email) throw new Error('Conta de compositor não encontrada.')
    if ((composer as any).email_verified === false) {
      throw new Error('Confirme seu e-mail antes de entrar.')
    }

    const tokenJwt = jwt.sign(
      {
        composerId: composer.id,
        email: composer.email,
        name: composer.name,
        requiresPasswordChange: false,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    return {
      authType: 'composer' as const,
      token: tokenJwt,
      redirectPath: assertSafeDestinationPath(record.destination_path),
      user: {
        id: composer.id,
        name: composer.name,
        slug: composer.slug,
        email: composer.email,
        isPremium: Boolean((composer as any).is_premium),
        subscription_expires_at: (composer as any).subscription_expires_at || null,
      },
    }
  }

  const { data: siteUser, error: siteUserError } = await supabaseAdmin
    .from('dccmusic_site_users')
    .select('id, name, first_name, email, is_active')
    .eq('id', record.recipient_id)
    .eq('is_active', true)
    .maybeSingle()

  if (siteUserError) throw siteUserError
  if (!siteUser?.email) throw new Error('Conta de usuário não encontrada.')

  const tokenJwt = jwt.sign(
    {
      userId: siteUser.id,
      email: siteUser.email,
      name: siteUser.name,
      firstName: (siteUser as any).first_name || siteUser.name,
      requiresPasswordChange: false,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  )

  return {
    authType: 'site_user' as const,
    token: tokenJwt,
    redirectPath: assertSafeDestinationPath(record.destination_path),
    user: {
      id: siteUser.id,
      name: siteUser.name,
      email: siteUser.email,
      firstName: (siteUser as any).first_name || siteUser.name,
    },
  }
}
