import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from './supabase'
import { sendDccEmail } from './dcc-emails'
import { dccEmailButton } from './dcc-email-template'

const TOKEN_BYTES = 32
const TOKEN_EXPIRES_MINUTES = 60

function getSiteUrl() {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
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
    <p>Olá, ${safeName}.</p>
    <p>Recebemos uma solicitação para criar uma nova senha para sua conta de compositor na DCC Music.</p>
    ${dccEmailButton('Criar nova senha', input.resetUrl)}
    <p style="font-size:13px;line-height:1.5;color:#777080;">
      Se o botão não funcionar, copie e cole este link no navegador:<br>
      <span style="word-break:break-all;">${escapeHtml(input.resetUrl)}</span>
    </p>
    <p style="font-size:12px;color:#777080;margin-top:24px;">Este link expira em 1 hora. Se você não pediu a troca de senha, ignore este e-mail.</p>
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

  const reset = await createComposerPasswordReset({
    composerId: composer.id,
    email: normalizedEmail,
  })

  return sendDccEmail({
    to: normalizedEmail,
    subject: 'Crie uma nova senha na DCC Music',
    title: 'Redefinir sua senha',
    preview: 'Crie uma nova senha para acessar sua conta de compositor na DCC Music.',
    category: 'composer_password_reset',
    provider: 'brevo',
    eventKey: `composer-password-reset/${composer.id}/${Date.now()}`,
    metadata: { composerId: composer.id },
    contentHtml: passwordResetEmailHtml({ name: composer.name, resetUrl: reset.resetUrl }),
  })
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
