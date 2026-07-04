import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isPartnerSchemaMissing } from '@/lib/partners'
import bcrypt from 'bcryptjs'
import { sendPartnerWelcomeEmail } from '@/lib/dcc-emails'

export const dynamic = 'force-dynamic'

function makePartnerCode(name: string) {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 10) || 'parceiro'
  return `${base}${Math.random().toString(36).slice(2, 8)}`
}

function getBaseUrl(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL
  if (configured) return configured.replace(/\/$/, '').replace(/https:\/\/.*vercel\.app$/, 'https://www.dccmusic.online')
  const protocol = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'www.dccmusic.online'
  if (host.includes('vercel.app')) return 'https://www.dccmusic.online'
  return `${protocol}://${host}`.replace(/\/$/, '')
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const baseUrl = getBaseUrl(request)
    const { data, error } = await supabaseAdmin
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      setupRequired: false,
      partners: (data || []).map((partner: any) => ({
        id: partner.id,
        userId: partner.user_id,
        email: partner.email || null,
        displayName: partner.display_name,
        partnerCode: partner.partner_code,
        commissionPercentage: Number(partner.commission_percentage) || 0,
        commissionModel: partner.commission_model || 'percentage',
        commissionPaymentScope: partner.commission_payment_scope || 'lifetime',
        cpaStudioTopupAmount: Number(partner.cpa_studio_topup_amount) || 0,
        cpaSubscriptionAmount: Number(partner.cpa_subscription_amount) || 0,
        commissionCapAmount: partner.commission_cap_amount == null ? null : Number(partner.commission_cap_amount) || 0,
        attributionWindowDays: Number(partner.attribution_window_days) || 15,
        customerLifetimeMonths: Number(partner.customer_lifetime_months) || 6,
        requiresPasswordChange: Boolean(partner.requires_password_change),
        isActive: partner.is_active !== false,
        link: `${baseUrl}/r/${partner.partner_code}`,
        trackedLink: `${baseUrl}/l/${partner.partner_code}`,
        createdAt: partner.created_at,
      })),
    })
  } catch (error: any) {
    if (isPartnerSchemaMissing(error)) {
      return NextResponse.json({ setupRequired: true, partners: [] })
    }
    console.error('[Admin Partners] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao listar parceiros' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Parceiro não informado.' }, { status: 400 })

    const { data: partner, error: partnerError } = await supabaseAdmin
      .from('partners')
      .select('id, display_name, tracked_link_id')
      .eq('id', id)
      .maybeSingle()

    if (partnerError) throw partnerError
    if (!partner) return NextResponse.json({ error: 'Parceiro não encontrado.' }, { status: 404 })

    const { error: deleteError } = await supabaseAdmin
      .from('partners')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    // Remove o link de parceiro criado automaticamente (best-effort, não bloqueia a exclusão).
    if (partner.tracked_link_id) {
      await Promise.allSettled([
        supabaseAdmin.from('dccmusic_tracked_links').delete().eq('id', partner.tracked_link_id),
      ])
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (isPartnerSchemaMissing(error)) {
      return NextResponse.json({ setupRequired: true, error: 'Rode o SQL do sistema de parceiros.' }, { status: 400 })
    }
    console.error('[Admin Partners Delete] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao excluir parceiro' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const displayName = String(body?.displayName || '').trim()
    const commissionPercentage = Number(body?.commissionPercentage) || 10
    const commissionModel = String(body?.commissionModel || 'percentage') === 'cpa' ? 'cpa' : 'percentage'
    const commissionPaymentScope = String(body?.commissionPaymentScope || 'lifetime') === 'first_purchase'
      ? 'first_purchase'
      : 'lifetime'
    const cpaStudioTopupAmount = Number(body?.cpaStudioTopupAmount) || 0
    const cpaSubscriptionAmount = Number(body?.cpaSubscriptionAmount) || 0
    const commissionCapAmount = body?.commissionCapAmount === '' || body?.commissionCapAmount == null
      ? null
      : Math.max(0, Number(body.commissionCapAmount) || 0)
    const attributionWindowDays = Number(body?.attributionWindowDays) || 15
    const customerLifetimeMonths = Number(body?.customerLifetimeMonths) || 6

    if (!email || !displayName) {
      return NextResponse.json({ error: 'Informe e-mail e nome do parceiro.' }, { status: 400 })
    }

    const partnerCode = makePartnerCode(displayName)
    const baseUrl = getBaseUrl(request)
    const passwordHash = await bcrypt.hash('123', 10)

    const { data: link, error: linkError } = await supabaseAdmin
      .from('dccmusic_tracked_links')
      .insert({
        title: `Parceiro - ${displayName}`,
        destination_url: `${baseUrl}/?partner=${partnerCode}`,
        short_code: partnerCode,
        created_by: email,
        notes: 'Link criado automaticamente pelo sistema de parceiros.',
        is_active: true,
        link_type: 'partner',
      })
      .select('id')
      .single()

    if (linkError) throw linkError

    const { data: partner, error: partnerError } = await supabaseAdmin
      .from('partners')
      .insert({
        user_id: null,
        email,
        password_hash: passwordHash,
        requires_password_change: true,
        display_name: displayName,
        partner_code: partnerCode,
        commission_percentage: commissionPercentage,
        commission_model: commissionModel,
        commission_payment_scope: commissionPaymentScope,
        cpa_studio_topup_amount: cpaStudioTopupAmount,
        cpa_subscription_amount: cpaSubscriptionAmount,
        commission_cap_amount: commissionCapAmount,
        attribution_window_days: attributionWindowDays,
        customer_lifetime_months: customerLifetimeMonths,
        tracked_link_id: link.id,
      })
      .select('*')
      .single()

    if (partnerError) throw partnerError

    await Promise.allSettled([
      supabaseAdmin
        .from('dccmusic_tracked_links')
        .update({ partner_id: partner.id })
        .eq('id', link.id),
    ])

    let welcomeEmailSent = false
    try {
      const emailResult = await sendPartnerWelcomeEmail({
        partnerId: partner.id,
        email: partner.email,
        displayName: partner.display_name,
        partnerCode: partner.partner_code,
        partnerLink: `${baseUrl}/r/${partner.partner_code}`,
        temporaryPassword: '123',
        attributionWindowDays: Number(partner.attribution_window_days) || 15,
        customerLifetimeMonths: Number(partner.customer_lifetime_months) || 6,
        commissionPercentage: Number(partner.commission_percentage) || 0,
        commissionModel: partner.commission_model || 'percentage',
        commissionPaymentScope: partner.commission_payment_scope || 'lifetime',
        cpaStudioTopupAmount: Number(partner.cpa_studio_topup_amount) || 0,
        cpaSubscriptionAmount: Number(partner.cpa_subscription_amount) || 0,
        commissionCapAmount: partner.commission_cap_amount == null ? null : Number(partner.commission_cap_amount) || 0,
      })
      welcomeEmailSent = Boolean(emailResult.sent)
    } catch (emailError) {
      console.error('[Admin Partners Create] Erro ao enviar boas-vindas:', emailError)
    }

    return NextResponse.json({
      success: true,
      welcomeEmailSent,
      partner: {
        id: partner.id,
        displayName: partner.display_name,
        email: partner.email,
        partnerCode: partner.partner_code,
        customerLifetimeMonths: Number(partner.customer_lifetime_months) || 6,
        link: `${baseUrl}/r/${partner.partner_code}`,
        trackedLink: `${baseUrl}/l/${partner.partner_code}`,
      },
    })
  } catch (error: any) {
    if (isPartnerSchemaMissing(error)) {
      return NextResponse.json({ setupRequired: true, error: 'Rode o SQL do sistema de parceiros antes de criar parceiros.' }, { status: 400 })
    }
    console.error('[Admin Partners Create] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao criar parceiro' }, { status: 500 })
  }
}

