import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getPartnerFromRequest, isPartnerSchemaMissing } from '@/lib/partners'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function getDateRange(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const today = new Date()
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if (startDate && endDate) {
    const start = new Date(`${startDate}T00:00:00.000`)
    const end = new Date(`${endDate}T23:59:59.999`)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
      return {
        since: start.toISOString(),
        until: end.toISOString(),
        startDate,
        endDate,
      }
    }
  }

  const sinceDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  return {
    since: sinceDate.toISOString(),
    until: today.toISOString(),
    startDate: sinceDate.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10),
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function createWorkbook(rows: Record<string, any>[], sheetName: string) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ aviso: 'Nenhum registro no periodo selecionado' }])
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export async function GET(request: NextRequest) {
  try {
    const partnerToken = getPartnerFromRequest(request)
    if (!partnerToken) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') === 'purchases' ? 'purchases' : 'signups'
    const { since, until, startDate, endDate } = getDateRange(request)

    const { data: partner, error: partnerError } = await supabaseAdmin
      .from('partners')
      .select('id, display_name')
      .eq('id', partnerToken.partnerId)
      .maybeSingle()

    if (partnerError) throw partnerError
    if (!partner) return NextResponse.json({ error: 'Parceiro não encontrado' }, { status: 404 })

    let rows: Record<string, any>[] = []
    let fileLabel = 'cadastros'

    if (type === 'signups') {
      const { data: events, error: eventsError } = await supabaseAdmin
        .from('tracking_events')
        .select('user_id, metadata, created_at')
        .eq('partner_id', partner.id)
        .eq('event_type', 'signup')
        .gte('created_at', since)
        .lte('created_at', until)

      if (eventsError) throw eventsError

      const confirmedEvents = (events || []).filter((event: any) => event.metadata?.confirmed === true && event.user_id)
      const composerIds = Array.from(new Set(confirmedEvents.map((event: any) => event.user_id)))
      const composersById = new Map<string, any>()

      if (composerIds.length) {
        const { data: composers, error: composersError } = await supabaseAdmin
          .from('dccmusic_composers')
          .select('id, name, email, created_at, email_verified_at, partner_attributed_at, partner_lifetime_expires_at')
          .in('id', composerIds)

        if (composersError) throw composersError
        ;(composers || []).forEach((composer: any) => composersById.set(composer.id, composer))
      }

      rows = confirmedEvents.map((event: any) => {
        const composer = composersById.get(event.user_id)
        return {
          'Nome': composer?.name || '',
          'E-mail': composer?.email || '',
          'Cadastro confirmado em': formatDate(event.created_at),
          'Criado em': formatDate(composer?.created_at),
          'Atribuido ao parceiro em': formatDate(composer?.partner_attributed_at),
          'LT expira em': formatDate(composer?.partner_lifetime_expires_at),
          'ID do compositor': event.user_id,
        }
      })
    } else {
      fileLabel = 'compras'
      const { data: commissions, error: commissionsError } = await supabaseAdmin
        .from('partner_commissions')
        .select('purchase_id, amount, commission_amount, status, metadata, created_at')
        .eq('partner_id', partner.id)
        .gte('created_at', since)
        .lte('created_at', until)

      if (commissionsError) throw commissionsError

      const composerIds = Array.from(
        new Set((commissions || []).map((row: any) => row.metadata?.composer_id).filter(Boolean))
      )
      const composersById = new Map<string, any>()

      if (composerIds.length) {
        const { data: composers, error: composersError } = await supabaseAdmin
          .from('dccmusic_composers')
          .select('id, name, email')
          .in('id', composerIds)

        if (composersError) throw composersError
        ;(composers || []).forEach((composer: any) => composersById.set(composer.id, composer))
      }

      rows = (commissions || []).map((row: any) => {
        const composerId = row.metadata?.composer_id || ''
        const composer = composersById.get(composerId)
        return {
          'Data da compra': formatDate(row.created_at),
          'Nome': composer?.name || '',
          'E-mail': composer?.email || '',
          'Valor da compra (R$)': formatMoney(Number(row.amount) || 0),
          'Comissao (R$)': formatMoney(Number(row.commission_amount) || 0),
          'Status': row.status || '',
          'Produto': row.metadata?.product_type || '',
          'ID da compra': row.purchase_id || '',
          'ID do compositor': composerId,
        }
      })
    }

    const buffer = createWorkbook(rows, type === 'purchases' ? 'Compras' : 'Cadastros')
    const filename = `dccmusic-${fileLabel}-${startDate}-a-${endDate}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    if (isPartnerSchemaMissing(error)) {
      return NextResponse.json({ error: 'Sistema de parceiros ainda precisa do SQL no Supabase.' }, { status: 500 })
    }
    console.error('[Partner Export] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao exportar relatório' }, { status: 500 })
  }
}
