import { MetadataRoute } from 'next'
import * as db from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

const baseUrl = 'https://www.dccmusic.online'
const pageSize = 1000

const reservedComposerSlugs = new Set([
  'admin',
  'cadastro',
  'checkout',
  'esqueci-senha',
  'featured',
  'login',
  'pagamento',
  'planos',
  'redefinir-senha',
  'trocar-senha',
  'verificar-email',
])

type StudioProjectForSitemap = {
  id: string
  public_slug: string | null
  composer_id: string | null
  published_at: string | null
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Apenas páginas públicas e canônicas com valor de busca.
  // Não usamos new Date() como lastModified nas páginas fixas para não sinalizar
  // falsamente ao Google que todo o site mudou a cada geração do sitemap.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/studio-ia`, changeFrequency: 'weekly', priority: 0.95 },
    { url: `${baseUrl}/transcricao-musical`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/distribuicao-digital`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/videos`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/musicas`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/compositores`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/compositores/planos`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/sobre`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/faq`, changeFrequency: 'monthly', priority: 0.7 },
  ]

  // Carregamos o conteúdo uma única vez para que as mesmas regras de qualidade
  // sejam usadas nas URLs de conteúdo e na decisão de indexar compositores.
  const [musics, videos, studioProjects] = await Promise.all([
    loadMusics(),
    loadVideos(),
    loadPublishedStudioProjects(),
  ])

  const musicRoutes = buildMusicRoutes(musics)
  const videoRoutes = buildVideoRoutes(videos)
  const studioRoutes = buildStudioRoutes(studioProjects)
  const composerRoutes = await buildComposerRoutes(musics, videos, studioProjects)

  return [
    ...staticRoutes,
    ...videoRoutes,
    ...musicRoutes,
    ...studioRoutes,
    ...composerRoutes,
  ]
}

async function loadMusics(): Promise<db.Music[]> {
  try {
    // getMusics já remove músicas sem fonte reproduzível (Spotify/Apple Music).
    return (await db.getMusics()) || []
  } catch (error) {
    console.error('[sitemap] Falha ao listar músicas:', error)
    return []
  }
}

async function loadVideos(): Promise<db.Video[]> {
  try {
    return (await db.getVideos()) || []
  } catch (error) {
    console.error('[sitemap] Falha ao listar vídeos:', error)
    return []
  }
}

function isIndexableVideo(video: db.Video): boolean {
  return Boolean(
    video?.slug &&
      (video.youtubeId?.trim() || video.youtubeUrl?.trim() || video.youtubeEmbed?.trim())
  )
}

function buildMusicRoutes(musics: db.Music[]): MetadataRoute.Sitemap {
  return musics
    .filter((music) => Boolean(music?.slug))
    .map((music) => ({
      url: `${baseUrl}/musicas/${music.slug}`,
      lastModified: music.updatedAt || music.publishedAt || music.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
}

function buildVideoRoutes(videos: db.Video[]): MetadataRoute.Sitemap {
  return videos
    .filter(isIndexableVideo)
    .map((video) => ({
      url: `${baseUrl}/videos/${video.slug}`,
      lastModified: video.updatedAt || video.publishedAt || video.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
}

function buildStudioRoutes(projects: StudioProjectForSitemap[]): MetadataRoute.Sitemap {
  return projects
    .filter((project) => Boolean(project.public_slug))
    .map((project) => ({
      url: `${baseUrl}/studio/${project.public_slug}`,
      ...(project.published_at ? { lastModified: new Date(project.published_at) } : {}),
      changeFrequency: 'monthly' as const,
      priority: 0.65,
    }))
}

async function buildComposerRoutes(
  musics: db.Music[],
  videos: db.Video[],
  studioProjects: StudioProjectForSitemap[]
): Promise<MetadataRoute.Sitemap> {
  try {
    const [composers, musicRelations, videoRelations] = await Promise.all([
      db.getAllComposers(),
      loadRelations('dccmusic_music_composers', 'music_id'),
      loadRelations('dccmusic_video_composers', 'video_id'),
    ])

    const validMusicIds = new Set(musics.filter((music) => music?.slug).map((music) => music.id))
    const validVideoIds = new Set(videos.filter(isIndexableVideo).map((video) => video.id))
    const composerIdsWithContent = new Set<string>()

    for (const relation of musicRelations) {
      if (
        relation.composer_id &&
        relation.music_id &&
        validMusicIds.has(relation.music_id)
      ) {
        composerIdsWithContent.add(relation.composer_id)
      }
    }

    for (const relation of videoRelations) {
      if (
        relation.composer_id &&
        relation.video_id &&
        validVideoIds.has(relation.video_id)
      ) {
        composerIdsWithContent.add(relation.composer_id)
      }
    }

    for (const project of studioProjects) {
      if (project.composer_id) {
        composerIdsWithContent.add(project.composer_id)
      }
    }

    return (composers || [])
      .filter(
        (composer) =>
          Boolean(composer?.slug) &&
          !reservedComposerSlugs.has(composer.slug.toLowerCase()) &&
          composerIdsWithContent.has(composer.id)
      )
      .map((composer) => ({
        url: `${baseUrl}/compositores/${composer.slug}`,
        lastModified: composer.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
  } catch (error) {
    console.error('[sitemap] Falha ao listar compositores com conteúdo:', error)
    return []
  }
}

async function loadRelations(
  table: 'dccmusic_music_composers' | 'dccmusic_video_composers',
  contentColumn: 'music_id' | 'video_id'
): Promise<Array<{ composer_id: string; music_id?: string; video_id?: string }>> {
  const rows: Array<{ composer_id: string; music_id?: string; video_id?: string }> = []
  let from = 0

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(`composer_id, ${contentColumn}`)
      .range(from, from + pageSize - 1)

    if (error) throw error

    const batch = (data || []) as Array<{
      composer_id: string
      music_id?: string
      video_id?: string
    }>
    rows.push(...batch)

    if (batch.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function loadPublishedStudioProjects(): Promise<StudioProjectForSitemap[]> {
  try {
    const projects: StudioProjectForSitemap[] = []
    let from = 0

    for (;;) {
      const { data, error } = await supabaseAdmin
        .from('studio_projects')
        .select('id, public_slug, composer_id, published_at')
        .eq('status', 'published')
        .not('public_slug', 'is', null)
        .range(from, from + pageSize - 1)

      if (error) throw error

      const batch = (data || []) as StudioProjectForSitemap[]
      projects.push(...batch)

      if (batch.length < pageSize) break
      from += pageSize
    }

    if (projects.length === 0) return []

    // A página /studio/[slug] só existe de fato quando há uma versão publicada.
    // Evita enviar ao Google projetos que acabariam em 404.
    const projectIdsWithPublishedVersion = new Set<string>()
    from = 0

    for (;;) {
      const { data, error } = await supabaseAdmin
        .from('studio_versions')
        .select('project_id')
        .eq('is_published', true)
        .range(from, from + pageSize - 1)

      if (error) throw error

      const batch = (data || []) as Array<{ project_id: string }>
      for (const version of batch) {
        if (version.project_id) projectIdsWithPublishedVersion.add(version.project_id)
      }

      if (batch.length < pageSize) break
      from += pageSize
    }

    return projects.filter((project) => projectIdsWithPublishedVersion.has(project.id))
  } catch (error) {
    console.error('[sitemap] Falha ao listar músicas públicas do Studio IA:', error)
    return []
  }
}
