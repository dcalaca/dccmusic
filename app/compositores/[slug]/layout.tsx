import type { Metadata } from 'next'
import * as db from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const composer = await db.getComposerBySlug(params.slug)

  if (!composer) {
    return {
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const hasPublicContent = await hasIndexableComposerContent(composer.id)

  return {
    robots: hasPublicContent
      ? {
          index: true,
          follow: true,
        }
      : {
          // Perfis sem obra pública continuam acessíveis para o usuário,
          // mas não entram no índice do Google como conteúdo raso.
          index: false,
          follow: true,
        },
  }
}

async function hasIndexableComposerContent(composerId: string): Promise<boolean> {
  try {
    const [musicRelationsResult, videoRelationsResult, studioProjectsResult] = await Promise.all([
      supabaseAdmin
        .from('dccmusic_music_composers')
        .select('music_id')
        .eq('composer_id', composerId)
        .limit(1000),
      supabaseAdmin
        .from('dccmusic_video_composers')
        .select('video_id')
        .eq('composer_id', composerId)
        .limit(1000),
      supabaseAdmin
        .from('studio_projects')
        .select('id')
        .eq('composer_id', composerId)
        .eq('status', 'published')
        .not('public_slug', 'is', null)
        .limit(1000),
    ])

    // Em falha transitória do banco, mantemos indexação (fail-open) para nunca
    // aplicar noindex por engano a um compositor que tenha conteúdo válido.
    if (
      musicRelationsResult.error ||
      videoRelationsResult.error ||
      studioProjectsResult.error
    ) {
      console.error('[SEO] Falha ao verificar conteúdo do compositor:', {
        composerId,
        musicError: musicRelationsResult.error,
        videoError: videoRelationsResult.error,
        studioError: studioProjectsResult.error,
      })
      return true
    }

    const musicIds = (musicRelationsResult.data || [])
      .map((row: any) => row.music_id)
      .filter(Boolean)
    const videoIds = (videoRelationsResult.data || [])
      .map((row: any) => row.video_id)
      .filter(Boolean)
    const studioProjectIds = (studioProjectsResult.data || [])
      .map((row: any) => row.id)
      .filter(Boolean)

    if (videoIds.length > 0) {
      const { data: videos, error } = await supabaseAdmin
        .from('dccmusic_videos')
        .select('id, slug, youtube_url, youtube_id, youtube_embed')
        .in('id', videoIds)

      if (error) return true

      const hasValidVideo = (videos || []).some(
        (video: any) =>
          Boolean(video?.slug) &&
          Boolean(video?.youtube_id || video?.youtube_url || video?.youtube_embed)
      )

      if (hasValidVideo) return true
    }

    if (musicIds.length > 0) {
      const { data: musics, error } = await supabaseAdmin
        .from('dccmusic_musics')
        .select('id, slug, spotify_url, spotify_embed, apple_music_url, apple_music_embed')
        .in('id', musicIds)

      if (error) return true

      const hasValidMusic = (musics || []).some(
        (music: any) => Boolean(music?.slug) && db.hasPlayableMusicSource(music)
      )

      if (hasValidMusic) return true
    }

    if (studioProjectIds.length > 0) {
      const { data: versions, error } = await supabaseAdmin
        .from('studio_versions')
        .select('project_id')
        .in('project_id', studioProjectIds)
        .eq('is_published', true)
        .limit(1)

      if (error) return true
      if ((versions || []).length > 0) return true
    }

    return false
  } catch (error) {
    console.error('[SEO] Erro inesperado ao verificar conteúdo do compositor:', error)
    return true
  }
}

export default function ComposerPublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
