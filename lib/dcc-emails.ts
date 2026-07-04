import { Resend } from 'resend'
import { supabaseAdmin } from './supabase'

type EmailResult = {
  sent: boolean
  id?: string | null
  reason?: string
}

type ComposerEmailInput = {
  composerId: string
  name: string
  email: string
  [key: string]: any
}

type DccEmailInput = {
  to: string
  subject: string
  title: string
  preview?: string
  category: string
  eventKey?: string
  contentHtml: string
  metadata?: Record<string, any>
  bccAdmin?: boolean
}

function getSiteUrl() {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.dccmusic.online').replace(/\/$/, '')
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

function normalizeEmailHeader(value?: string | null) {
  return String(value || '').trim() || undefined
}

function escapeHtml(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatMoney(value?: number | null) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function nl2br(value: string) {
  return escapeHtml(value).replace(/\n/g, '<br>')
}

function button(label: string, href: string) {
  return `
    <p style="margin:22px 0;">
      <a href="${escapeHtml(href)}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;text-decoration:none;font-weight:700;border-radius:12px;padding:13px 18px;">
        ${escapeHtml(label)}
      </a>
    </p>
  `
}

function emailLayout(input: DccEmailInput) {
  return `
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">${escapeHtml(input.preview || input.subject)}</div>
    <div style="background:#030712;color:#f9fafb;font-family:Arial,Helvetica,sans-serif;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#050816;border:1px solid #1f2937;border-radius:18px;overflow:hidden;">
        <div style="padding:22px 24px;border-bottom:1px solid #1f2937;background:linear-gradient(135deg,#050816,#1e0b42);">
          <p style="margin:0 0 8px;color:#c084fc;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">DCC Music</p>
          <h1 style="margin:0;color:#fff;font-size:24px;line-height:1.2;">${escapeHtml(input.title)}</h1>
        </div>
        <div style="padding:24px;color:#e5e7eb;font-size:15px;line-height:1.65;">
          ${input.contentHtml}
        </div>
      </div>
    </div>
  `
}

async function recordEmailEvent(input: DccEmailInput, result: EmailResult) {
  if (!result.sent) return

  try {
    const { error } = await supabaseAdmin.from('dccmusic_email_events').insert({
      event_key: input.eventKey || `${input.category}/${input.to}/${Date.now()}`,
      category: input.category,
      recipient: input.to,
      subject: input.subject,
      provider_id: result.id || null,
      metadata: input.metadata || {},
    })
    if (error && !String(error.message || '').includes('schema cache')) {
      console.warn('[DCC EMAIL] Falha ao registrar evento:', error.message)
    }
  } catch {
    // O envio de e-mail não pode falhar só porque o log auxiliar não existe.
  }
}

async function sendDccEmail(input: DccEmailInput): Promise<EmailResult> {
  const resend = getResendClient()
  const from = normalizeEmailHeader(process.env.RESEND_FROM_EMAIL)
  const replyTo = normalizeEmailHeader(process.env.RESEND_REPLY_TO_EMAIL)
  const adminEmail = normalizeEmailHeader(process.env.ADMIN_EMAIL || process.env.DCC_ADMIN_EMAIL)

  if (!resend || !from) {
    const result = { sent: false, reason: 'resend_not_configured' }
    await recordEmailEvent(input, result)
    return result
  }

  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    replyTo,
    bcc: input.bccAdmin && adminEmail ? [adminEmail] : undefined,
    subject: input.subject,
    html: emailLayout(input),
  })

  if (error) {
    console.error('[DCC EMAIL] Erro Resend:', error)
    throw new Error(error.message || 'Erro ao enviar e-mail')
  }

  const result = { sent: true, id: data?.id || null }
  await recordEmailEvent(input, result)
  return result
}

export async function getComposerEmailIdentity(composerId: string) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id, name, email, slug')
    .eq('id', composerId)
    .maybeSingle()

  if (error) throw error
  if (!data?.email) return null

  return {
    composerId: data.id,
    name: data.name || 'Compositor',
    email: data.email,
    slug: data.slug || null,
  }
}

export async function sendComposerWelcomeEmail(input: ComposerEmailInput) {
  return sendDccEmail({
    to: input.email,
    subject: 'Bem-vindo à DCC Music',
    title: `Bem-vindo, ${input.name}`,
    category: 'composer_welcome',
    eventKey: `composer-welcome/${input.composerId}`,
    metadata: { composerId: input.composerId },
    contentHtml: `
      <p>Olá, ${escapeHtml(input.name)}.</p>
      <p>Seu e-mail foi confirmado e sua conta de compositor está pronta.</p>
      ${button('Acessar meu painel', `${getSiteUrl()}/compositores/login`)}
    `,
  })
}

export async function sendAdminNewComposerEmail(input: ComposerEmailInput) {
  const adminEmail = normalizeEmailHeader(process.env.ADMIN_EMAIL || process.env.DCC_ADMIN_EMAIL)
  if (!adminEmail) return { sent: false, reason: 'admin_email_missing' }

  return sendDccEmail({
    to: adminEmail,
    subject: 'Novo compositor cadastrado',
    title: 'Novo compositor cadastrado',
    category: 'admin_new_composer',
    eventKey: `admin-new-composer/${input.composerId}`,
    metadata: { composerId: input.composerId },
    contentHtml: `
      <p><strong>Nome:</strong> ${escapeHtml(input.name)}</p>
      <p><strong>E-mail:</strong> ${escapeHtml(input.email)}</p>
    `,
  })
}

export async function sendAdminComposerMessageEmail(input: ComposerEmailInput & {
  subject: string
  message: string
  adminEmail?: string | null
}) {
  return sendDccEmail({
    to: input.email,
    subject: input.subject,
    title: input.subject,
    category: 'admin_composer_message',
    eventKey: `admin-message/${input.composerId}/${Date.now()}`,
    metadata: { composerId: input.composerId, adminEmail: input.adminEmail || null },
    contentHtml: `
      <p>Olá, ${escapeHtml(input.name)}.</p>
      <p>${nl2br(input.message)}</p>
    `,
  })
}

export async function sendMarketingCampaignEmail(input: {
  to: string
  name?: string | null
  subject: string
  preview?: string | null
  body: string
  ctaLabel?: string | null
  ctaUrl?: string | null
  unsubscribeUrl?: string | null
  campaignId: string
  recipientType: string
  recipientId?: string | null
}) {
  const bodyStartsWithGreeting = /^\s*ol[áa][,!\s]/i.test(input.body)
  const greeting = bodyStartsWithGreeting
    ? ''
    : input.name
      ? `<p>Olá, ${escapeHtml(input.name)}.</p>`
      : '<p>Olá.</p>'
  const campaignButton = input.ctaLabel && input.ctaUrl
    ? button(input.ctaLabel, input.ctaUrl)
    : ''

  return sendDccEmail({
    to: input.to,
    subject: input.subject,
    title: input.subject,
    preview: input.preview || input.subject,
    category: 'admin_email_campaign',
    eventKey: `admin-campaign/${input.campaignId}/${input.to}`,
    metadata: {
      campaignId: input.campaignId,
      recipientType: input.recipientType,
      recipientId: input.recipientId || null,
    },
    contentHtml: `
      ${greeting}
      <p>${nl2br(input.body)}</p>
      ${campaignButton}
      <p style="margin-top:24px;font-size:12px;color:#9ca3af;">
        Você recebeu este e-mail porque tem cadastro na DCC Music.
        ${input.unsubscribeUrl ? `<br><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#c4b5fd;text-decoration:underline;">Não quero mais receber estes e-mails</a>` : ''}
      </p>
    `,
  })
}

export async function sendManualStudioCreditEmail(input: ComposerEmailInput & {
  musicQuantity: number
  credits: number
  reason: string
  message?: string
}) {
  return sendDccEmail({
    to: input.email,
    subject: 'Créditos adicionados ao seu Studio IA',
    title: 'Créditos liberados no Studio IA',
    category: 'manual_studio_credit',
    eventKey: `manual-credit/${input.composerId}/${Date.now()}`,
    metadata: { composerId: input.composerId, credits: input.credits },
    contentHtml: `
      <p>Olá, ${escapeHtml(input.name)}.</p>
      <p>Foram adicionados <strong>${input.credits} créditos</strong> (${input.musicQuantity} música(s)) ao seu Studio IA.</p>
      <p><strong>Motivo:</strong> ${escapeHtml(input.reason)}</p>
      ${input.message ? `<p>${nl2br(input.message)}</p>` : ''}
      ${button('Acessar Studio IA', `${getSiteUrl()}/compositores/admin/studio-ia`)}
    `,
  })
}

export async function sendLowStudioCreditsEmail(input: ComposerEmailInput & {
  remainingCredits: number
  remainingMusics: number
  monthKey?: string
}) {
  return sendDccEmail({
    to: input.email,
    subject: 'Seu saldo do Studio IA está baixo',
    title: 'Saldo baixo no Studio IA',
    category: 'low_studio_credits',
    eventKey: `low-credits/${input.composerId}/${input.monthKey || 'current'}`,
    metadata: { composerId: input.composerId, remainingCredits: input.remainingCredits },
    contentHtml: `
      <p>Olá, ${escapeHtml(input.name)}.</p>
      <p>Seu saldo atual é de <strong>${input.remainingCredits} créditos</strong>, cerca de ${input.remainingMusics} música(s).</p>
      ${button('Ver recargas', `${getSiteUrl()}/compositores/admin/studio-ia/recarga`)}
    `,
  })
}

export async function sendStudioMusicReadyEmail(input: ComposerEmailInput & {
  projectTitle: string
  projectId?: string
  projectSlug?: string | null
  audioUrl?: string | null
}) {
  return sendDccEmail({
    to: input.email,
    subject: `Sua música "${input.projectTitle}" ficou pronta`,
    title: 'Sua música ficou pronta',
    category: 'studio_music_ready',
    eventKey: `studio-ready/${input.projectId || input.projectTitle}`,
    metadata: { composerId: input.composerId, projectId: input.projectId || null },
    contentHtml: `
      <p>Olá, ${escapeHtml(input.name)}.</p>
      <p>A música <strong>${escapeHtml(input.projectTitle)}</strong> já está disponível no seu Studio IA.</p>
      ${button('Abrir Studio IA', `${getSiteUrl()}/compositores/admin/studio-ia/projetos${input.projectId ? `/${input.projectId}` : ''}`)}
    `,
  })
}

export async function sendStudioMusicCommentEmail(input: ComposerEmailInput & {
  projectTitle: string
  projectSlug: string
  commenterName: string
  comment: string
  commentId: string
}) {
  return sendDccEmail({
    to: input.email,
    subject: 'Novo comentário em sua música',
    title: 'Novo comentário recebido',
    category: 'studio_music_comment',
    eventKey: `studio-comment/${input.commentId}`,
    metadata: { composerId: input.composerId, commentId: input.commentId },
    contentHtml: `
      <p>${escapeHtml(input.commenterName)} comentou em <strong>${escapeHtml(input.projectTitle)}</strong>:</p>
      <p style="background:#111827;border-radius:12px;padding:12px;">${nl2br(input.comment)}</p>
      ${button('Ver música', `${getSiteUrl()}/studio/${input.projectSlug}`)}
    `,
  })
}

export async function sendPaymentConfirmationEmail(input: ComposerEmailInput & {
  paymentId: string | number
  productType: string
  description: string
  amount: number
  paidAt?: Date
}) {
  return sendDccEmail({
    to: input.email,
    subject: 'Pagamento confirmado na DCC Music',
    title: 'Pagamento confirmado',
    category: 'payment_confirmation',
    eventKey: `payment/${input.paymentId}`,
    metadata: { composerId: input.composerId, paymentId: String(input.paymentId), productType: input.productType },
    contentHtml: `
      <p>Olá, ${escapeHtml(input.name)}.</p>
      <p>Confirmamos o pagamento de <strong>${escapeHtml(input.description)}</strong>.</p>
      <p><strong>Valor:</strong> ${formatMoney(input.amount)}</p>
      <p><strong>ID do pagamento:</strong> ${escapeHtml(input.paymentId)}</p>
    `,
  })
}

export async function sendAdminPaymentNotificationEmail(input: {
  composerName: string
  composerEmail?: string | null
  paymentId: string | number
  productType: string
  description: string
  amount: number
}) {
  const adminEmail = normalizeEmailHeader(process.env.ADMIN_EMAIL || process.env.DCC_ADMIN_EMAIL)
  if (!adminEmail) return { sent: false, reason: 'admin_email_missing' }

  return sendDccEmail({
    to: adminEmail,
    subject: 'Novo pagamento confirmado',
    title: 'Novo pagamento confirmado',
    category: 'admin_payment_notification',
    eventKey: `admin-payment/${input.paymentId}`,
    metadata: { paymentId: String(input.paymentId), productType: input.productType },
    contentHtml: `
      <p><strong>Compositor:</strong> ${escapeHtml(input.composerName)} (${escapeHtml(input.composerEmail || '')})</p>
      <p><strong>Produto:</strong> ${escapeHtml(input.description)}</p>
      <p><strong>Valor:</strong> ${formatMoney(input.amount)}</p>
      <p><strong>ID:</strong> ${escapeHtml(input.paymentId)}</p>
    `,
  })
}

export async function sendAdminStudioAlertEmail(input: {
  title: string
  message: string
  eventKey?: string
  metadata?: Record<string, any>
  detailsHtml?: string
}) {
  const adminEmail = normalizeEmailHeader(process.env.ADMIN_EMAIL || process.env.DCC_ADMIN_EMAIL)
  if (!adminEmail) return { sent: false, reason: 'admin_email_missing' }

  return sendDccEmail({
    to: adminEmail,
    subject: input.title,
    title: input.title,
    category: 'admin_studio_alert',
    eventKey: input.eventKey,
    metadata: input.metadata || {},
    contentHtml: `
      <p>${nl2br(input.message)}</p>
      ${input.detailsHtml || ''}
    `,
  })
}

export async function sendSubscriptionExpirationReminderEmail(input: ComposerEmailInput & {
  planName?: string | null
  expiresAt?: string | Date | null
  daysRemaining?: number
}) {
  return sendDccEmail({
    to: input.email,
    subject: 'Seu plano DCC Music está perto do vencimento',
    title: 'Seu plano está perto do vencimento',
    category: 'subscription_expiration_reminder',
    eventKey: `subscription-reminder/${input.composerId}/${input.daysRemaining ?? 'x'}`,
    metadata: { composerId: input.composerId, daysRemaining: input.daysRemaining },
    contentHtml: `
      <p>Olá, ${escapeHtml(input.name)}.</p>
      <p>Seu plano ${escapeHtml(input.planName || '')} vence em ${input.daysRemaining ?? '?'} dia(s).</p>
      ${button('Ver planos', `${getSiteUrl()}/compositores/planos`)}
    `,
  })
}

export async function sendPartnerWelcomeEmail(input: {
  partnerId: string
  email: string
  displayName: string
  partnerCode: string
  partnerLink: string
  temporaryPassword?: string | null
  attributionWindowDays: number
  customerLifetimeMonths: number
  commissionPercentage: number
  commissionModel?: 'percentage' | 'cpa'
  commissionPaymentScope?: 'lifetime' | 'first_purchase'
  cpaStudioTopupAmount?: number
  cpaSubscriptionAmount?: number
  commissionCapAmount?: number | null
}) {
  const loginUrl = `${getSiteUrl()}/parceiros/login`
  const hasTemporaryPassword = Boolean(input.temporaryPassword)
  const commissionDescription = input.commissionModel === 'cpa'
    ? `CPA: ${formatMoney(input.cpaStudioTopupAmount)} por música avulsa e ${formatMoney(input.cpaSubscriptionAmount)} por assinatura${input.commissionCapAmount ? `, limitado a ${formatMoney(input.commissionCapAmount)}` : ''}`
    : `${input.commissionPercentage}%`
  const paymentScopeDescription = input.commissionPaymentScope === 'first_purchase'
    ? 'Somente a primeira compra de cada cliente atribuído gera comissão.'
    : 'Compras feitas dentro do LT do cliente geram comissão.'

  return sendDccEmail({
    to: input.email,
    subject: 'Bem-vindo ao Programa de Parceiros DCC Music',
    title: `Bem-vindo, ${input.displayName}`,
    preview: 'Sua conta de parceiro foi criada. Veja como finalizar o acesso e começar a divulgar.',
    category: 'partner_welcome',
    eventKey: `partner-welcome/${input.partnerId}`,
    metadata: {
      partnerId: input.partnerId,
      partnerCode: input.partnerCode,
      partnerLink: input.partnerLink,
    },
    bccAdmin: true,
    contentHtml: `
      <p>Olá, ${escapeHtml(input.displayName)}.</p>
      <p>Sua conta de parceiro da DCC Music foi criada. A partir de agora, você pode acessar seu painel para acompanhar cliques, cadastros e compras.</p>

      <p>Para finalizar o cadastro e entrar no painel:</p>
      ${button('Acessar área do parceiro', loginUrl)}

      ${hasTemporaryPassword
        ? `
          <ol>
            <li>Entre com seu e-mail e a senha temporária <strong>${escapeHtml(input.temporaryPassword)}</strong>.</li>
            <li>Crie sua senha oficial quando o sistema solicitar.</li>
            <li>Depois, use seu link exclusivo de divulgação nas campanhas.</li>
          </ol>
        `
        : `
          <ol>
            <li>Entre com seu e-mail e a senha oficial que você já criou.</li>
            <li>Depois, use seu link exclusivo de divulgação nas campanhas.</li>
          </ol>
        `}

      <div style="background:#030712; border:1px solid #374151; border-radius:14px; padding:16px; margin-top:18px;">
        <p><strong>E-mail de acesso:</strong> ${escapeHtml(input.email)}</p>
        ${hasTemporaryPassword ? `<p><strong>Senha temporária:</strong> ${escapeHtml(input.temporaryPassword)}</p>` : ''}
        <p><strong>Comissão:</strong> ${escapeHtml(commissionDescription)}</p>
        <p><strong>Regra de pagamento:</strong> ${escapeHtml(paymentScopeDescription)}</p>
        <p><strong>Janela de atribuição:</strong> ${escapeHtml(String(input.attributionWindowDays))} dias</p>
        ${input.commissionPaymentScope === 'first_purchase'
          ? ''
          : `<p><strong>LT do cliente:</strong> ${escapeHtml(String(input.customerLifetimeMonths))} meses</p>`}
        <p style="margin-top:16px;"><strong>Link exclusivo para divulgação:</strong><br><a href="${escapeHtml(input.partnerLink)}" style="color:#c084fc;">${escapeHtml(input.partnerLink)}</a></p>
      </div>

      <p style="font-size:13px; color:#9ca3af;">
        Importante: seu link é exclusivo. Use sempre esse link nas campanhas para que os cadastros e compras sejam atribuídos corretamente.
      </p>
    `,
  })
}

export async function sendComposerAccountDeletedEmail(input: ComposerEmailInput) {
  return sendDccEmail({
    to: input.email,
    subject: 'Sua conta foi excluída da DCC Music',
    title: 'Conta excluída conforme solicitado',
    category: 'composer_account_deleted',
    eventKey: `account-deleted/${input.composerId}`,
    metadata: { composerId: input.composerId },
    contentHtml: `
      <p>Olá, ${escapeHtml(input.name)}.</p>
      <p>Confirmamos que sua conta de compositor foi excluída da DCC Music.</p>
    `,
  })
}

export async function registerComposerAccountDeletionBlock(input: ComposerEmailInput & {
  source?: string
}) {
  const { error } = await supabaseAdmin.from('composer_account_deletion_blocks').upsert({
    composer_id: input.composerId,
    email: input.email,
    name: input.name,
    source: input.source || 'unknown',
    blocked_at: new Date().toISOString(),
  }, { onConflict: 'email' })

  if (error && !String(error.message || '').includes('schema cache')) {
    console.warn('[DCC EMAIL] Falha ao registrar bloqueio de conta excluída:', error.message)
  }
}

export async function hasComposerAccountDeletionBlock(email: string) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) return false

  const { data, error } = await supabaseAdmin
    .from('composer_account_deletion_blocks')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (error) {
    if (String(error.message || '').includes('schema cache')) return false
    console.warn('[DCC EMAIL] Falha ao checar bloqueio de conta excluída:', error.message)
    return false
  }

  return Boolean(data)
}