import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { canCreateStudioMusicWithCredits, getComposerPremiumAccess, getFreeMusicUsage, getStudioAccess, getStudioCreditUsage } from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'
import { getStudioCampaignState } from '@/lib/studio-campaigns'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { plan, hasAccess, limits } = await getStudioAccess(composer.composerId)
    const usage = await getStudioCreditUsage(composer.composerId, limits)
    const freeMusicUsage = await getFreeMusicUsage(composer.composerId)
    const hasComposerPremiumAccess = await getComposerPremiumAccess(composer.composerId)
    const campaign = getStudioCampaignState()

    const [{ count: totalProjects }, { count: publishedProjects }, { count: draftProjects }] = await Promise.all([
      supabaseAdmin
        .from('studio_projects')
        .select('*', { count: 'exact', head: true })
        .eq('composer_id', composer.composerId),
      supabaseAdmin
        .from('studio_projects')
        .select('*', { count: 'exact', head: true })
        .eq('composer_id', composer.composerId)
        .eq('status', 'published'),
      supabaseAdmin
        .from('studio_projects')
        .select('*', { count: 'exact', head: true })
        .eq('composer_id', composer.composerId)
        .eq('status', 'draft'),
    ])

    const canCreateWithCredits = canCreateStudioMusicWithCredits(usage)
    const canCreateMusic = canCreateWithCredits || freeMusicUsage.remaining > 0

    return NextResponse.json({
      allowed: hasAccess || canCreateMusic,
      canCreateMusic,
      hasStudioPlan: hasAccess,
      hasComposerPremiumAccess,
      canPublish: hasAccess || hasComposerPremiumAccess,
      campaign,
      planName: plan?.name || null,
      credits: {
        limit: usage.monthlyCredits,
        baseLimit: usage.baseMonthlyCredits,
        topupCredits: usage.topupCredits,
        used: usage.used,
        remaining: usage.remaining,
        monthKey: usage.monthKey,
      },
      stats: {
        totalProjects: totalProjects || 0,
        publishedProjects: publishedProjects || 0,
        draftProjects: draftProjects || 0,
        musicGenerations: usage.musicGenerations,
        billableMusicGenerations: usage.billableMusicGenerations,
        musicLimit: usage.musicLimit,
        freeMusicGenerations: freeMusicUsage.used,
        freeMusicLimit: freeMusicUsage.limit,
        freeMusicRemaining: freeMusicUsage.remaining,
        premiumCoverGenerations: usage.premiumCoverGenerations,
        premiumCoverLimit: usage.premiumCoverLimit,
      },
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro status:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar Studio IA' },
      { status: 500 }
    )
  }
}
