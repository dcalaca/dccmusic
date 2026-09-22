import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from './supabase'
import { sendAdminNewComposerEmail, sendComposerWelcomeEmail, sendDccEmail } from './dcc-emails'
import { dccEmailButton, escapeEmailHtml } from './dcc-email-template'
import { recordConfirmedPartnerSignup } from './partners'
import { sendTikTokCompleteRegistrationEvent } from './tiktok-events'

const TOKEN_BYTES = 32
const TOKEN_EXPIRES_MINUTES = 60 * 24
const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export type ComposerEmailLanguage = 'pt' | 'en' | 'es'

export function getComposerEmailLanguage(country?: string | null): ComposerEmailLanguage {
  const normalizedCountry = String(country || '').trim().toUpperCase()
  if (normalizedCountry === 'US' || normalizedCountry === 'GB') return 'en'
  if (['PY', 'CO', 'MX', 'ES'].includes(normalizedCountry)) return 'es'
  return 'pt'
}

const EMAIL_COPY = {
  pt: {
    greeting: 'Olá',
    verificationSubject: 'Confirme seu e-mail na DCC Music',
    verificationTitle: 'Confirme seu e-mail',
    verificationPreview: 'Confirme seu e-mail para ativar sua conta de compositor na DCC Music.',
    verificationBody: 'Clique no botão abaixo para confirmar seu e-mail e ativar sua conta de compositor na DCC Music.',
    verificationButton: 'Confirmar meu e-mail',
    reminderSubject: 'Ative sua conta e use sua música grátis',
    reminderTitle: 'Ative sua conta na DCC Music',
    reminderPreview: 'Ative sua conta para acessar o painel e usar sua música grátis no DCC Studio IA.',
    reminderBody: 'Você ainda não ativou sua conta de compositor na DCC Music.',
    reminderBenefit: 'Ative sua conta para acessar o painel e usar sua música grátis no DCC Studio IA.',
    reminderButton: 'Ativar minha conta',
    fallback: 'Se o botão não funcionar, copie e cole este link no navegador:',
    expiry: 'Este link expira em 24 horas.',
    ignore: 'Se você não criou essa conta, ignore este e-mail.',
  },
  en: {
    greeting: 'Hi',
    verificationSubject: 'Confirm your email at DCC Music',
    verificationTitle: 'Confirm your email',
    verificationPreview: 'Confirm your email to activate your songwriter account at DCC Music.',
    verificationBody: 'Click the button below to confirm your email and activate your DCC Music songwriter account.',
    verificationButton: 'Confirm my email',
    reminderSubject: 'Activate your account and use your free song',
    reminderTitle: 'Activate your DCC Music account',
    reminderPreview: 'Activate your account to access your dashboard and use your free song in DCC AI Studio.',
    reminderBody: 'You have not activated your DCC Music songwriter account yet.',
    reminderBenefit: 'Activate your account to access your dashboard and use your free song in DCC AI Studio.',
    reminderButton: 'Activate my account',
    fallback: 'If the button does not work, copy and paste this link into your browser:',
    expiry: 'This link expires in 24 hours.',
    ignore: 'If you did not create this account, please ignore this email.',
  },
  es: {
    greeting: 'Hola',
    verificationSubject: 'Confirma tu correo electrónico en DCC Music',
    verificationTitle: 'Confirma tu correo electrónico',
    verificationPreview: 'Confirma tu correo para activar tu cuenta de compositor en DCC Music.',
    verificationBody: 'Haz clic en el botón para confirmar tu correo y activar tu cuenta de compositor en DCC Music.',
    verificationButton: 'Confirmar mi correo',
    reminderSubject: 'Activa tu cuenta y usa tu canción gratis',
    reminderTitle: 'Activa tu cuenta de DCC Music',
    reminderPreview: 'Activa tu cuenta para acceder a tu panel y usar tu canción gratis en DCC AI Studio.',
    reminderBody: 'Aún no has activado tu cuenta de compositor en DCC Music.',
    reminderBenefit: 'Activa tu cuenta para acceder a tu panel y usar tu canción gratis en DCC AI Studio.',
    reminderButton: 'Activar mi cuenta',
    fallback: 'Si el botón no funciona, copia y pega este enlace en tu navegador:',
    expiry: 'Este enlace vence en 24 horas.',
    ignore: 'Si no creaste esta cuenta, ignora este correo.',
  },
} as const

function getSiteUrl() {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function verificationEmailHtml(input: { name: string; verificationUrl: string; language: ComposerEmailLanguage }) {
  const copy = EMAIL_COPY[input.language]
  return `
    <p>${copy.greeting}, ${escapeEmailHtml(input.name)}.</p>
    <p>${copy.verificationBody}</p>
    ${dccEmailButton(copy.verificationButton, input.verificationUrl)}
    <p style="font-size:13px;line-height:1.5;color:#777080;">
      ${copy.fallback}<br>
      <span style="word-break:break-all;">${escapeEmailHtml(input.verificationUrl)}</span>
    </p>
    <p style="font-size:12px;color:#777080;margin-top:24px;">${copy.expiry} ${copy.ignore}</p>
  `
}

function activationReminderEmailHtml(input: { name: string; verificationUrl: string; language: ComposerEmailLanguage }) {
  const copy = EMAIL_COPY[input.language]
  return `
    <p>${copy.greeting}, ${escapeEmailHtml(input.name)}.</p>
    <p>${copy.reminderBody}</p>
    <p>${copy.reminderBenefit}</p>
    ${dccEmailButton(copy.reminderButton, input.verificationUrl)}
    <p style="font-size:13px;line-height:1.5;color:#777080;">
      ${copy.fallback}<br>
      <span style="word-break:break-all;">${escapeEmailHtml(input.verificationUrl)}</span>
    </p>
    <p style="font-size:12px;color:#777080;margin-top:24px;">${copy.expiry}</p>
  `
}

export async function createComposerEmailVerification(input: {
  composerId: string
  email: string
  name: string
  language?: ComposerEmailLanguage
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
    verificationUrl: `${getSiteUrl()}/compositores/verificar-email?token=${token}&lang=${input.language || 'pt'}`,
  }
}

export async function sendComposerVerificationEmail(input: {
  composerId: string
  email: string
  name: string
  language?: ComposerEmailLanguage
}) {
  const verification = await createComposerEmailVerification(input)
  const language = input.language || 'pt'
  const copy = EMAIL_COPY[language]

  return sendDccEmail({
    to: input.email,
    subject: copy.verificationSubject,
    title: copy.verificationTitle,
    preview: copy.verificationPreview,
    category: 'composer_email_verification',
    provider: 'resend',
    eventKey: `composer-email-verification/${input.composerId}/${Date.now()}`,
    metadata: { composerId: input.composerId },
    contentHtml: verificationEmailHtml({ name: input.name, verificationUrl: verification.verificationUrl, language }),
  })
}

export async function sendComposerActivationReminderEmail(input: {
  composerId: string
  email: string
  name: string
  language?: ComposerEmailLanguage
}) {
  const verification = await createComposerEmailVerification(input)
  const language = input.language || 'pt'
  const copy = EMAIL_COPY[language]

  return sendDccEmail({
    to: input.email,
    subject: copy.reminderSubject,
    title: copy.reminderTitle,
    preview: copy.reminderPreview,
    category: 'composer_activation_reminder',
    provider: 'resend',
    eventKey: `composer-activation-reminder/${input.composerId}/${Date.now()}`,
    metadata: { composerId: input.composerId },
    contentHtml: activationReminderEmailHtml({ name: input.name, verificationUrl: verification.verificationUrl, language }),
  })
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
