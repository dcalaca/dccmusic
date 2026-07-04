import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'
import { supabaseAdmin } from './supabase'

const TOKEN_BYTES = 32
const TOKEN_EXPIRES_MINUTES = 60

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function passwordResetEmailHtml(input: { name: string; resetUrl: string }) {
  const safeName = escapeHtml(input.name || 'compositor')

  return `
    <div style="font-family: Arial, sans-serif; background:#050505; color:#ffffff; padding:32px;">
      <div style="max-width:560px; margin:0 auto; background:#111827; border:1px solid #312e81; border-radius:18px; padding:28px;">
        <h1 style="margin:0 0 12px; font-size:26px; color:#c084fc;">Redefinir sua senha</h1>
        <p style="font-size:16px; line-height:1.6; color:#e5e7eb;">
          Olá, ${safeName}. Recebemos uma solicitação para criar uma nova senha para sua conta de compositor na DCC Music.
        </p>
        <p style="text-align:center; margin:30px 0;">
          <a href="${input.resetUrl}" style="display:inline-block; background:linear-gradient(90deg,#7c3aed,#9333ea); color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:12px; font-weight:bold;">
            Criar nova senha
          </a>
        </p>
        <p style="font-size:13px; line-height:1.5; color:#9ca3af;">
          Se o botão não funcionar, copie e cole este link no navegador:<br />
          <span style="word-break:break-all;">${input.resetUrl}</span>
        </p>
        <p style="font-size:12px; color:#6b7280; margin-top:26px;">
          Este link expira em 1 hora. Se você não pediu a troca de senha, ignore este e-mail.
        </p>
      </div>
    </div>
  `
}

async function createComposerPasswordReset(input: {
  composerId: string
  email: string
}) {
  const now = new Date().toISOString()
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRES_MINUTES * 60 * 1000).toISOString()

  await supabaseAdmin
    .from('composer_password_resets')
    .update({ used_at: now })
    .eq('composer_id', input.composerId)
    .is('used_at', null)

  const { error } = await supabaseAdmin
    .from('composer_password_resets')
    .insert({
      composer_id: input.composerId,
      email: input.email.toLowerCase().trim(),
      token_hash: tokenHash,
      expires_at: expiresAt,
    })

  if (error) throw error

  return {
    token,
    resetUrl: `${getSiteUrl()}/compositores/redefinir-senha?token=${token}`,
  }
}

export async function sendComposerPasswordResetEmail(email: string) {
  const normalizedEmail = email.toLowerCase().trim()

  const { data: composer, error } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id, name, email')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (error) throw error
  if (!composer) return { sent: false, reason: 'composer_not_found' }

  const resend = getResendClient()
  const from = normalizeEmailHeader(process.env.RESEND_FROM_EMAIL)
  const replyTo = normalizeEmailHeader(process.env.RESEND_REPLY_TO_EMAIL)

  if (!resend || !from) {
    console.warn('[PASSWORD RESET] RESEND_API_KEY ou RESEND_FROM_EMAIL ausente. E-mail não enviado.')
    return { sent: false, reason: 'missing_resend_config' }
  }

  const reset = await createComposerPasswordReset({
    composerId: composer.id,
    email: normalizedEmail,
  })

  const { data, error: resendError } = await resend.emails.send({
    from,
    to: [normalizedEmail],
    subject: 'Crie uma nova senha na DCC Music',
    html: passwordResetEmailHtml({ name: composer.name, resetUrl: reset.resetUrl }),
    replyTo,
    tags: [
      { name: 'category', value: 'composer_password_reset' },
      { name: 'composer_id', value: composer.id },
    ],
  }, {
    idempotencyKey: `composer-password-reset/${composer.id}/${Date.now()}`,
  })

  if (resendError) {
    console.error('[PASSWORD RESET] Erro Resend:', resendError)
    throw new Error(resendError.message || 'Erro ao enviar e-mail de redefinição de senha')
  }

  return { sent: true, id: data?.id || null }
}

export async function resetComposerPasswordWithToken(token: string, newPassword: string) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Senha deve ter pelo menos 6 caracteres')
  }

  const tokenHash = hashToken(token)
  const { data: reset, error } = await supabaseAdmin
    .from('composer_password_resets')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error) throw error
  if (!reset) return { ok: false, reason: 'invalid' }
  if (reset.used_at) return { ok: false, reason: 'used' }
  if (new Date(reset.expires_at) < new Date()) return { ok: false, reason: 'expired' }

  const now = new Date().toISOString()
  const passwordHash = await bcrypt.hash(newPassword, 10)

  const { error: composerError } = await supabaseAdmin
    .from('dccmusic_composers')
    .update({
      password_hash: passwordHash,
      email_verified: true,
      email_verified_at: now,
      updated_at: now,
    })
    .eq('id', reset.composer_id)
    .eq('email', reset.email)

  if (composerError) throw composerError

  const { error: resetError } = await supabaseAdmin
    .from('composer_password_resets')
    .update({ used_at: now })
    .eq('id', reset.id)

  if (resetError) throw resetError

  return { ok: true, composerId: reset.composer_id }
}
