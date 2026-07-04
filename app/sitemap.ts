import { MetadataRoute } from 'next'
import * as db from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

const baseUrl = 'https://www.dccmusic.online'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Páginas fixas principais
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/videos`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/musicas`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/compositores`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/compositores/planos`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/sobre`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ]

  // Páginas de conteúdo (buscadas do banco). Cada bloco é protegido: se falhar,
  // o sitemap ainda retorna as páginas fixas e os demais blocos.
  const [musicRoutes, videoRoutes, composerRoutes] = await Promise.all([
    buildMusicRoutes(),
    buildVideoRoutes(),
    buildComposerRoutes(),
  ])

  return [...staticRoutes, ...videoRoutes, ...musicRoutes, ...composerRoutes]
}

async function buildMusicRoutes(): Promise<MetadataRoute.Sitemap> {
  try {
    const musics = await db.getMusics()
    return (musics || [])
      .filter((music: any) => music?.slug)
      .map((music: any) => ({
        url: `${baseUrl}/musicas/${music.slug}`,
        lastModified: music.updatedAt || music.publishedAt || new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }))
  } catch (error) {
    console.error('[sitemap] Falha ao listar músicas:', error)
    return []
  }
}

async function buildVideoRoutes(): Promise<MetadataRoute.Sitemap> {
  try {
    const videos = await db.getVideos()
    return (videos || [])
      .filter((video: any) => video?.slug)
      .map((video: any) => ({
        url: `${baseUrl}/videos/${video.slug}`,
        lastModified: video.updatedAt || video.publishedAt || new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }))
  } catch (error) {
    console.error('[sitemap] Falha ao listar vídeos:', error)
    return []
  }
}

async function buildComposerRoutes(): Promise<MetadataRoute.Sitemap> {
  try {
    const composers = await db.getAllComposers()
    return (composers || [])
      .filter((composer) => composer?.slug)
      .map((composer) => ({
        url: `${baseUrl}/compositores/${composer.slug}`,
        lastModified: composer.updatedAt || new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
  } catch (error) {
    console.error('[sitemap] Falha ao listar compositores:', error)
    return []
  }
}
