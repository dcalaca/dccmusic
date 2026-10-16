import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getResendReport } from '@/lib/resend-report-server'
import { reportPresetRange, validateReportRange } from '@/lib/resend-report'
export const dynamic = 'force-dynamic'
export const maxDuration = 180
export async function GET(request: NextRequest) {
  if (!await getServerSession(authOptions)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const defaults = reportPresetRange('thisMonth')
  const range = { startDate: request.nextUrl.searchParams.get('startDate') ?? defaults.startDate, endDate: request.nextUrl.searchParams.get('endDate') ?? defaults.endDate }
  try { validateReportRange(range) } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }) }
  try {
    return NextResponse.json(await getResendReport(range), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error: any) {
    console.error('[RESEND REPORT]', error.name, error.message)
    return NextResponse.json({ error: error.name === 'TimeoutError' ? 'O Resend demorou para responder. Tente novamente.' : error.message || 'Erro ao consultar o Resend.' }, { status: 502 })
  }
}
