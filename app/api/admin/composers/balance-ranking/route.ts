import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getStudioAccess, getStudioCreditUsage, STUDIO_MUSIC_CREDITS } from '@/lib/studio'

export const dynamic = 'force-dynamic'

type ComposerRow = {
  id: string
  name: string
  email: string | null
  slug: string
  created_at: string | null
}

type BalanceRankingRow = {
  composerId: string
  name: string
  email: string
  slug: string
  createdAt: string | null
  planName: string | null
  planSlug: string | null
  hasStudioPlan: boolean
  creditsLimit: number
  baseMonthlyCredits: number
  topupCredits: number
  creditsUsed: number
  creditsRemaining: number
  musicBalance: number
  monthKey: string
}

type FailedComposer = {
  composerId: string
  email: string
  error: string
}

async function safeComposerRows() {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id, name, email, slug, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as ComposerRow[]
}

async function buildBalanceRow(composer: ComposerRow): Promise<BalanceRankingRow> {
  const { plan, hasAccess, limits } = await getStudioAccess(composer.id)
  const usage = await getStudioCreditUsage(composer.id, limits)

  return {
    composerId: composer.id,
    name: composer.name,
    email: composer.email || '',
    slug: composer.slug,
    createdAt: composer.created_at || null,
    planName: plan?.name || null,
    planSlug: plan?.slug || null,
    hasStudioPlan: hasAccess,
    creditsLimit: usage.monthlyCredits,
    baseMonthlyCredits: usage.baseMonthlyCredits,
    topupCredits: usage.topupCredits,
    creditsUsed: usage.used,
    creditsRemaining: usage.remaining,
    musicBalance: Math.floor(usage.remaining / STUDIO_MUSIC_CREDITS),
    monthKey: usage.monthKey,
  }
}

function isBalanceRankingRow(row: BalanceRankingRow | null): row is BalanceRankingRow {
  return Boolean(row)
}

async function buildBalanceRanking(composers: ComposerRow[]) {
  const ranking: BalanceRankingRow[] = []
  const failedComposers: FailedComposer[] = []
  const batchSize = 5

  for (let index = 0; index < composers.length; index += batchSize) {
    const batch = composers.slice(index, index + batchSize)
    const rows = await Promise.all(
      batch.map(async (composer) => {
        try {
          return await buildBalanceRow(composer)
        } catch (error: any) {
          console.error('[BALANCE RANKING] Erro em compositor:', {
            composerId: composer.id,
            email: composer.email,
            error: error?.message || error,
          })
          failedComposers.push({
            composerId: composer.id,
            email: composer.email || '',
            error: error?.message || 'Erro desconhecido',
          })
          return null
        }
      })
    )

    ranking.push(...rows.filter(isBalanceRankingRow))
  }

  return { ranking, failedComposers }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const composers = await safeComposerRows()
    const { ranking, failedComposers } = await buildBalanceRanking(composers)

    const sortedRanking = ranking
      .sort((a, b) => {
        if (b.creditsRemaining !== a.creditsRemaining) {
          return b.creditsRemaining - a.creditsRemaining
        }
        return b.creditsLimit - a.creditsLimit
      })
      .map((row, index) => ({
        position: index + 1,
        ...row,
      }))

    return NextResponse.json({
      ranking: sortedRanking,
      totalComposers: sortedRanking.length,
      failedComposers,
      totalCreditsRemaining: sortedRanking.reduce((sum, row) => sum + row.creditsRemaining, 0),
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[BALANCE RANKING] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar ranking de saldos', details: error.message },
      { status: 500 }
    )
  }
}
