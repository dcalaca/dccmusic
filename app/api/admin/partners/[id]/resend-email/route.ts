import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isPartnerSchemaMissing } from '@/lib/partners'
import { sendPartnerWelcomeEmail } from '@/lib/dcc-emails'

export const dynamic = 'force-dynamic'

function getBaseUrl(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL
  if (configured) return configured.replace(/\/$/, '').replace(/https:\/\/.*vercel\.app$/, 'https://www.dccmusic.online')
  const protocol = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'www.dccmusic.online'
  if (host.includes('vercel.app')) return 'https://www.dccmusic.online'
  return `${protocol}://${host}`.replace(/\/$/, '')
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const partnerId = params.id
    if (!partnerId) return NextResponse.json({ error: 'Parceiro não informado.' }, { status: 400 })

    const { data: partner, error: partnerError } = await supabaseAdmin
      .from('partners')
      .select('*')
      .eq('id', partnerId)
      .maybeSingle()

    if (partnerError) throw partnerError
    if (!partner) return NextResponse.json({ error: 'Parceiro não encontrado.' }, { status: 404 })
    if (!partner.email) return NextResponse.json({ error: 'Parceiro sem e-mail cadastrado.' }, { status: 400 })

    const baseUrl = getBaseUrl(request)
    const emailResult = await sendPartnerWelcomeEmail({
      partnerId: partner.id,
      email: partner.email,
      displayName: partner.display_name,
      partnerCode: partner.partner_code,
      partnerLink: `${baseUrl}/r/${partner.partner_code}`,
      temporaryPassword: partner.requires_password_change ? '123' : null,
      attributionWindowDays: Number(partner.attribution_window_days) || 15,
      customerLifetimeMonths: Number(partner.customer_lifetime_months) || 6,
      commissionPercentage: Number(partner.commission_percentage) || 0,
      commissionModel: partner.commission_model || 'percentage',
      commissionPaymentScope: partner.commission_payment_scope || 'lifetime',
      cpaStudioTopupAmount: Number(partner.cpa_studio_topup_amount) || 0,
      cpaSubscriptionAmount: Number(partner.cpa_subscription_amount) || 0,
      commissionCapAmount: partner.commission_cap_amount == null ? null : Number(partner.commission_cap_amount) || 0,
    })

    if (!emailResult.sent) {
      return NextResponse.json(
        { error: 'E-mail não enviado. Confira a configuração do Resend.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, emailSent: true })
  } catch (error: any) {
    if (isPartnerSchemaMissing(error)) {
      return NextResponse.json({ setupRequired: true, error: 'Rode o SQL do sistema de parceiros.' }, { status: 400 })
    }
    console.error('[Admin Partners Resend Email] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao reenviar e-mail do parceiro' }, { status: 500 })
  }
}
