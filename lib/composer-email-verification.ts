import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { Resend } from 'resend'
import { supabaseAdmin } from './supabase'
import { sendAdminNewComposerEmail, sendComposerWelcomeEmail } from './dcc-emails'
import { recordConfirmedPartnerSignup } from './partners'
import { sendTikTokCompleteRegistrationEvent } from './tiktok-events'

const TOKEN_BYTES = 32
const TOKEN_EXPIRES_MINUTES = 60 * 24
const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production'

function getSiteUrl() {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

function normalizeEmailHeader(value: string | undefined) {
  if (!value) return undefined
  let normalized = value.trim()

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim()
  }

  return normalized || undefined
}

function verificationEmailHtml(input: { name: string; verificationUrl: string }) {
  return `
    <div style="font-family: Arial, sans-serif; background:#050505; color:#ffffff; padding:32px;">
      <div style="max-width:560px; margin:0 auto; background:#111827; border:1px solid #312e81; border-radius:18px; padding:28px;">
        <h1 style="margin:0 0 12px; font-size:26px; color:#c084fc;">Confirme seu e-mail</h1>
        <p style="font-size:16px; line-height:1.6; color:#e5e7eb;">
          Olá, ${input.name}. Clique no botão abaixo para confirmar seu e-mail e ativar sua conta de compositor na DCC Music.
        </p>
        <p style="text-align:center; margin:30px 0;">
          <a href="${input.verificationUrl}" style="display:inline-block; background:linear-gradient(90deg,#7c3aed,#9333ea); color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:12px; font-weight:bold;">
            Confirmar meu e-mail
          </a>
        </p>
        <p style="font-size:13px; line-height:1.5; color:#9ca3af;">
          Se o botão não funcionar, copie e cole este link no navegador:<br />
          <span style="word-break:break-all;">${input.verificationUrl}</span>
        </p>
        <p style="font-size:12px; color:#6b7280; margin-top:26px;">
          Este link expira em 24 horas. Se você não criou essa conta, ignore este e-mail.
        </p>
      </div>
    </div>
  `
}

function activationReminderEmailHtml(input: { name: string; verificationUrl: string }) {
  return `
    <div style="font-family: Arial, sans-serif; background:#050505; color:#ffffff; padding:32px;">
      <div style="max-width:560px; margin:0 auto; background:#111827; border:1px solid #312e81; border-radius:18px; padding:28px;">
        <h1 style="margin:0 0 12px; font-size:26px; color:#c084fc;">Ative sua conta na DCC Music</h1>
        <p style="font-size:16px; line-height:1.6; color:#e5e7eb;">
          Olá, ${input.name}. Você ainda não ativou sua conta de compositor na DCC Music.
        </p>
        <p style="font-size:16px; line-height:1.6; color:#e5e7eb;">
          Ative sua conta para acessar o painel e usar sua música grátis no DCC Studio IA.
        </p>
        <p style="text-align:center; margin:30px 0;">
          <a href="${input.verificationUrl}" style="display:inline-block; background:linear-gradient(90deg,#7c3aed,#9333ea); color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:12px; font-weight:bold;">
            Ativar minha conta
          </a>
        </p>
        <p style="font-size:13px; line-height:1.5; color:#9ca3af;">
          Se o botão não funcionar, copie e cole este link no navegador:<br />
          <span style="word-break:break-all;">${input.verificationUrl}</span>
        </p>
        <p style="font-size:12px; color:#6b7280; margin-top:26px;">
          Este link expira em 24 horas.
        </p>
      </div>
    </div>
  `
}

export async function createComposerEmailVerification(input: {
  composerId: string
  email: string
  name: string
}) {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRES_MINUTES * 60 * 1000).toISOString()

  const { error } = await supabaseAdmin
    .from('composer_email_verifications')
    .insert({
      composer_id: input.composerId,
      email: input.email.toLowerCase().trim(),
      token_hash: tokenHash,
      expires_at: expiresAt,
    })

  if (error) throw error

  return {
    token,
    verificationUrl: `${getSiteUrl()}/compositores/verificar-email?token=${token}`,
  }
}

export async function sendComposerVerificationEmail(input: {
  composerId: string
  email: string
  name: string
}) {
  const resend = getResendClient()
  const from = normalizeEmailHeader(process.env.RESEND_FROM_EMAIL)
  const replyTo = normalizeEmailHeader(process.env.RESEND_REPLY_TO_EMAIL)

  if (!resend || !from) {
    console.warn('[EMAIL VERIFY] RESEND_API_KEY ou RESEND_FROM_EMAIL ausente. E-mail não enviado.')
    return { sent: false, reason: 'missing_resend_config' }
  }

  const verification = await createComposerEmailVerification(input)

  const { data, error } = await resend.emails.send({
    from,
    to: [input.email],
    subject: 'Confirme seu e-mail na DCC Music',
    html: verificationEmailHtml({ name: input.name, verificationUrl: verification.verificationUrl }),
    replyTo,
    tags: [
      { name: 'category', value: 'composer_email_verification' },
      { name: 'composer_id', value: input.composerId },
    ],
  }, {
    idempotencyKey: `composer-email-verification/${input.composerId}/${Date.now()}`,
  })

  if (error) {
    console.error('[EMAIL VERIFY] Erro Resend:', error)
    throw new Error(error.message || 'Erro ao enviar e-mail de confirmação')
  }

  return { sent: true, id: data?.id || null }
}

export async function sendComposerActivationReminderEmail(input: {
  composerId: string
  email: string
  name: string
}) {
  const resend = getResendClient()
  const from = normalizeEmailHeader(process.env.RESEND_FROM_EMAIL)
  const replyTo = normalizeEmailHeader(process.env.RESEND_REPLY_TO_EMAIL)

  if (!resend || !from) {
    console.warn('[EMAIL VERIFY] RESEND_API_KEY ou RESEND_FROM_EMAIL ausente. Lembrete não enviado.')
    return { sent: false, reason: 'missing_resend_config' }
  }

  const verification = await createComposerEmailVerification(input)

  const { data, error } = await resend.emails.send({
    from,
    to: [input.email],
    subject: 'Ative sua conta e use sua música grátis',
    html: activationReminderEmailHtml({ name: input.name, verificationUrl: verification.verificationUrl }),
    replyTo,
    tags: [
      { name: 'category', value: 'composer_activation_reminder' },
      { name: 'composer_id', value: input.composerId },
    ],
  }, {
    idempotencyKey: `composer-activation-reminder/${input.composerId}/${Date.now()}`,
  })

  if (error) {
    console.error('[EMAIL VERIFY] Erro Resend lembrete:', error)
    throw new Error(error.message || 'Erro ao enviar lembrete de ativação')
  }

  return { sent: true, id: data?.id || null }
}

export async function verifyComposerEmailToken(token: string) {
  const tokenHash = hashToken(token)
  const { data: verification, error } = await supabaseAdmin
    .from('composer_email_verifications')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error) throw error
  if (!verification) return { ok: false, reason: 'invalid' }
  if (verification.used_at) return { ok: false, reason: 'used' }
  if (new Date(verification.expires_at) < new Date()) return { ok: false, reason: 'expired' }

  const verifiedAt = new Date().toISOString()
  const { error: composerError } = await supabaseAdmin
    .from('dccmusic_composers')
    .update({
      email_verified: true,
      email_verified_at: verifiedAt,
      updated_at: verifiedAt,
    })
    .eq('id', verification.composer_id)
    .eq('email', verification.email)

  if (composerError) throw composerError

  const { error: verificationError } = await supabaseAdmin
    .from('composer_email_verifications')
    .update({ used_at: verifiedAt })
    .eq('id', verification.id)

  if (verificationError) throw verificationError

  const { data: composer } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id, name, slug, email, is_premium, subscription_expires_at')
    .eq('id', verification.composer_id)
    .maybeSingle()

  if (composer?.email) {
    try {
      await sendComposerWelcomeEmail({
        composerId: composer.id,
        name: composer.name || 'Compositor',
        email: composer.email,
      })
    } catch (welcomeEmailError) {
      console.error('[EMAIL VERIFY] Erro ao enviar boas-vindas:', welcomeEmailError)
    }

    try {
      await sendAdminNewComposerEmail({
        composerId: composer.id,
        email: composer.email,
        name: composer.name || 'Compositor',
        createdAt: new Date(),
      })
    } catch (adminEmailError) {
      console.error('[EMAIL VERIFY] Erro ao enviar aviso administrativo de novo compositor:', adminEmailError)
    }

    await sendTikTokCompleteRegistrationEvent({
      eventId: `composer_registration:${composer.id}`,
      eventSourceUrl: 'https://www.dccmusic.online/compositores/verificar-email',
      email: composer.email,
      externalId: composer.id,
    }).catch((tiktokError) => {
      console.error('[EMAIL VERIFY] Erro ao enviar cadastro para TikTok:', tiktokError)
    })
  }

  await recordConfirmedPartnerSignup(verification.composer_id).catch((partnerError) => {
    console.error('[EMAIL VERIFY] Erro ao registrar cadastro confirmado para parceiro:', partnerError)
  })

  if (!composer?.email) {
    return { ok: true, composerId: verification.composer_id }
  }

  const loginToken = jwt.sign(
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
    ok: true,
    composerId: verification.composer_id,
    login: {
      token: loginToken,
      redirectTo: '/compositores/admin/studio-ia',
      composer: {
        id: composer.id,
        name: composer.name,
        slug: composer.slug,
        email: composer.email,
        isPremium: Boolean((composer as any).is_premium),
        subscription_expires_at: (composer as any).subscription_expires_at || null,
      },
    },
  }
}
