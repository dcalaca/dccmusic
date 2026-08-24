import { NextRequest, NextResponse } from 'next/server'
import { GET as getOriginalFinance } from '../finance/route'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const response = await getOriginalFinance(request)

  if (!response.ok) {
    return response
  }

  const data = await response.json()

  if (data?.costs) {
    data.costs.resendEmails = 0
    data.costs.cursor = 0

    if (data.costs.fixed) {
      data.costs.fixed.resend = 0
      data.costs.fixed.cursor = 0
      data.costs.fixed.total =
        (Number(data.costs.fixed.supabase) || 0) +
        (Number(data.costs.fixed.vercel) || 0)
    }

    const fixedTotal = Number(data.costs.fixed?.total) || 0
    const variableTotal = Number(data.costs.variable?.total) || 0
    data.costs.total = fixedTotal + variableTotal
  }

  if (data?.costAssumptions) {
    data.costAssumptions.resendMonthlyFixed = 0
    data.costAssumptions.resendPerEmail = 0
    data.costAssumptions.cursorMonthlyFixed = 0
  }

  if (data?.externalBalances?.resend) {
    data.externalBalances.resend.variableCost = 0
    data.externalBalances.resend.fixedCost = 0
    data.externalBalances.resend.estimatedCost = 0
  }

  const totalRevenue = Number(data?.revenue?.total) || 0
  const totalCost = Number(data?.costs?.total) || 0

  if (data?.profit) {
    data.profit.estimated = totalRevenue - totalCost
    data.profit.margin = totalRevenue > 0
      ? ((totalRevenue - totalCost) / totalRevenue) * 100
      : 0
  }

  return NextResponse.json(data, { status: response.status })
}
