import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import {
  deleteComposer,
  getComposerMusicCount,
  getComposerStudioLyricCount,
  getComposerVideoCount,
} from '@/lib/db'
import { getFreeMusicUsage, getStudioAccess, getStudioCreditUsage, STUDIO_MUSIC_CREDITS } from '@/lib/studio'
import { registerComposerAccountDeletionBlock, sendComposerAccountDeletedEmail } from '@/lib/dcc-emails'
import { getComposerStatement } from '@/lib/composer-statement'
import { getStudioCampaignState } from '@/lib/studio-campaigns'
import { getComposerProfilePhotoUrl } from '@/lib/composer-profile-photo'

export const dynamic = 'force-dynamic'

async function getEmbeddedMusicCount(composerId: string) {
  const { data: relations, error: relationsError } = await supabaseAdmin
    .from('dccmusic_music_composers')
    .select('music_id')
    .eq('composer_id', composerId)

  if (relationsError) throw relationsError

  const musicIds = (relations || []).map((relation: any) => relation.music_id).filter(Boolean)
  if (musicIds.length === 0) return 0

  const { data: musics, error: musicsError } = await supabaseAdmin
    .from('dccmusic_musics')
    .select('spotify_embed, apple_music_embed, spotify_url, apple_music_url')
    .in('id', musicIds)

  if (musicsError) throw musicsError

  return (musics || []).filter((music: any) =>
    Boolean(music.spotify_embed || music.apple_music_embed || music.spotify_url || music.apple_music_url)
  ).length
}

async function getStudioReadyMusicCount(composerId: string) {
  const { data: versions, error } = await supabaseAdmin
    .from('studio_versions')
    .select('project_id, audio_url, stream_audio_url')
    .eq('composer_id', composerId)

  if (error) throw error

  const projectIds = new Set<string>()
  ;(versions || []).forEach((version: any) => {
    if (version.project_id && (version.audio_url || version.stream_audio_url)) {
      projectIds.add(version.project_id)
    }
  })

  return projectIds.size
}

export async function GET(request: NextRequest) {
  try {
    const composerToken = getComposerFromRequest(request)
    if (!composerToken) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const composerId = composerToken.composerId

    const { data: composer, error: composerError } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, account_name, name, slug, email, email_verified, is_premium, has_active_subscription, subscription_expires_at, created_at, updated_at')
      .eq('id', composerId)
      .maybeSingle()

    if (composerError) throw composerError
    if (!composer) return NextResponse.json({ error: 'Compositor não encontrado' }, { status: 404 })

    const { data: subscription } = await supabaseAdmin
      .from('dccmusic_subscriptions')
      .select(`
        id,
        status,
        start_date,
        end_date,
        plan:dccmusic_plans(name, slug, price)
      `)
      .eq('composer_id', composerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { plan, hasAccess, limits } = await getStudioAccess(composerId)
    const [usage, freeMusicUsage, studioLyricCount, studioMusicCount, musicCount, videoCount, embeddedMusicCount, statement, profilePhotoUrl] = await Promise.all([
      getStudioCreditUsage(composerId, limits),
      getFreeMusicUsage(composerId),
      getComposerStudioLyricCount(composerId),
      getStudioReadyMusicCount(composerId),
      getComposerMusicCount(composerId),
      getComposerVideoCount(composerId),
      getEmbeddedMusicCount(composerId),
      getComposerStatement(composerId),
      getComposerProfilePhotoUrl(composerId),
    ])

    const subscriptionPlan = Array.isArray((subscription as any)?.plan)
      ? (subscription as any).plan[0]
      : (subscription as any)?.plan
    const currentCreditBalance = Number(statement?.summary?.currentCreditBalance)
    const effectiveCreditsRemaining = Number.isFinite(currentCreditBalance)
      ? Math.max(0, currentCreditBalance)
      : usage.remaining

    return NextResponse.json({
      composer: {
        id: composer.id,
        accountName: composer.account_name || null,
        name: composer.name,
        slug: composer.slug,
        email: composer.email,
        emailVerified: Boolean(composer.email_verified),
        isPremium: Boolean(composer.is_premium),
        hasActiveSubscription: Boolean(composer.has_active_subscription),
        subscriptionExpiresAt: composer.subscription_expires_at,
        profilePhotoUrl,
        createdAt: composer.created_at,
        updatedAt: composer.updated_at,
      },
      plan: {
        status: subscription?.status || (composer.is_premium ? 'active' : 'none'),
        name: subscriptionPlan?.name || plan?.name || null,
        slug: subscriptionPlan?.slug || plan?.slug || null,
        price: subscriptionPlan?.price ?? plan?.price ?? null,
        startDate: subscription?.start_date || null,
        endDate: subscription?.end_date || composer.subscription_expires_at || null,
        hasStudioPlan: hasAccess,
      },
      studio: {
        creditsLimit: usage.monthlyCredits,
        creditsUsed: usage.used,
        creditsRemaining: effectiveCreditsRemaining,
        musicLimit: usage.musicLimit,
        remainingMusicEstimate: Math.floor(effectiveCreditsRemaining / STUDIO_MUSIC_CREDITS),
        totalMusicRemaining: Math.floor(effectiveCreditsRemaining / STUDIO_MUSIC_CREDITS) + freeMusicUsage.remaining,
        freeMusicUsed: freeMusicUsage.used,
        freeMusicRemaining: freeMusicUsage.remaining,
        lyricsCreated: studioLyricCount,
        musicsCreated: studioMusicCount,
      },
      campaign: getStudioCampaignState(),
      catalog: {
        musics: musicCount,
        embeddedMusics: embeddedMusicCount,
        videos: videoCount,
      },
      statement,
    })
  } catch (error: any) {
    console.error('[COMPOSER ME] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar dados do compositor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const composerToken = getComposerFromRequest(request)
    if (!composerToken) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const deletedComposer = await deleteComposer(composerToken.composerId)
    let emailSent = false

    if (deletedComposer.email) {
      await registerComposerAccountDeletionBlock({
        composerId: deletedComposer.id,
        name: deletedComposer.name,
        email: deletedComposer.email,
        source: 'self_service',
      })

      try {
        const result = await sendComposerAccountDeletedEmail({
          composerId: deletedComposer.id,
          name: deletedComposer.name,
          email: deletedComposer.email,
        })
        emailSent = Boolean(result.sent)
      } catch (emailError) {
        console.error('[COMPOSER ME DELETE] Conta excluída, mas falhou ao enviar e-mail:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      emailSent,
    })
  } catch (error: any) {
    console.error('[COMPOSER ME DELETE] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao excluir conta' },
      { status: 500 }
    )
  }
}
