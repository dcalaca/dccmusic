import { supabaseAdmin } from './supabase'
import { getComposerProfilePhotoUrl } from './composer-profile-photo'
import { formatDisplayName, formatMusicTitle } from './normalize'
import { classifyClick } from './bot-detector'

export type ViewType = 'HUMAN_VIEW' | 'BOT_PREVIEW' | 'UNKNOWN'

interface ViewMeta {
  ipAddress?: string | null
  userAgent?: string | null
  referer?: string | null
  accept?: string | null
  acceptLanguage?: string | null
  acceptEncoding?: string | null
}

/**
 * Classifica uma visualização como pessoa real, robô/preview ou indeterminado,
 * reaproveitando o detector de bots usado nos links rastreáveis.
 */
function classifyView(meta?: ViewMeta): {
  viewType: ViewType
  reason: string
  inferredSource: string | null
} {
  const classification = classifyClick({
    userAgent: meta?.userAgent,
    referer: meta?.referer,
    accept: meta?.accept,
    acceptLanguage: meta?.acceptLanguage,
    acceptEncoding: meta?.acceptEncoding,
    ipAddress: meta?.ipAddress,
  })

  const viewType: ViewType =
    classification.type === 'BOT_PREVIEW'
      ? 'BOT_PREVIEW'
      : classification.type === 'HUMAN_CLICK'
        ? 'HUMAN_VIEW'
        : 'UNKNOWN'

  return {
    viewType,
    reason: classification.reason,
    inferredSource: classification.inferredSource || null,
  }
}

// Tipos TypeScript
export interface User {
  id: string
  name?: string | null
  email: string
  emailVerified?: Date | null
  image?: string | null
  password: string
  createdAt: Date
  updatedAt: Date
}

export interface Genre {
  id: string
  name: string
  slug: string
  color?: string | null
  icon?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Video {
  id: string
  title: string
  slug: string
  youtubeUrl: string
  youtubeId: string
  youtubeEmbed?: string | null
  genre?: string | null
  tags?: string | null
  description?: string | null
  publishedAt: Date
  featured: boolean
  thumbnailUrl?: string | null
  duration?: string | null
  viewCount: number
  composers?: Composer[]
  createdAt: Date
  updatedAt: Date
}

export interface Music {
  id: string
  title: string
  slug: string
  genre?: string | null
  spotifyUrl?: string | null
  spotifyEmbed?: string | null
  appleMusicUrl?: string | null
  appleMusicEmbed?: string | null
  tags?: string | null
  description?: string | null
  coverUrl?: string | null
  featured: boolean
  /** Total de aberturas da página pública da música (coluna view_count) */
  viewCount: number
  publishedAt: Date
  composers?: Composer[]
  createdAt: Date
  updatedAt: Date
}

export function hasPlayableMusicSource(music: Partial<Music> | Record<string, any>): boolean {
  const row = music as Record<string, any>
  const spotifyUrl = typeof row.spotifyUrl === 'string' ? row.spotifyUrl : row.spotify_url
  const spotifyEmbed = typeof row.spotifyEmbed === 'string' ? row.spotifyEmbed : row.spotify_embed
  const appleMusicUrl = typeof row.appleMusicUrl === 'string' ? row.appleMusicUrl : row.apple_music_url
  const appleMusicEmbed = typeof row.appleMusicEmbed === 'string' ? row.appleMusicEmbed : row.apple_music_embed

  return [spotifyUrl, spotifyEmbed, appleMusicUrl, appleMusicEmbed].some((value) => (
    typeof value === 'string' && value.trim().length > 0
  ))
}

export interface Composer {
  id: string
  name: string
  slug: string
  email?: string
  emailVerified?: boolean
  emailVerifiedAt?: Date | null
  hasActiveSubscription?: boolean
  subscriptionExpiresAt?: Date | null
  isPremium?: boolean
  publishedMusicCount?: number
  profilePhotoUrl?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Plan {
  id: string
  name: string
  slug: string
  price: number
  durationMonths: number
  description?: string | null
  features?: string[] | null
  featuredMusicsPerMonth?: number | null // Quantidade de músicas em destaque por mês
  hasPriorityFeatured?: boolean // Destaques com prioridade máxima
  hasGoldBadge?: boolean // Selo "Artista Ouro" no perfil
  hasPremiumLayout?: boolean // Layout premium na página do artista
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Subscription {
  id: string
  composerId: string
  planId: string
  status: 'pending' | 'active' | 'expired' | 'cancelled'
  startDate: Date
  endDate: Date
  paymentMethod?: string | null
  paymentId?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Payment {
  id: string
  subscriptionId: string
  composerId: string
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  paymentMethod?: string | null
  paymentGateway?: string | null
  gatewayPaymentId?: string | null
  gatewayResponse?: any
  paidAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

// Funções de conversão de dados (exportadas para uso externo)
export function mapGenre(data: any): Genre {
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    color: data.color,
    icon: data.icon,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  }
}

export async function mapVideo(data: any, includeComposers: boolean = false): Promise<Video> {
  if (!data || !data.id || !data.title) {
    throw new Error(`Dados do vídeo são inválidos: ${JSON.stringify(data)}`)
  }
  
  try {
    let composers: Composer[] = []
    if (includeComposers) {
      try {
        // Primeiro buscar os IDs dos compositores relacionados ao vídeo
        const { data: relationsData, error: relationsError } = await supabaseAdmin
          .from('dccmusic_video_composers')
          .select('composer_id')
          .eq('video_id', data.id)
        
        if (relationsError) {
          console.error('Erro ao buscar relações de compositores:', relationsError, 'Video ID:', data.id)
        } else if (relationsData && Array.isArray(relationsData) && relationsData.length > 0) {
          // Extrair os IDs dos compositores
          const composerIds = relationsData
            .map((r: any) => r.composer_id)
            .filter((id: any) => id)
          
          if (composerIds.length > 0) {
            // Buscar os compositores pelos IDs
            const { data: composersData, error: composersError } = await supabaseAdmin
              .from('dccmusic_composers')
              .select('*')
              .in('id', composerIds)
            
            if (composersError) {
              console.error('Erro ao buscar compositores:', composersError, 'Composer IDs:', composerIds)
            } else if (composersData && Array.isArray(composersData)) {
              composers = composersData
                .filter((c: any) => c && c.id && c.name)
                .map(mapComposer)
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar compositores do vídeo:', error, 'Video ID:', data.id)
      }
    }
    
    return {
      id: String(data.id),
      title: String(data.title),
      slug: String(data.slug || ''),
      youtubeUrl: String(data.youtube_url || ''),
      youtubeId: String(data.youtube_id || ''),
      youtubeEmbed: data.youtube_embed || null,
      genre: data.genre || null,
      tags: data.tags || null,
      description: data.description || null,
      publishedAt: data.published_at ? new Date(data.published_at) : new Date(),
      featured: Boolean(data.featured),
      thumbnailUrl: data.thumbnail_url || null,
      duration: data.duration || null,
      viewCount: Number(data.view_count || 0),
      composers,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(),
      updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
    }
  } catch (error) {
    console.error('Erro ao criar objeto Video:', error, data)
    throw error
  }
}

export async function mapMusic(data: any, includeComposers: boolean = false): Promise<Music> {
  if (!data) {
    throw new Error('Dados da música são inválidos')
  }
  
  let composers: Composer[] = []
  if (includeComposers) {
    try {
      // Primeiro buscar os IDs dos compositores relacionados à música
      const { data: relationsData, error: relationsError } = await supabaseAdmin
        .from('dccmusic_music_composers')
        .select('composer_id')
        .eq('music_id', data.id)
      
      if (relationsError) {
        console.error('Erro ao buscar relações de compositores:', relationsError, 'Music ID:', data.id)
      } else if (relationsData && Array.isArray(relationsData) && relationsData.length > 0) {
        // Extrair os IDs dos compositores
        const composerIds = relationsData
          .map((r: any) => r.composer_id)
          .filter((id: any) => id)
        
        if (composerIds.length > 0) {
          // Buscar os compositores pelos IDs
          const { data: composersData, error: composersError } = await supabaseAdmin
            .from('dccmusic_composers')
            .select('*')
            .in('id', composerIds)
          
          if (composersError) {
            console.error('Erro ao buscar compositores:', composersError, 'Composer IDs:', composerIds)
          } else if (composersData && Array.isArray(composersData)) {
            composers = composersData
              .filter((c: any) => c && c.id && c.name)
              .map(mapComposer)
          }
        }
      }
    } catch (error) {
      console.error('Erro ao buscar compositores da música:', error, 'Music ID:', data.id)
    }
  }
  
  return {
    id: data.id || '',
    title: data.title || '',
    slug: data.slug || '',
    genre: data.genre || null,
    spotifyUrl: data.spotify_url || null,
    spotifyEmbed: data.spotify_embed || null,
    appleMusicUrl: data.apple_music_url || null,
    appleMusicEmbed: data.apple_music_embed || null,
    tags: data.tags || null,
    description: data.description || null,
    coverUrl: data.cover_url || null,
    featured: data.featured || false,
    viewCount: typeof data.view_count === 'number' ? data.view_count : 0,
    publishedAt: data.published_at ? new Date(data.published_at) : new Date(),
    composers,
    createdAt: data.created_at ? new Date(data.created_at) : new Date(),
    updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
  }
}

export function mapUser(data: any): User {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    emailVerified: data.email_verified ? new Date(data.email_verified) : null,
    image: data.image,
    password: data.password_hash || data.password, // Suporta ambos os nomes
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  }
}

// ============================================
// QUERIES - Genres (extraídos dinamicamente)
// ============================================
export async function getGenres() {
  try {
    // Extrair gêneros únicos de vídeos e músicas
    const [videosResult, musicsResult] = await Promise.all([
      supabaseAdmin.from('dccmusic_videos').select('genre'),
      supabaseAdmin.from('dccmusic_musics').select('genre'),
    ])

    const genresSet = new Set<string>()
    
    // Adicionar gêneros de vídeos
    if (videosResult.data) {
      videosResult.data.forEach((v: any) => {
        if (v.genre && typeof v.genre === 'string' && v.genre.trim()) {
          genresSet.add(v.genre.trim())
        }
      })
    }
    
    // Adicionar gêneros de músicas
    if (musicsResult.data) {
      musicsResult.data.forEach((m: any) => {
        if (m.genre && typeof m.genre === 'string' && m.genre.trim()) {
          genresSet.add(m.genre.trim())
        }
      })
    }

    // Converter para array e criar objetos com id, name, slug
    const genres = Array.from(genresSet)
      .sort()
      .map((name, index) => ({
        id: `genre-${index}`,
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      }))

    return genres
  } catch (error) {
    console.error('Erro ao buscar gêneros:', error)
    return []
  }
}

// Buscar gêneros com contagem de vídeos
export async function getGenresWithVideoCount() {
  try {
    const genres = await getGenres()
    
    const genresWithCount = await Promise.all(
      genres.map(async (genre) => {
        try {
          // Usar supabaseAdmin para garantir contagem correta (bypass RLS)
          const { count } = await supabaseAdmin
            .from('dccmusic_videos')
            .select('id', { count: 'exact', head: true })
            .eq('genre', genre.name)
          
          return {
            ...genre,
            count: count || 0,
          }
        } catch (error) {
          console.error(`Erro ao contar vídeos para gênero ${genre.name}:`, error)
          return {
            ...genre,
            count: 0,
          }
        }
      })
    )
    
    return genresWithCount
  } catch (error) {
    console.error('Erro ao buscar gêneros com contagem de vídeos:', error)
    return []
  }
}

// Buscar gêneros com contagem de músicas
export async function getGenresWithMusicCount() {
  try {
    const genres = await getGenres()
    
    const genresWithCount = await Promise.all(
      genres.map(async (genre) => {
        try {
          // Usar supabaseAdmin para garantir contagem correta (bypass RLS)
          const { count } = await supabaseAdmin
            .from('dccmusic_musics')
            .select('id', { count: 'exact', head: true })
            .eq('genre', genre.name)
          
          return {
            ...genre,
            count: count || 0,
          }
        } catch (error) {
          console.error(`Erro ao contar músicas para gênero ${genre.name}:`, error)
          return {
            ...genre,
            count: 0,
          }
        }
      })
    )
    
    return genresWithCount
  } catch (error) {
    console.error('Erro ao buscar gêneros com contagem de músicas:', error)
    return []
  }
}

export async function getGenreById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_genres')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return mapGenre(data)
}

export async function getGenreBySlug(slug: string) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_genres')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) throw error
  return mapGenre(data)
}

export async function createGenre(genre: Omit<Genre, 'id' | 'createdAt' | 'updatedAt'>) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_genres')
    .insert({
      name: genre.name,
      slug: genre.slug,
      color: genre.color,
      icon: genre.icon,
    })
    .select()
    .single()

  if (error) throw error
  return mapGenre(data)
}

export async function updateGenre(id: string, genre: Partial<Omit<Genre, 'id' | 'createdAt' | 'updatedAt'>>) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_genres')
    .update({
      name: genre.name,
      slug: genre.slug,
      color: genre.color,
      icon: genre.icon,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return mapGenre(data)
}

export async function deleteGenre(id: string) {
  const { error } = await supabaseAdmin
    .from('dccmusic_genres')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// Listar TODOS os gêneros (para admin)
// Busca tanto da tabela dccmusic_genres quanto extrai dos conteúdos existentes
export async function getAllGenres(): Promise<Genre[]> {
  try {
    // 1. Buscar gêneros da tabela dccmusic_genres (se existir)
    let tableGenres: Genre[] = []
    try {
      const { data, error } = await supabaseAdmin
        .from('dccmusic_genres')
        .select('*')
        .order('name', { ascending: true })

      if (!error && data) {
        tableGenres = data.map(mapGenre)
      }
    } catch (err) {
      // Tabela pode não existir, continuar
      console.log('Tabela dccmusic_genres não encontrada ou vazia, buscando de músicas/vídeos')
    }

    // 2. Extrair gêneros únicos de vídeos e músicas
    const [videosResult, musicsResult] = await Promise.all([
      supabaseAdmin.from('dccmusic_videos').select('genre'),
      supabaseAdmin.from('dccmusic_musics').select('genre'),
    ])

    const genresSet = new Set<string>()
    
    // Adicionar gêneros de vídeos
    if (videosResult.data) {
      videosResult.data.forEach((v: any) => {
        if (v.genre && typeof v.genre === 'string' && v.genre.trim()) {
          genresSet.add(v.genre.trim())
        }
      })
    }
    
    // Adicionar gêneros de músicas
    if (musicsResult.data) {
      musicsResult.data.forEach((m: any) => {
        if (m.genre && typeof m.genre === 'string' && m.genre.trim()) {
          genresSet.add(m.genre.trim())
        }
      })
    }

    // 3. Criar objetos Genre para gêneros extraídos dos conteúdos
    const contentGenres: Genre[] = Array.from(genresSet)
      .sort()
      .map((name) => {
        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        return {
          id: `content-${slug}`,
          name,
          slug,
          color: null,
          icon: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })

    // 4. Combinar: gêneros da tabela + gêneros dos conteúdos (sem duplicatas)
    const combinedGenres = new Map<string, Genre>()
    
    // Adicionar gêneros da tabela primeiro (têm prioridade)
    tableGenres.forEach((genre) => {
      combinedGenres.set(genre.name.toLowerCase(), genre)
    })
    
    // Adicionar gêneros dos conteúdos (só se não existir na tabela)
    contentGenres.forEach((genre) => {
      if (!combinedGenres.has(genre.name.toLowerCase())) {
        combinedGenres.set(genre.name.toLowerCase(), genre)
      }
    })

    // 5. Converter para array e ordenar
    const result = Array.from(combinedGenres.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    )

    return result
  } catch (error) {
    console.error('Erro ao buscar gêneros:', error)
    return []
  }
}

// ============================================
// QUERIES - Videos
// ============================================
export async function getVideos(filters?: {
  genre?: string | string[]
  ano?: number
  busca?: string
  ordem?: 'recentes' | 'antigos' | 'az'
  featured?: boolean
  limit?: number
  offset?: number
}) {
  try {
    // Desativar destaques expirados antes de buscar
    await deactivateExpiredFeatured()

    // Usar supabaseAdmin para garantir que não há problemas com RLS
    // Buscar TODOS os vídeos primeiro, sem filtros complexos
    let query = supabaseAdmin.from('dccmusic_videos').select('*')

    // Aplicar apenas filtros simples e essenciais
    if (filters?.featured !== undefined) {
      if (filters.featured === true) {
        // Para featured=true, buscar apenas vídeos que têm destaque ativo válido
        // Usar subquery para verificar se há destaque ativo
        query = query.eq('featured', true)
        // O trigger já garante que featured só é true se houver destaque ativo
      } else {
        query = query.eq('featured', false)
      }
    }

    // Ordenação padrão sempre aplicada
    if (filters?.ordem === 'recentes') {
      query = query.order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
    } else if (filters?.ordem === 'antigos') {
      query = query.order('published_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true })
    } else if (filters?.ordem === 'az') {
      query = query.order('title', { ascending: true })
    } else {
      query = query.order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
    }

    // Aplicar paginação apenas se especificado
    if (filters?.limit) {
      if (filters.offset && filters.offset > 0) {
        const end = filters.offset + filters.limit - 1
        query = query.range(filters.offset, end)
      } else {
        query = query.limit(filters.limit)
      }
    }

    const { data, error } = await query

    if (error) {
      console.error('[DB] Erro ao buscar vídeos:', error)
      console.error('[DB] Detalhes do erro:', JSON.stringify(error, null, 2))
      return []
    }
    
    if (!data || !Array.isArray(data)) {
      console.warn('[DB] ⚠️ Dados retornados não são um array:', typeof data, data)
      return []
    }
    
    console.log('[DB] getVideos - Vídeos brutos encontrados:', data.length)
    console.log('[DB] getVideos - Filtros aplicados:', JSON.stringify(filters, null, 2))
    
    // Mapear TODOS os vídeos válidos primeiro
    // Se for featured=true, precisamos carregar compositores para ordenação por prioridade
    const includeComposers = filters?.featured === true // Carregar compositores se for featured
    const mappedVideos: Video[] = []
    
    for (const v of data) {
      if (!v || !v.id || !v.title) {
        continue
      }
      try {
        const mapped = await mapVideo(v, includeComposers)
        mappedVideos.push(mapped)
      } catch (error) {
        console.error('[DB] Erro ao mapear vídeo:', error, v)
        // Continuar mesmo se um vídeo falhar
      }
    }
    
    // Aplicar filtros client-side após buscar todos os dados
    let filteredVideos = mappedVideos
    
    if (filters?.genre) {
      if (Array.isArray(filters.genre)) {
        if (filters.genre.length > 0) {
          filteredVideos = filteredVideos.filter(v => v.genre && filters.genre!.includes(v.genre))
        }
      } else {
        filteredVideos = filteredVideos.filter(v => v.genre === filters.genre)
      }
    }
    
    if (filters?.ano) {
      const ano = filters.ano
      filteredVideos = filteredVideos.filter(v => {
        if (!v.publishedAt) return false
        const videoAno = new Date(v.publishedAt).getFullYear()
        return videoAno === ano
      })
    }
    
    if (filters?.busca) {
      const buscaLower = filters.busca.toLowerCase()
      filteredVideos = filteredVideos.filter(v => 
        v.title.toLowerCase().includes(buscaLower) ||
        (v.tags && v.tags.toLowerCase().includes(buscaLower)) ||
        (v.description && v.description.toLowerCase().includes(buscaLower))
      )
    }
    
    // Se for featured=true, ordenar por prioridade (planos com hasPriorityFeatured primeiro)
    if (filters?.featured === true) {
      // Buscar planos com prioridade para todos os compositores dos vídeos
      const composerIds = new Set<string>()
      for (const video of filteredVideos) {
        if (video.composers) {
          for (const composer of video.composers) {
            composerIds.add(composer.id)
          }
        }
      }
      
      // Buscar planos ativos com prioridade para esses compositores
      const priorityComposerIds = new Set<string>()
      if (composerIds.size > 0) {
        const { data: subscriptions } = await supabaseAdmin
          .from('dccmusic_subscriptions')
          .select(`
            composer_id,
            plan:dccmusic_plans(has_priority_featured)
          `)
          .eq('status', 'active')
          .gte('end_date', new Date().toISOString())
          .in('composer_id', Array.from(composerIds))
        
        if (subscriptions) {
          for (const sub of subscriptions as any[]) {
            const plan = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan
            if (plan && plan.has_priority_featured) {
              priorityComposerIds.add(sub.composer_id)
            }
          }
        }
      }
      
      // Ordenar: vídeos com compositores de planos prioritários primeiro
      // Dentro de cada grupo (prioridade vs não-prioridade), ordenar por data
      filteredVideos.sort((a, b) => {
        const aHasPriority = a.composers?.some(c => priorityComposerIds.has(c.id)) || false
        const bHasPriority = b.composers?.some(c => priorityComposerIds.has(c.id)) || false
        
        // Primeiro critério: prioridade (ouro primeiro)
        if (aHasPriority && !bHasPriority) return -1
        if (!aHasPriority && bHasPriority) return 1
        
        // Segundo critério: se ambos têm ou não têm prioridade, ordenar por data (mais recente primeiro)
        const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
        const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
        return bDate - aDate // DESC: mais recente primeiro
      })
    }
    
    // Aplicar paginação após ordenação por prioridade
    if (filters?.limit) {
      if (filters.offset && filters.offset > 0) {
        filteredVideos = filteredVideos.slice(filters.offset, filters.offset + filters.limit)
      } else {
        filteredVideos = filteredVideos.slice(0, filters.limit)
      }
    }
    
    return filteredVideos
  } catch (error) {
    console.error('Erro ao buscar vídeos:', error)
    return []
  }
}

export async function getVideoById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_videos')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return await mapVideo(data, true)
}

export async function getVideoBySlug(slug: string) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_videos')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) throw error
  return await mapVideo(data, true)
}

export async function incrementVideoViews(id: string) {
  // Usar supabaseAdmin para bypass RLS e garantir que a atualização funcione
  // Usar RPC ou update direto com incremento no banco para evitar problemas de concorrência
  const { data: video, error: fetchError } = await supabaseAdmin
    .from('dccmusic_videos')
    .select('view_count')
    .eq('id', id)
    .single()

  if (fetchError) {
    console.error('Erro ao buscar view_count:', fetchError)
    throw fetchError
  }

  const currentViews = video?.view_count || 0
  const { error: updateError } = await supabaseAdmin
    .from('dccmusic_videos')
    .update({ view_count: currentViews + 1 })
    .eq('id', id)

  if (updateError) {
    console.error('Erro ao incrementar view_count:', updateError)
    throw updateError
  }
}

/** Insere linha de log (se a tabela existir) e incrementa view_count (exceto robôs) */
export async function recordVideoView(
  videoId: string,
  meta?: ViewMeta
): Promise<void> {
  const { viewType, reason, inferredSource } = classifyView(meta)

  const baseRow = {
    video_id: videoId,
    ip_address: meta?.ipAddress || null,
    user_agent: meta?.userAgent || null,
    referer: meta?.referer || null,
  }

  const { error: insertError } = await supabaseAdmin.from('dccmusic_video_views').insert({
    ...baseRow,
    view_type: viewType,
    classification_reason: reason,
    inferred_source: inferredSource,
  })

  if (insertError) {
    // As colunas de classificação podem não existir ainda (SQL não rodado).
    // Tenta registrar ao menos o log básico para não perder a visualização.
    const { error: retryError } = await supabaseAdmin.from('dccmusic_video_views').insert(baseRow)
    if (retryError) {
      console.warn(
        '[recordVideoView] Falha ao registrar log (execute SQL-PROTECAO-BOT-VIEWS.sql se necessário):',
        retryError.message
      )
    }
  }

  // Não inflar: robôs/preview não contam no view_count público.
  if (viewType !== 'BOT_PREVIEW') {
    await incrementVideoViews(videoId)
  }
}

export async function incrementMusicViews(id: string) {
  const { data: row, error: fetchError } = await supabaseAdmin
    .from('dccmusic_musics')
    .select('view_count')
    .eq('id', id)
    .single()

  if (fetchError) {
    console.error('Erro ao buscar view_count (música):', fetchError)
    throw fetchError
  }

  const currentViews = row?.view_count ?? 0
  const { error: updateError } = await supabaseAdmin
    .from('dccmusic_musics')
    .update({ view_count: currentViews + 1 })
    .eq('id', id)

  if (updateError) {
    console.error('Erro ao incrementar view_count (música):', updateError)
    throw updateError
  }
}

/** Log em dccmusic_music_views (se existir) + incremento em view_count (exceto robôs) */
export async function recordMusicView(
  musicId: string,
  meta?: ViewMeta
): Promise<void> {
  const { viewType, reason, inferredSource } = classifyView(meta)

  const baseRow = {
    music_id: musicId,
    ip_address: meta?.ipAddress || null,
    user_agent: meta?.userAgent || null,
    referer: meta?.referer || null,
  }

  const { error: insertError } = await supabaseAdmin.from('dccmusic_music_views').insert({
    ...baseRow,
    view_type: viewType,
    classification_reason: reason,
    inferred_source: inferredSource,
  })

  if (insertError) {
    // As colunas de classificação podem não existir ainda (SQL não rodado).
    // Tenta registrar ao menos o log básico para não perder a visualização.
    const { error: retryError } = await supabaseAdmin.from('dccmusic_music_views').insert(baseRow)
    if (retryError) {
      console.warn(
        '[recordMusicView] Falha ao registrar log (execute SQL-PROTECAO-BOT-VIEWS.sql se necessário):',
        retryError.message
      )
    }
  }

  // Não inflar: robôs/preview não contam no view_count público.
  if (viewType !== 'BOT_PREVIEW') {
    await incrementMusicViews(musicId)
  }
}

export interface AdminMusicViewRow {
  id: string
  musicId: string
  musicTitle: string
  musicSlug: string
  viewedAt: string
  ipAddress?: string | null
  userAgent?: string | null
  referer?: string | null
}

export async function getAdminMusicViewsList(params: {
  page?: number
  limit?: number
  musicId?: string | null
  startDate?: string | null
  endDate?: string | null
}): Promise<{
  rows: AdminMusicViewRow[]
  total: number
  queryError?: string
}> {
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(100, Math.max(1, params.limit || 50))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabaseAdmin
    .from('dccmusic_music_views')
    .select('*', { count: 'exact' })
    .order('viewed_at', { ascending: false })
    .range(from, to)

  if (params.musicId) {
    query = query.eq('music_id', params.musicId)
  }
  if (params.startDate) {
    query = query.gte('viewed_at', `${params.startDate}T00:00:00.000Z`)
  }
  if (params.endDate) {
    const end = new Date(`${params.endDate}T00:00:00.000Z`)
    end.setUTCDate(end.getUTCDate() + 1)
    query = query.lt('viewed_at', end.toISOString())
  }

  const { data: logs, error, count } = await query

  if (error) {
    console.error('getAdminMusicViewsList:', error)
    const msg = (error as { message?: string }).message || String(error)
    return {
      rows: [],
      total: 0,
      queryError: msg,
    }
  }

  const list = logs || []
  if (list.length === 0) {
    return { rows: [], total: count ?? 0 }
  }

  const musicIds = [...new Set(list.map((r: any) => r.music_id).filter(Boolean))]
  const { data: musics } = await supabaseAdmin
    .from('dccmusic_musics')
    .select('id, title, slug')
    .in('id', musicIds)

  const mmap = new Map((musics || []).map((m: any) => [m.id, m]))

  const rows: AdminMusicViewRow[] = list.map((r: any) => {
    const m = mmap.get(r.music_id)
    return {
      id: r.id,
      musicId: r.music_id,
      musicTitle: m?.title || '(música removida)',
      musicSlug: m?.slug || '',
      viewedAt: r.viewed_at,
      ipAddress: r.ip_address,
      userAgent: r.user_agent,
      referer: r.referer,
    }
  })

  return { rows, total: count ?? rows.length }
}

export interface AdminVideoViewRow {
  id: string
  videoId: string
  videoTitle: string
  videoSlug: string
  viewedAt: string
  ipAddress?: string | null
  userAgent?: string | null
  referer?: string | null
}

export async function getAdminVideoViewsList(params: {
  page?: number
  limit?: number
  videoId?: string | null
  startDate?: string | null
  endDate?: string | null
}): Promise<{
  rows: AdminVideoViewRow[]
  total: number
  queryError?: string
}> {
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(100, Math.max(1, params.limit || 50))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabaseAdmin
    .from('dccmusic_video_views')
    .select('*', { count: 'exact' })
    .order('viewed_at', { ascending: false })
    .range(from, to)

  if (params.videoId) {
    query = query.eq('video_id', params.videoId)
  }
  if (params.startDate) {
    query = query.gte('viewed_at', `${params.startDate}T00:00:00.000Z`)
  }
  if (params.endDate) {
    // Incluir o dia inteiro no fuso UTC+12 aproximado: usar início do dia seguinte com .lt
    const end = new Date(`${params.endDate}T00:00:00.000Z`)
    end.setUTCDate(end.getUTCDate() + 1)
    query = query.lt('viewed_at', end.toISOString())
  }

  const { data: logs, error, count } = await query

  if (error) {
    console.error('getAdminVideoViewsList:', error)
    const msg =
      (error as { message?: string }).message || String(error)
    return {
      rows: [],
      total: 0,
      queryError: msg,
    }
  }

  const list = logs || []
  if (list.length === 0) {
    return { rows: [], total: count ?? 0 }
  }

  const videoIds = [...new Set(list.map((r: any) => r.video_id).filter(Boolean))]
  const { data: videos } = await supabaseAdmin
    .from('dccmusic_videos')
    .select('id, title, slug')
    .in('id', videoIds)

  const vmap = new Map((videos || []).map((v: any) => [v.id, v]))

  const rows: AdminVideoViewRow[] = list.map((r: any) => {
    const v = vmap.get(r.video_id)
    return {
      id: r.id,
      videoId: r.video_id,
      videoTitle: v?.title || '(vídeo removido)',
      videoSlug: v?.slug || '',
      viewedAt: r.viewed_at,
      ipAddress: r.ip_address,
      userAgent: r.user_agent,
      referer: r.referer,
    }
  })

  return { rows, total: count ?? rows.length }
}

const ADMIN_VIEWS_EXPORT_MAX = 100_000

/** Todas as linhas do filtro (até ADMIN_VIEWS_EXPORT_MAX), para exportação XLSX. */
export async function getAdminVideoViewsForExport(params: {
  videoId?: string | null
  startDate?: string | null
  endDate?: string | null
}): Promise<{
  rows: AdminVideoViewRow[]
  queryError?: string
  truncated: boolean
}> {
  let query = supabaseAdmin
    .from('dccmusic_video_views')
    .select('*')
    .order('viewed_at', { ascending: false })
    .range(0, ADMIN_VIEWS_EXPORT_MAX - 1)

  if (params.videoId) {
    query = query.eq('video_id', params.videoId)
  }
  if (params.startDate) {
    query = query.gte('viewed_at', `${params.startDate}T00:00:00.000Z`)
  }
  if (params.endDate) {
    const end = new Date(`${params.endDate}T00:00:00.000Z`)
    end.setUTCDate(end.getUTCDate() + 1)
    query = query.lt('viewed_at', end.toISOString())
  }

  const { data: logs, error } = await query

  if (error) {
    console.error('getAdminVideoViewsForExport:', error)
    const msg = (error as { message?: string }).message || String(error)
    return { rows: [], queryError: msg, truncated: false }
  }

  const list = logs || []
  if (list.length === 0) {
    return { rows: [], truncated: false }
  }

  const videoIds = [...new Set(list.map((r: any) => r.video_id).filter(Boolean))]
  const { data: videos } = await supabaseAdmin
    .from('dccmusic_videos')
    .select('id, title, slug')
    .in('id', videoIds)

  const vmap = new Map((videos || []).map((v: any) => [v.id, v]))

  const rows: AdminVideoViewRow[] = list.map((r: any) => {
    const v = vmap.get(r.video_id)
    return {
      id: r.id,
      videoId: r.video_id,
      videoTitle: v?.title || '(vídeo removido)',
      videoSlug: v?.slug || '',
      viewedAt: r.viewed_at,
      ipAddress: r.ip_address,
      userAgent: r.user_agent,
      referer: r.referer,
    }
  })

  return {
    rows,
    truncated: rows.length >= ADMIN_VIEWS_EXPORT_MAX,
  }
}

/** Todas as linhas do filtro (até ADMIN_VIEWS_EXPORT_MAX), para exportação XLSX. */
export async function getAdminMusicViewsForExport(params: {
  musicId?: string | null
  startDate?: string | null
  endDate?: string | null
}): Promise<{
  rows: AdminMusicViewRow[]
  queryError?: string
  truncated: boolean
}> {
  let query = supabaseAdmin
    .from('dccmusic_music_views')
    .select('*')
    .order('viewed_at', { ascending: false })
    .range(0, ADMIN_VIEWS_EXPORT_MAX - 1)

  if (params.musicId) {
    query = query.eq('music_id', params.musicId)
  }
  if (params.startDate) {
    query = query.gte('viewed_at', `${params.startDate}T00:00:00.000Z`)
  }
  if (params.endDate) {
    const end = new Date(`${params.endDate}T00:00:00.000Z`)
    end.setUTCDate(end.getUTCDate() + 1)
    query = query.lt('viewed_at', end.toISOString())
  }

  const { data: logs, error } = await query

  if (error) {
    console.error('getAdminMusicViewsForExport:', error)
    const msg = (error as { message?: string }).message || String(error)
    return { rows: [], queryError: msg, truncated: false }
  }

  const list = logs || []
  if (list.length === 0) {
    return { rows: [], truncated: false }
  }

  const musicIds = [...new Set(list.map((r: any) => r.music_id).filter(Boolean))]
  const { data: musics } = await supabaseAdmin
    .from('dccmusic_musics')
    .select('id, title, slug')
    .in('id', musicIds)

  const mmap = new Map((musics || []).map((m: any) => [m.id, m]))

  const rows: AdminMusicViewRow[] = list.map((r: any) => {
    const m = mmap.get(r.music_id)
    return {
      id: r.id,
      musicId: r.music_id,
      musicTitle: m?.title || '(música removida)',
      musicSlug: m?.slug || '',
      viewedAt: r.viewed_at,
      ipAddress: r.ip_address,
      userAgent: r.user_agent,
      referer: r.referer,
    }
  })

  return {
    rows,
    truncated: rows.length >= ADMIN_VIEWS_EXPORT_MAX,
  }
}

export async function createVideo(video: Omit<Video, 'id' | 'createdAt' | 'updatedAt' | 'viewCount'>) {
  console.log('[DB] Criando vídeo:', { title: video.title, slug: video.slug, composers: video.composers })
  
  // Garantir que published_at nunca seja NULL - usar created_at como fallback
  const publishedAt = video.publishedAt || new Date()
  
  const { data, error } = await supabaseAdmin
    .from('dccmusic_videos')
    .insert({
      title: video.title,
      slug: video.slug,
      youtube_url: video.youtubeUrl,
      youtube_id: video.youtubeId,
      youtube_embed: video.youtubeEmbed || null,
      genre: video.genre || null,
      tags: video.tags,
      description: video.description,
      published_at: publishedAt.toISOString(),
      featured: video.featured,
      thumbnail_url: video.thumbnailUrl,
      duration: video.duration,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[DB] Erro ao criar vídeo:', error)
    throw error
  }
  
  console.log('[DB] Vídeo criado com sucesso:', data?.id)
  
  // Criar compositores se fornecidos
  if (video.composers && video.composers.length > 0) {
    const composerNames = video.composers.map(c => typeof c === 'string' ? c : c.name)
    console.log('[DB] Criando/buscando compositores:', composerNames)
    console.log('[DB] Número de compositores fornecidos:', composerNames.length)
    
    const composers = await createComposersIfNotExist(composerNames)
    console.log('[DB] Compositores encontrados/criados:', composers.length, composers.map(c => ({ id: c.id, name: c.name })))
    
    if (composers.length > 0) {
      const relations = composers.map(c => ({
        video_id: data.id,
        composer_id: c.id,
      }))
      
      console.log('[DB] Criando relações vídeo-compositor:', relations.length, 'relações')
      console.log('[DB] Detalhes das relações:', JSON.stringify(relations, null, 2))
      
      const { data: insertedRelations, error: relationError } = await supabaseAdmin
        .from('dccmusic_video_composers')
        .insert(relations)
        .select('*')
      
      if (relationError) {
        console.error('[DB] ❌ ERRO ao criar relações:', relationError)
        console.error('[DB] Detalhes do erro:', JSON.stringify(relationError, null, 2))
        throw new Error(`Erro ao associar compositores ao vídeo: ${relationError.message}`)
      }
      
      console.log('[DB] ✅ Relações criadas com sucesso:', insertedRelations?.length || 0, 'relações inseridas')
      
      // Verificar se todas as relações foram criadas
      if (insertedRelations && insertedRelations.length !== relations.length) {
        console.warn('[DB] ⚠️ Número de relações criadas não corresponde ao esperado:', {
          esperado: relations.length,
          criado: insertedRelations.length
        })
      }
      
      // Verificar se as relações foram realmente criadas (busca direta)
      const { data: verifyRelations, error: verifyError } = await supabaseAdmin
        .from('dccmusic_video_composers')
        .select('*')
        .eq('video_id', data.id)
      
      if (verifyError) {
        console.error('[DB] Erro ao verificar relações:', verifyError)
      } else {
        console.log('[DB] Verificação: Relações encontradas na tabela:', verifyRelations?.length || 0)
        if (verifyRelations && verifyRelations.length !== relations.length) {
          console.error('[DB] ❌❌❌ PROBLEMA: Número de relações na tabela não corresponde ao esperado!', {
            esperado: relations.length,
            encontrado: verifyRelations.length,
            relações_na_tabela: verifyRelations
          })
        }
      }
    } else {
      console.error('[DB] ❌ ERRO CRÍTICO: Nenhum compositor foi encontrado/criado para associar ao vídeo')
      console.error('[DB] Nomes de compositores fornecidos:', composerNames)
      throw new Error('Não foi possível criar ou encontrar nenhum compositor para associar ao vídeo')
    }
  } else {
    console.error('[DB] ❌ ERRO CRÍTICO: Nenhum compositor fornecido para o vídeo')
    throw new Error('É obrigatório fornecer pelo menos um compositor para o vídeo')
  }
  
  return await mapVideo(data, true)
}

export async function updateVideo(id: string, video: Partial<Omit<Video, 'id' | 'createdAt' | 'updatedAt'>>) {
  const updateData: any = {}
  if (video.title) updateData.title = video.title
  if (video.slug) updateData.slug = video.slug
  if (video.youtubeUrl) updateData.youtube_url = video.youtubeUrl
  if (video.youtubeId) updateData.youtube_id = video.youtubeId
  if (video.youtubeEmbed !== undefined) updateData.youtube_embed = video.youtubeEmbed || null
  if (video.genre !== undefined) updateData.genre = video.genre || null
  if (video.tags !== undefined) updateData.tags = video.tags
  if (video.description !== undefined) updateData.description = video.description
  if (video.publishedAt) updateData.published_at = video.publishedAt.toISOString()
  // featured pode ser atualizado pelo admin (API admin passa esse campo)
  if (video.featured !== undefined) updateData.featured = video.featured
  if (video.thumbnailUrl !== undefined) updateData.thumbnail_url = video.thumbnailUrl
  if (video.duration !== undefined) updateData.duration = video.duration

  const { data, error } = await supabaseAdmin
    .from('dccmusic_videos')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  
  // Atualizar compositores se fornecidos
  if (video.composers !== undefined) {
    // Remover relacionamentos existentes
    await supabaseAdmin
      .from('dccmusic_video_composers')
      .delete()
      .eq('video_id', id)
    
    // Criar novos relacionamentos
    if (video.composers && video.composers.length > 0) {
      const composerNames = video.composers.map(c => typeof c === 'string' ? c : c.name)
      const composers = await createComposersIfNotExist(composerNames)
      
      if (composers.length > 0) {
        const relations = composers.map(c => ({
          video_id: id,
          composer_id: c.id,
        }))
        
        await supabaseAdmin
          .from('dccmusic_video_composers')
          .insert(relations)
      }
    }
  }
  
  return await mapVideo(data, true)
}

export async function deleteVideo(id: string) {
  const { error } = await supabaseAdmin
    .from('dccmusic_videos')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ============================================
// QUERIES - Musics
// ============================================
export async function getMusics(filters?: {
  genre?: string | string[]
  plataforma?: 'spotify' | 'apple'
  busca?: string
  ordem?: 'recentes' | 'antigos' | 'az'
  featured?: boolean
  limit?: number
  offset?: number
}) {
  try {
    // Desativar destaques expirados antes de buscar
    await deactivateExpiredFeatured()

    // Usar supabaseAdmin para garantir que não há problemas com RLS
    // Isso garante que todas as músicas sejam retornadas corretamente
    let query = supabaseAdmin.from('dccmusic_musics').select('*')

    if (filters?.genre) {
      if (Array.isArray(filters.genre)) {
        // Se o array está vazio, não retornar nenhum resultado
        if (filters.genre.length === 0) {
          return []
        }
        query = query.in('genre', filters.genre)
      } else {
        query = query.eq('genre', filters.genre)
      }
    }

    if (filters?.plataforma === 'spotify') {
      query = query.not('spotify_url', 'is', null)
    } else if (filters?.plataforma === 'apple') {
      query = query.not('apple_music_url', 'is', null)
    }

    if (filters?.busca) {
      query = query.or(`title.ilike.%${filters.busca}%,tags.ilike.%${filters.busca}%,description.ilike.%${filters.busca}%`)
    }

    if (filters?.featured !== undefined) {
      if (filters.featured === true) {
        // Para featured=true, buscar apenas músicas que têm destaque ativo válido
        query = query.eq('featured', true)
        // O trigger já garante que featured só é true se houver destaque ativo
      } else {
        query = query.eq('featured', false)
      }
    }

    if (filters?.ordem === 'recentes') {
      // Ordenar por published_at DESC, depois por created_at DESC para ordem determinística
      query = query.order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
    } else if (filters?.ordem === 'antigos') {
      // Ordenar por published_at ASC, depois por created_at ASC para ordem determinística
      query = query.order('published_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true })
    } else if (filters?.ordem === 'az') {
      query = query.order('title', { ascending: true })
    } else {
      // Ordenação padrão: published_at DESC, depois created_at DESC
      query = query.order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
    }

    // Não aplicar paginação aqui - vamos ordenar por prioridade primeiro
    // Aplicar paginação depois de ordenar por prioridade

    const { data, error } = await query

    if (error) {
      console.error('[DB] Erro ao buscar músicas:', error)
      console.error('[DB] Detalhes do erro:', JSON.stringify(error, null, 2))
      return []
    }
    
    if (!data || !Array.isArray(data)) {
      console.warn('[DB] ⚠️ Dados retornados não são um array:', typeof data, data)
      return []
    }
    
    // Mapear TODAS as músicas válidas primeiro
    // Se for featured=true, precisamos carregar compositores para ordenação por prioridade
    const mappedMusics: Music[] = []
    const includeComposers = filters?.featured === true // Carregar compositores se for featured
    for (const m of data) {
      if (!m || !m.id || !m.title) {
        continue
      }
      try {
        const mapped = await mapMusic(m, includeComposers)
        mappedMusics.push(mapped)
      } catch (error) {
        console.error('Erro ao mapear música:', error, m)
        // Continuar mesmo se uma música falhar
      }
    }
    
    // Aplicar filtros client-side após buscar todos os dados
    let filteredMusics = mappedMusics.filter(hasPlayableMusicSource)
    
    if (filters?.genre) {
      if (Array.isArray(filters.genre)) {
        if (filters.genre.length > 0) {
          filteredMusics = filteredMusics.filter(m => m.genre && filters.genre!.includes(m.genre))
        }
      } else {
        filteredMusics = filteredMusics.filter(m => m.genre === filters.genre)
      }
    }
    
    if (filters?.plataforma === 'spotify') {
      filteredMusics = filteredMusics.filter(m => m.spotifyUrl)
    } else if (filters?.plataforma === 'apple') {
      filteredMusics = filteredMusics.filter(m => m.appleMusicUrl)
    }
    
    if (filters?.busca) {
      const buscaLower = filters.busca.toLowerCase()
      filteredMusics = filteredMusics.filter(m => 
        m.title.toLowerCase().includes(buscaLower) ||
        (m.tags && m.tags.toLowerCase().includes(buscaLower)) ||
        (m.description && m.description.toLowerCase().includes(buscaLower))
      )
    }
    
    // Se for featured=true, ordenar por prioridade (planos com hasPriorityFeatured primeiro)
    if (filters?.featured === true) {
      // Buscar planos com prioridade para todos os compositores das músicas
      const composerIds = new Set<string>()
      for (const music of filteredMusics) {
        if (music.composers) {
          for (const composer of music.composers) {
            composerIds.add(composer.id)
          }
        }
      }
      
      // Buscar planos ativos com prioridade para esses compositores
      const priorityComposerIds = new Set<string>()
      if (composerIds.size > 0) {
        const { data: subscriptions } = await supabaseAdmin
          .from('dccmusic_subscriptions')
          .select(`
            composer_id,
            plan:dccmusic_plans(has_priority_featured)
          `)
          .eq('status', 'active')
          .gte('end_date', new Date().toISOString())
          .in('composer_id', Array.from(composerIds))
        
        if (subscriptions) {
          for (const sub of subscriptions as any[]) {
            const plan = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan
            if (plan && plan.has_priority_featured) {
              priorityComposerIds.add(sub.composer_id)
            }
          }
        }
      }
      
      // Ordenar: músicas com compositores de planos prioritários primeiro
      // Dentro de cada grupo (prioridade vs não-prioridade), ordenar por data
      filteredMusics.sort((a, b) => {
        const aHasPriority = a.composers?.some(c => priorityComposerIds.has(c.id)) || false
        const bHasPriority = b.composers?.some(c => priorityComposerIds.has(c.id)) || false
        
        // Primeiro critério: prioridade (ouro primeiro)
        if (aHasPriority && !bHasPriority) return -1
        if (!aHasPriority && bHasPriority) return 1
        
        // Segundo critério: se ambos têm ou não têm prioridade, ordenar por data (mais recente primeiro)
        const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
        const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
        return bDate - aDate // DESC: mais recente primeiro
      })
    }
    
    // Aplicar paginação após ordenação por prioridade
    if (filters?.limit) {
      if (filters.offset && filters.offset > 0) {
        filteredMusics = filteredMusics.slice(filters.offset, filters.offset + filters.limit)
      } else {
        filteredMusics = filteredMusics.slice(0, filters.limit)
      }
    }
    
    return filteredMusics
  } catch (error) {
    console.error('Erro ao buscar músicas:', error)
    return []
  }
}

export async function getMusicById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_musics')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return await mapMusic(data, true)
}

export async function getMusicBySlug(slug: string) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_musics')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) throw error
  return await mapMusic(data, true)
}

// Versão sem cache para garantir dados atualizados
export async function getMusicBySlugFresh(slug: string) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_musics')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) throw error
  return await mapMusic(data, true)
}

export async function createMusic(music: Omit<Music, 'id' | 'createdAt' | 'updatedAt' | 'viewCount'>) {
  const formattedTitle = formatMusicTitle(music.title)
  console.log('[DB] Criando música:', { title: formattedTitle, slug: music.slug, genre: music.genre })
  
  // Preparar dados de inserção
  const insertData: any = {
    title: formattedTitle,
    slug: music.slug,
    genre: music.genre || null,
    spotify_url: music.spotifyUrl || null,
    spotify_embed: music.spotifyEmbed || null,
    apple_music_url: music.appleMusicUrl || null,
    apple_music_embed: music.appleMusicEmbed || null,
    tags: music.tags || null,
    description: music.description || null,
    cover_url: music.coverUrl || null,
    featured: music.featured || false,
    published_at: music.publishedAt.toISOString(),
  }
  
  // Se genre_id é obrigatório, tentar buscar ou criar o gênero
  // Mas primeiro tentar inserir sem genre_id
  const { data, error } = await supabaseAdmin
    .from('dccmusic_musics')
    .insert(insertData)
    .select('*')
    .single()

  if (error) {
    console.error('[DB] Erro ao criar música:', error)
    console.error('[DB] Código do erro:', error.code)
    console.error('[DB] Mensagem:', error.message)
    console.error('[DB] Dados tentados:', insertData)
    
    // Se o erro for relacionado a genre_id, tentar resolver
    if (error.code === '23502' && error.message?.includes('genre_id')) {
      console.log('[DB] Tentando resolver problema de genre_id...')
      // Tentar buscar um gênero padrão ou criar
      // Por enquanto, vamos apenas relançar o erro com mais detalhes
    }
    
    throw new Error(`Erro ao criar música: ${error.message} (Código: ${error.code})`)
  }
  
  
  // Criar compositores se fornecidos
  if (music.composers && music.composers.length > 0) {
    const composerNames = music.composers.map(c => typeof c === 'string' ? c : c.name)
    const composers = await createComposersIfNotExist(composerNames)
    
    if (composers.length > 0) {
      const relations = composers.map(c => ({
        music_id: data.id,
        composer_id: c.id,
      }))
      
      const { data: insertedRelations, error: relationError } = await supabaseAdmin
        .from('dccmusic_music_composers')
        .insert(relations)
        .select('*')
      
      if (relationError) {
        console.error('[DB] ❌ ERRO ao criar relações música-compositor:', relationError)
        console.error('[DB] Detalhes do erro:', JSON.stringify(relationError, null, 2))
        throw new Error(`Erro ao associar compositores à música: ${relationError.message}`)
      }
      
      console.log('[DB] ✅ Relações música-compositor criadas com sucesso:', insertedRelations?.length || 0, 'relações inseridas')
      
      // Verificar se todas as relações foram criadas
      if (insertedRelations && insertedRelations.length !== relations.length) {
        console.warn('[DB] ⚠️ Número de relações criadas não corresponde ao esperado:', {
          esperado: relations.length,
          criado: insertedRelations.length
        })
      }
      
      // Verificar se as relações foram realmente criadas (busca direta)
      const { data: verifyRelations, error: verifyError } = await supabaseAdmin
        .from('dccmusic_music_composers')
        .select('*')
        .eq('music_id', data.id)
      
      if (verifyError) {
        console.error('[DB] Erro ao verificar relações criadas:', verifyError)
      } else {
        console.log('[DB] Verificação: Relações encontradas no banco:', verifyRelations?.length || 0)
      }
    }
  }
  
  return await mapMusic(data, true)
}

export async function updateMusic(id: string, music: Partial<Omit<Music, 'id' | 'createdAt' | 'updatedAt'>>) {
  const updateData: any = {}
  if (music.title !== undefined) updateData.title = formatMusicTitle(music.title)
  if (music.slug !== undefined) updateData.slug = music.slug
  if (music.genre !== undefined) updateData.genre = music.genre || null
  if (music.spotifyUrl !== undefined) updateData.spotify_url = music.spotifyUrl || null
  if (music.spotifyEmbed !== undefined) updateData.spotify_embed = music.spotifyEmbed || null
  if (music.appleMusicUrl !== undefined) updateData.apple_music_url = music.appleMusicUrl || null
  if (music.appleMusicEmbed !== undefined) updateData.apple_music_embed = music.appleMusicEmbed || null
  if (music.tags !== undefined) updateData.tags = music.tags || null
  if (music.description !== undefined) updateData.description = music.description || null
  if (music.coverUrl !== undefined) updateData.cover_url = music.coverUrl || null
  // featured pode ser atualizado pelo admin (API admin passa esse campo)
  if (music.featured !== undefined) updateData.featured = music.featured
  if (music.publishedAt) updateData.published_at = music.publishedAt.toISOString()

  const { data, error } = await supabaseAdmin
    .from('dccmusic_musics')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  
  // Atualizar compositores se fornecidos
  if (music.composers !== undefined) {
    // Remover relacionamentos existentes
    await supabaseAdmin
      .from('dccmusic_music_composers')
      .delete()
      .eq('music_id', id)
    
    // Criar novos relacionamentos
    if (music.composers && music.composers.length > 0) {
      const composerNames = music.composers.map(c => typeof c === 'string' ? c : c.name)
      const composers = await createComposersIfNotExist(composerNames)
      
      if (composers.length > 0) {
        const relations = composers.map(c => ({
          music_id: id,
          composer_id: c.id,
        }))
        
        await supabaseAdmin
          .from('dccmusic_music_composers')
          .insert(relations)
      }
    }
  }
  
  return await mapMusic(data, true)
}

export async function deleteMusic(id: string) {
  const { error } = await supabaseAdmin
    .from('dccmusic_musics')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// Buscar vídeos relacionados
export async function getRelatedVideos(genre: string, excludeId: string, limit: number = 6) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_videos')
    .select('*')
    .eq('genre', genre)
    .neq('id', excludeId)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return Promise.all(data.map((v: any) => mapVideo(v, false)))
}

// Buscar músicas relacionadas
export async function getRelatedMusics(genre: string, excludeId: string, limit: number = 6) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_musics')
    .select('*')
    .eq('genre', genre)
    .neq('id', excludeId)
    .order('published_at', { ascending: false })
    .limit(limit * 4)

  if (error) throw error
  const playableMusics = (data || []).filter(hasPlayableMusicSource).slice(0, limit)
  return Promise.all(playableMusics.map((m: any) => mapMusic(m, false)))
}

// Contar total de registros
export async function countGenres() {
  // Contar gêneros únicos extraídos de vídeos e músicas
  const genres = await getGenres()
  return genres.length
}

export async function countAllVideos() {
  const { count, error } = await supabaseAdmin
    .from('dccmusic_videos')
    .select('id', { count: 'exact', head: true })

  if (error) throw error
  return count || 0
}

export async function countAllMusics() {
  const { count, error } = await supabaseAdmin
    .from('dccmusic_musics')
    .select('id', { count: 'exact', head: true })

  if (error) throw error
  return count || 0
}

// Buscar gêneros com contagem de uso
export async function getGenresWithCount() {
  const genres = await getGenres()

  const genresWithCount = await Promise.all(
    genres.map(async (genre) => {
      const [videosCount, musicsCount] = await Promise.all([
        countVideos({ genre: genre.name }),
        countMusics({ genre: genre.name }),
      ])

      return {
        ...genre,
        _count: {
          videos: videosCount,
          musics: musicsCount,
        },
      }
    })
  )

  return genresWithCount
}

export async function getTopGenres(limit: number = 6) {
  try {
    // Buscar todos os gêneros únicos
    const genres = await getGenres()
    
    if (!genres || genres.length === 0) {
      return []
    }

    // Contar vídeos e músicas por gênero
    const genresWithCount = await Promise.all(
      genres.map(async (genre) => {
        try {
          const [videosResult, musicsResult] = await Promise.all([
            supabaseAdmin.from('dccmusic_videos').select('id', { count: 'exact', head: true }).eq('genre', genre.name),
            supabaseAdmin.from('dccmusic_musics').select('id', { count: 'exact', head: true }).eq('genre', genre.name),
          ])

          const videosCount = videosResult.count || 0
          const musicsCount = musicsResult.count || 0

          return {
            ...genre,
            count: videosCount + musicsCount,
            videosCount,
            musicsCount,
          }
        } catch (error) {
          console.error(`Erro ao contar para gênero ${genre.name}:`, error)
          return {
            ...genre,
            count: 0,
            videosCount: 0,
            musicsCount: 0,
          }
        }
      })
    )

    // Ordenar por count e retornar top N
    return genresWithCount
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  } catch (error) {
    console.error('Erro ao buscar top gêneros:', error)
    return []
  }
}

export async function getVideoYears(): Promise<number[]> {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_videos')
    .select('published_at')

  if (error) throw error

  if (!data || data.length === 0) return []

  const years = new Set(
    data.map((v: any) => new Date(v.published_at).getFullYear())
  )

  return Array.from(years).sort((a, b) => b - a)
}

// Função auxiliar para contar vídeos
export async function countVideos(filters?: {
  genre?: string | string[]
  ano?: number
  busca?: string
  featured?: boolean
}) {
  // Usar supabaseAdmin para garantir contagem correta (bypass RLS)
  let query = supabaseAdmin.from('dccmusic_videos').select('id', { count: 'exact', head: true })

  if (filters?.genre) {
    if (Array.isArray(filters.genre)) {
      // Se o array está vazio, retornar 0
      if (filters.genre.length === 0) {
        return 0
      }
      query = query.in('genre', filters.genre)
    } else {
      query = query.eq('genre', filters.genre)
    }
  }

  if (filters?.ano) {
    const startDate = new Date(filters.ano, 0, 1).toISOString()
    const endDate = new Date(filters.ano, 11, 31, 23, 59, 59).toISOString()
    query = query.gte('published_at', startDate).lte('published_at', endDate)
  }

  if (filters?.busca) {
    query = query.or(`title.ilike.%${filters.busca}%,tags.ilike.%${filters.busca}%,description.ilike.%${filters.busca}%`)
  }

  if (filters?.featured !== undefined) {
    query = query.eq('featured', filters.featured)
  }

  const { count, error } = await query

  if (error) throw error
  return count || 0
}

// Função auxiliar para contar músicas
export async function countMusics(filters?: {
  genre?: string | string[]
  plataforma?: 'spotify' | 'apple'
  busca?: string
  featured?: boolean
}) {
  // Usar supabaseAdmin para garantir contagem correta (bypass RLS)
  let query = supabaseAdmin.from('dccmusic_musics').select('id', { count: 'exact', head: true })

  if (filters?.genre) {
    if (Array.isArray(filters.genre)) {
      // Se o array está vazio, retornar 0
      if (filters.genre.length === 0) {
        return 0
      }
      query = query.in('genre', filters.genre)
    } else {
      query = query.eq('genre', filters.genre)
    }
  }

  if (filters?.plataforma === 'spotify') {
    query = query.not('spotify_url', 'is', null)
  } else if (filters?.plataforma === 'apple') {
    query = query.not('apple_music_url', 'is', null)
  }

  if (filters?.busca) {
    query = query.or(`title.ilike.%${filters.busca}%,tags.ilike.%${filters.busca}%,description.ilike.%${filters.busca}%`)
  }

  if (filters?.featured !== undefined) {
    query = query.eq('featured', filters.featured)
  }

  const { count, error } = await query

  if (error) throw error
  return count || 0
}

// ============================================
// QUERIES - Composers
// ============================================
export function mapComposer(data: any): Composer {
  return {
    id: data.id,
    name: formatDisplayName(data.name),
    slug: data.slug,
    email: data.email || undefined,
    emailVerified: Boolean(data.email_verified),
    emailVerifiedAt: data.email_verified_at ? new Date(data.email_verified_at) : null,
    hasActiveSubscription: data.has_active_subscription || false,
    subscriptionExpiresAt: data.subscription_expires_at ? new Date(data.subscription_expires_at) : null,
    isPremium: data.is_premium || false,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  }
}

export function mapPlan(data: any): Plan {
  try {
    // Garantir que price seja sempre número
    const price = typeof data.price === 'string' ? parseFloat(data.price) : Number(data.price)
    
    // Garantir que is_active seja boolean corretamente
    let isActive = true // default
    if (data.is_active !== undefined && data.is_active !== null) {
      if (typeof data.is_active === 'boolean') {
        isActive = data.is_active
      } else if (typeof data.is_active === 'string') {
        isActive = data.is_active.toLowerCase() === 'true' || data.is_active === '1'
      } else {
        isActive = Boolean(data.is_active)
      }
    }
    
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      price: isNaN(price) ? 0 : price,
      durationMonths: data.duration_months || 12,
      description: data.description || null,
      features: Array.isArray(data.features) ? data.features : [],
      featuredMusicsPerMonth: data.featured_musics_per_month !== undefined && data.featured_musics_per_month !== null ? Number(data.featured_musics_per_month) : null,
      hasPriorityFeatured: data.has_priority_featured !== undefined ? Boolean(data.has_priority_featured) : false,
      hasGoldBadge: data.has_gold_badge !== undefined ? Boolean(data.has_gold_badge) : false,
      hasPremiumLayout: data.has_premium_layout !== undefined ? Boolean(data.has_premium_layout) : false,
      isActive: isActive,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  } catch (error) {
    console.error('[mapPlan] Erro ao mapear plano:', error, 'Data:', data)
    throw error
  }
}

export function mapSubscription(data: any): Subscription {
  return {
    id: data.id,
    composerId: data.composer_id,
    planId: data.plan_id,
    status: data.status,
    startDate: new Date(data.start_date),
    endDate: new Date(data.end_date),
    paymentMethod: data.payment_method,
    paymentId: data.payment_id,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  }
}

export async function getComposers() {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return (data || []).map(mapComposer)
  } catch (error) {
    console.error('Erro ao buscar compositores:', error)
    return []
  }
}

export async function getComposerByName(name: string) {
  const formattedName = formatDisplayName(name)
  const { data, error } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('*')
    .eq('name', formattedName)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data ? mapComposer(data) : null
}

export async function createComposer(name: string): Promise<Composer> {
  const formattedName = formatDisplayName(name)
  const slug = formattedName.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  
  // Tentar buscar primeiro para evitar duplicatas
  const existing = await getComposerByName(formattedName)
  if (existing) {
    return existing
  }

  const { data, error } = await supabaseAdmin
    .from('dccmusic_composers')
    .insert({
      name: formattedName,
      slug,
    })
    .select()
    .single()

  if (error) {
    // Se já existe (por slug ou nome), buscar novamente
    if (error.code === '23505') {
      const existingBySlug = await supabaseAdmin
        .from('dccmusic_composers')
        .select('*')
        .eq('slug', slug)
        .single()
      
      if (existingBySlug.data) {
        return mapComposer(existingBySlug.data)
      }
      
      const existingByName = await getComposerByName(name)
      if (existingByName) {
        return existingByName
      }
    }
    throw error
  }
  
  return mapComposer(data)
}

export async function getComposersByNames(names: string[]): Promise<Composer[]> {
  if (!names || names.length === 0) return []
  
  const trimmedNames = names.map(n => n.trim()).filter(n => n.length > 0)
  if (trimmedNames.length === 0) return []
  
  const { data, error } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('*')
    .in('name', trimmedNames)

  if (error) {
    console.error('Erro ao buscar compositores por nomes:', error)
    return []
  }
  
  return (data || []).map(mapComposer)
}

export async function createComposersIfNotExist(names: string[]): Promise<Composer[]> {
  if (!names || names.length === 0) {
    console.log('[DB] createComposersIfNotExist: lista vazia')
    return []
  }
  
  const trimmedNames = names.map(n => n.trim()).filter(n => n.length > 0)
  if (trimmedNames.length === 0) {
    console.log('[DB] createComposersIfNotExist: nenhum nome válido após trim')
    return []
  }
  
  console.log('[DB] createComposersIfNotExist: processando nomes:', trimmedNames)
  const composers: Composer[] = []
  
  for (const name of trimmedNames) {
    try {
      console.log(`[DB] Tentando criar/buscar compositor: "${name}"`)
      const composer = await createComposer(name)
      console.log(`[DB] Compositor encontrado/criado:`, { id: composer.id, name: composer.name })
      composers.push(composer)
    } catch (error: any) {
      console.error(`[DB] Erro ao criar compositor "${name}":`, error)
      // Tentar buscar novamente
      const existing = await getComposerByName(name)
      if (existing) {
        console.log(`[DB] Compositor encontrado após erro:`, { id: existing.id, name: existing.name })
        composers.push(existing)
      } else {
        console.error(`[DB] Compositor "${name}" não encontrado e não foi possível criar`)
      }
    }
  }
  
  console.log(`[DB] createComposersIfNotExist: retornando ${composers.length} compositores`)
  
  return composers
}

export async function getComposerBySlug(slug: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data ? mapComposer(data) : null
  } catch (error) {
    console.error('Erro ao buscar compositor por slug:', error)
    return null
  }
}

export async function getVideosByComposer(
  composerId: string,
  filters?: {
    genre?: string | string[]
    busca?: string
    ordem?: 'recentes' | 'antigos' | 'az' | 'mais-vistos'
  }
) {
  try {
    // Usar supabaseAdmin para bypassar RLS se necessário
    const { data: relationsData, error: relationsError } = await supabaseAdmin
      .from('dccmusic_video_composers')
      .select('video_id, composer_id')
      .eq('composer_id', composerId)

    if (relationsError) {
      console.error('[DB] Erro ao buscar relações de vídeos:', relationsError)
      return []
    }
    
    if (!relationsData || relationsData.length === 0) {
      return []
    }

    const videoIds = relationsData.map((r: any) => r.video_id).filter((id: any) => id)

    if (videoIds.length === 0) {
      return []
    }

    let videosQuery = supabaseAdmin
      .from('dccmusic_videos')
      .select('*')
      .in('id', videoIds)

    // Buscar TODOS os vídeos primeiro, sem filtros no banco
    // Ordenação apenas
    if (filters?.ordem === 'az') {
      videosQuery = videosQuery.order('title', { ascending: true })
    } else {
      videosQuery = videosQuery.order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
    }

    const { data: videosData, error: videosError } = await videosQuery

    if (videosError) {
      console.error('[DB] Erro ao buscar vídeos do compositor:', videosError)
      return []
    }

    if (!videosData || !Array.isArray(videosData)) {
      return []
    }

    // Mapear TODOS os vídeos válidos
    const videos: Video[] = []
    
    for (const v of videosData) {
      if (!v || !v.id || !v.title) {
        continue
      }
      try {
        const mapped = await mapVideo(v, false)
        videos.push(mapped)
      } catch (error) {
        console.error('[DB] Erro ao mapear vídeo:', error, v)
      }
    }

    // Aplicar filtros client-side apenas se fornecidos
    let filteredVideos = videos
    
    if (filters?.genre) {
      if (Array.isArray(filters.genre)) {
        if (filters.genre.length > 0) {
          filteredVideos = filteredVideos.filter(v => v.genre && filters.genre!.includes(v.genre))
        }
      } else {
        filteredVideos = filteredVideos.filter(v => v.genre === filters.genre)
      }
    }
    
    if (filters?.busca && filters.busca.trim().length > 0) {
      const buscaLower = filters.busca.toLowerCase()
      filteredVideos = filteredVideos.filter(v => 
        v.title.toLowerCase().includes(buscaLower) ||
        (v.tags && v.tags.toLowerCase().includes(buscaLower)) ||
        (v.description && v.description.toLowerCase().includes(buscaLower))
      )
    }

    if (filters?.ordem === 'mais-vistos') {
      filteredVideos.sort((a, b) => {
        const viewDiff = (b.viewCount || 0) - (a.viewCount || 0)
        if (viewDiff !== 0) return viewDiff
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
        return dateB - dateA
      })
    }
    
    return filteredVideos
  } catch (error) {
    console.error('Erro ao buscar vídeos do compositor:', error)
    return []
  }
}

export async function getMusicsByComposer(
  composerId: string,
  filters?: {
    genre?: string | string[]
    busca?: string
    ordem?: 'recentes' | 'antigos' | 'az' | 'mais-vistos'
  }
) {
  try {
    // Buscar TODAS as relações diretamente - mais confiável que fazer duas queries
    // Isso garante que sempre pegamos todas as relações do banco, sem problemas de cache ou RLS
    const { data: relationsData, error: relationsError } = await supabaseAdmin
      .from('dccmusic_music_composers')
      .select('music_id')
      .eq('composer_id', composerId)

    if (relationsError) {
      console.error('[DB] Erro ao buscar relações de músicas:', relationsError)
      return []
    }

    console.log('[DB] Relações encontradas:', relationsData?.length || 0)

    if (!relationsData || relationsData.length === 0) {
      console.log('[DB] Nenhuma relação encontrada para compositor:', composerId)
      return []
    }

    const musicIds = relationsData.map((r: any) => r.music_id).filter((id: any) => id)
    console.log('[DB] IDs de músicas encontrados:', musicIds.length)

    if (musicIds.length === 0) {
      return []
    }

    let musicsQuery = supabaseAdmin
      .from('dccmusic_musics')
      .select('*')
      .in('id', musicIds)

    // Buscar TODAS as músicas primeiro, sem filtros no banco
    // Ordenação apenas
    if (filters?.ordem === 'az') {
      musicsQuery = musicsQuery.order('title', { ascending: true })
    } else {
      musicsQuery = musicsQuery.order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
    }

    const { data: musicsData, error: musicsError } = await musicsQuery

    if (musicsError) {
      console.error('[DB] Erro ao buscar músicas do compositor:', musicsError)
      return []
    }

    if (!musicsData || !Array.isArray(musicsData)) {
      return []
    }

    // Mapear TODAS as músicas válidas
    const musics: Music[] = []
    
    for (const m of musicsData) {
      if (!m || !m.id || !m.title) {
        continue
      }
      try {
        const mapped = await mapMusic(m, false)
        musics.push(mapped)
      } catch (error) {
        console.error('[DB] Erro ao mapear música:', error, m)
      }
    }

    // Aplicar filtros client-side apenas se fornecidos
    let filteredMusics = musics.filter(hasPlayableMusicSource)
    
    if (filters?.genre) {
      if (Array.isArray(filters.genre)) {
        if (filters.genre.length > 0) {
          filteredMusics = filteredMusics.filter(m => m.genre && filters.genre!.includes(m.genre))
        }
      } else {
        filteredMusics = filteredMusics.filter(m => m.genre === filters.genre)
      }
    }
    
    if (filters?.busca && filters.busca.trim().length > 0) {
      const buscaLower = filters.busca.toLowerCase()
      filteredMusics = filteredMusics.filter(m => 
        m.title.toLowerCase().includes(buscaLower) ||
        (m.tags && m.tags.toLowerCase().includes(buscaLower)) ||
        (m.description && m.description.toLowerCase().includes(buscaLower))
      )
    }

    if (filters?.ordem === 'mais-vistos') {
      filteredMusics.sort((a, b) => {
        const viewDiff = (b.viewCount || 0) - (a.viewCount || 0)
        if (viewDiff !== 0) return viewDiff
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
        return dateB - dateA
      })
    }
    
    return filteredMusics
  } catch (error) {
    console.error('Erro ao buscar músicas do compositor:', error)
    return []
  }
}

// ============================================
// QUERIES - Plans & Subscriptions
// ============================================
export async function getPlans() {
  try {
    // Usar supabaseAdmin para garantir acesso mesmo com RLS
    const { data, error } = await supabaseAdmin
      .from('dccmusic_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true })

    if (error) {
      console.error('[getPlans] Erro ao buscar planos:', error)
      throw error
    }
    
    if (!data || data.length === 0) {
      return []
    }
    
    const mappedPlans = (data || []).map(mapPlan)
    // Garantir que apenas planos realmente ativos sejam retornados (double check)
    const activePlans = mappedPlans.filter(plan => plan.isActive === true)
    
    return activePlans
  } catch (error) {
    console.error('[getPlans] Erro ao buscar planos:', error)
    return []
  }
}

export async function getPlanBySlug(slug: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_plans')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data ? mapPlan(data) : null
  } catch (error) {
    console.error('Erro ao buscar plano:', error)
    return null
  }
}

// Buscar TODOS os planos (incluindo inativos) - para admin
export async function getAllPlans(): Promise<Plan[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_plans')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[getAllPlans] Erro do Supabase:', error)
      throw error
    }
    
    if (!data || data.length === 0) {
      console.log('[getAllPlans] Nenhum plano encontrado no banco')
      return []
    }
    
    console.log(`[getAllPlans] Encontrados ${data.length} plano(s)`)
    const plans = data.map(mapPlan)
    return plans
  } catch (error) {
    console.error('[getAllPlans] Erro ao buscar todos os planos:', error)
    return []
  }
}

// Buscar plano por ID - para admin
export async function getPlanById(id: string): Promise<Plan | null> {
  try {
    console.log(`[getPlanById] Buscando plano com ID: ${id}`)
    const { data, error } = await supabaseAdmin
      .from('dccmusic_plans')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error(`[getPlanById] Erro do Supabase:`, error)
      if (error.code !== 'PGRST116') throw error
      return null
    }
    
    if (!data) {
      console.log(`[getPlanById] Plano não encontrado para ID: ${id}`)
      return null
    }
    
    console.log(`[getPlanById] Plano encontrado:`, data.name)
    return mapPlan(data)
  } catch (error) {
    console.error('[getPlanById] Erro ao buscar plano:', error)
    return null
  }
}

// Criar plano - apenas admin
export async function createPlan(plan: {
  name: string
  slug: string
  price: number
  durationMonths: number
  description?: string | null
  features?: string[] | null
  featuredMusicsPerMonth?: number | null
  hasPriorityFeatured?: boolean
  hasGoldBadge?: boolean
  hasPremiumLayout?: boolean
  isActive?: boolean
}): Promise<Plan> {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_plans')
      .insert({
        name: plan.name.trim(),
        slug: plan.slug.trim(),
        price: plan.price,
        duration_months: plan.durationMonths,
        description: plan.description?.trim() || null,
        features: plan.features || [],
        featured_musics_per_month: plan.featuredMusicsPerMonth || null,
        has_priority_featured: plan.hasPriorityFeatured || false,
        has_gold_badge: plan.hasGoldBadge || false,
        has_premium_layout: plan.hasPremiumLayout || false,
        is_active: plan.isActive !== undefined ? plan.isActive : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return mapPlan(data)
  } catch (error) {
    console.error('Erro ao criar plano:', error)
    throw error
  }
}

// Atualizar plano - apenas admin
export async function updatePlan(
  id: string,
  updates: Partial<{
    name: string
    slug: string
    price: number
    durationMonths: number
    description: string | null
    features: string[]
    featuredMusicsPerMonth: number | null
    hasPriorityFeatured: boolean
    hasGoldBadge: boolean
    hasPremiumLayout: boolean
    isActive: boolean
  }>
): Promise<Plan> {
  try {
    console.log(`[updatePlan] Atualizando plano ID: ${id}`, updates)
    
    // Primeiro verificar se o plano existe
    const existingPlan = await getPlanById(id)
    if (!existingPlan) {
      console.error(`[updatePlan] Plano não encontrado: ${id}`)
      const error: any = new Error('Plano não encontrado')
      error.code = 'PGRST116'
      throw error
    }
    
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (updates.name !== undefined) updateData.name = updates.name.trim()
    if (updates.slug !== undefined) updateData.slug = updates.slug.trim()
    if (updates.price !== undefined) updateData.price = updates.price
    if (updates.durationMonths !== undefined) updateData.duration_months = updates.durationMonths
    if (updates.description !== undefined) updateData.description = updates.description?.trim() || null
    if (updates.features !== undefined) updateData.features = updates.features
    if (updates.featuredMusicsPerMonth !== undefined) updateData.featured_musics_per_month = updates.featuredMusicsPerMonth
    if (updates.hasPriorityFeatured !== undefined) updateData.has_priority_featured = updates.hasPriorityFeatured
    if (updates.hasGoldBadge !== undefined) updateData.has_gold_badge = updates.hasGoldBadge
    if (updates.hasPremiumLayout !== undefined) updateData.has_premium_layout = updates.hasPremiumLayout
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive

    console.log(`[updatePlan] Dados para atualizar:`, updateData)

    const { data, error } = await supabaseAdmin
      .from('dccmusic_plans')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error(`[updatePlan] Erro do Supabase:`, error)
      throw error
    }
    
    if (!data) {
      console.error(`[updatePlan] Nenhum dado retornado após atualização`)
      const error: any = new Error('Plano não encontrado após atualização')
      error.code = 'PGRST116'
      throw error
    }
    
    console.log(`[updatePlan] Plano atualizado com sucesso`)
    return mapPlan(data)
  } catch (error) {
    console.error('[updatePlan] Erro ao atualizar plano:', error)
    throw error
  }
}

// Deletar plano - apenas admin (soft delete marcando como inativo)
export async function deletePlan(id: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('dccmusic_plans')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error
  } catch (error) {
    console.error('Erro ao deletar plano:', error)
    throw error
  }
}

export async function getComposerActiveSubscription(composerId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_subscriptions')
      .select('*')
      .eq('composer_id', composerId)
      .eq('status', 'active')
      .gt('end_date', new Date().toISOString())
      .order('end_date', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data ? mapSubscription(data) : null
  } catch (error) {
    console.error('Erro ao buscar assinatura ativa:', error)
    return null
  }
}

export async function checkComposerHasActiveSubscription(composerId: string): Promise<boolean> {
  try {
    const subscription = await getComposerActiveSubscription(composerId)
    return subscription !== null
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error)
    return false
  }
}

export async function getPremiumComposers() {
  try {
    // Buscar compositores premium com assinatura ativa
    // Verificar tanto has_active_subscription quanto subscription_expires_at
    const { data, error } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('*')
      .eq('is_premium', true)
      .eq('has_active_subscription', true)
      .gte('subscription_expires_at', new Date().toISOString()) // Assinatura não expirada
      .order('name', { ascending: true })

    if (error) {
      console.error('Erro ao buscar compositores premium:', error)
      throw error
    }
    
    
    // Filtrar também no código para garantir (caso a query não funcione perfeitamente)
    const now = new Date()
    const activeComposers = (data || []).filter((composer: any) => {
      if (!composer.has_active_subscription) return false
      if (!composer.subscription_expires_at) return false
      const expiresAt = new Date(composer.subscription_expires_at)
      return expiresAt > now
    })
    
    const composers = activeComposers.map(mapComposer)
    const composerIds = composers.map((composer) => composer.id)

    if (composerIds.length === 0) return composers

    const [musicRelationsResult, studioProjectsResult] = await Promise.all([
      supabaseAdmin
        .from('dccmusic_music_composers')
        .select('composer_id, music_id')
        .in('composer_id', composerIds),
      supabaseAdmin
        .from('studio_projects')
        .select('composer_id, id')
        .in('composer_id', composerIds)
        .eq('status', 'published'),
    ])

    if (musicRelationsResult.error) {
      console.error('Erro ao buscar contagem de músicas dos compositores:', musicRelationsResult.error)
    }
    if (studioProjectsResult.error) {
      console.error('Erro ao buscar contagem de músicas Studio dos compositores:', studioProjectsResult.error)
    }

    const musicCounts = new Map<string, Set<string>>()
    for (const relation of musicRelationsResult.data || []) {
      if (!relation.composer_id || !relation.music_id) continue
      if (!musicCounts.has(relation.composer_id)) {
        musicCounts.set(relation.composer_id, new Set())
      }
      musicCounts.get(relation.composer_id)?.add(relation.music_id)
    }

    const studioCounts = new Map<string, number>()
    for (const project of studioProjectsResult.data || []) {
      if (!project.composer_id) continue
      studioCounts.set(project.composer_id, (studioCounts.get(project.composer_id) || 0) + 1)
    }

    const composersWithCounts = await Promise.all(composers.map(async (composer) => ({
        ...composer,
        publishedMusicCount: (musicCounts.get(composer.id)?.size || 0) + (studioCounts.get(composer.id) || 0),
        profilePhotoUrl: await getComposerProfilePhotoUrl(composer.id),
      })))

    return composersWithCounts.sort((a, b) => {
      const countDiff = (b.publishedMusicCount || 0) - (a.publishedMusicCount || 0)
      if (countDiff !== 0) return countDiff
      return a.name.localeCompare(b.name, 'pt-BR')
    })
  } catch (error) {
    console.error('Erro ao buscar compositores premium:', error)
    return []
  }
}

// Listar TODOS os compositores (para admin)
export async function getAllComposers(): Promise<Composer[]> {
  try {
    const pageSize = 1000
    let from = 0
    const allRows: any[] = []

    for (;;) {
      const { data, error } = await supabaseAdmin
        .from('dccmusic_composers')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1)

      if (error) {
        console.error('Erro ao buscar compositores:', error)
        throw error
      }

      const batch = data || []
      allRows.push(...batch)

      if (batch.length < pageSize) break
      from += pageSize
    }

    return allRows.map(mapComposer)
  } catch (error) {
    console.error('Erro ao buscar compositores:', error)
    return []
  }
}

export type AdminComposerStatusFilter = 'all' | 'active' | 'inactive' | 'studio' | 'pending'

export type AdminComposersSummary = {
  total: number
  active: number
  inactive: number
  pendingEmail: number
  withStudio: number
  studioLyrics: number
  studioMusics: number
}

async function collectComposerIdsWithStudioActivity() {
  const ids = new Set<string>()
  const pageSize = 1000

  for (const table of ['studio_lyrics', 'studio_generations'] as const) {
    let from = 0

    for (;;) {
      let query = supabaseAdmin
        .from(table)
        .select('composer_id')
        .range(from, from + pageSize - 1)

      if (table === 'studio_generations') {
        query = query.neq('status', 'failed')
      }

      const { data, error } = await query
      if (error) throw error
      if (!data?.length) break

      data.forEach((row: any) => {
        if (row.composer_id) ids.add(row.composer_id)
      })

      if (data.length < pageSize) break
      from += pageSize
    }
  }

  return Array.from(ids)
}

export async function getAdminComposersSummary(): Promise<AdminComposersSummary> {
  const now = new Date().toISOString()

  const [
    totalResult,
    activeResult,
    pendingResult,
    lyricsResult,
    musicsResult,
    studioComposerIds,
  ] = await Promise.all([
    supabaseAdmin.from('dccmusic_composers').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('dccmusic_composers')
      .select('*', { count: 'exact', head: true })
      .eq('has_active_subscription', true)
      .eq('is_premium', true)
      .or(`subscription_expires_at.is.null,subscription_expires_at.gt.${now}`),
    supabaseAdmin
      .from('dccmusic_composers')
      .select('*', { count: 'exact', head: true })
      .not('email', 'is', null)
      .eq('email_verified', false),
    supabaseAdmin.from('studio_lyrics').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('studio_generations').select('*', { count: 'exact', head: true }).neq('status', 'failed'),
    collectComposerIdsWithStudioActivity(),
  ])

  const total = totalResult.count || 0
  const active = activeResult.count || 0

  return {
    total,
    active,
    inactive: Math.max(0, total - active),
    pendingEmail: pendingResult.count || 0,
    withStudio: studioComposerIds.length,
    studioLyrics: lyricsResult.count || 0,
    studioMusics: musicsResult.count || 0,
  }
}

function applyAdminComposerStatusFilter(
  query: any,
  status: AdminComposerStatusFilter,
  studioComposerIds?: string[]
) {
  const now = new Date().toISOString()

  if (status === 'active') {
    return query
      .eq('has_active_subscription', true)
      .eq('is_premium', true)
      .or(`subscription_expires_at.is.null,subscription_expires_at.gt.${now}`)
  }

  if (status === 'inactive') {
    return query.or(
      `has_active_subscription.eq.false,is_premium.eq.false,and(subscription_expires_at.not.is.null,subscription_expires_at.lt.${now})`
    )
  }

  if (status === 'pending') {
    return query.not('email', 'is', null).eq('email_verified', false)
  }

  if (status === 'studio') {
    const ids = studioComposerIds || []
    if (ids.length === 0) {
      return query.eq('id', '00000000-0000-0000-0000-000000000000')
    }
    return query.in('id', ids)
  }

  return query
}

export async function listAdminComposers(options: {
  page?: number
  limit?: number
  search?: string
  status?: AdminComposerStatusFilter
}): Promise<{ items: Composer[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, Number(options.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 100))
  const search = String(options.search || '').trim()
  const status = options.status || 'all'
  const from = (page - 1) * limit
  const to = from + limit - 1

  const studioComposerIds = status === 'studio' ? await collectComposerIdsWithStudioActivity() : undefined

  let query = supabaseAdmin
    .from('dccmusic_composers')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (search) {
    const safeSearch = search.replace(/[%_,]/g, '')
    const pattern = `%${safeSearch}%`
    query = query.or(`name.ilike.${pattern},email.ilike.${pattern},slug.ilike.${pattern}`)
  }

  query = applyAdminComposerStatusFilter(query, status, studioComposerIds)
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw error

  return {
    items: (data || []).map(mapComposer),
    total: count || 0,
    page,
    limit,
  }
}

// Buscar compositor por ID
export async function getComposerById(id: string): Promise<Composer | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    return data ? mapComposer(data) : null
  } catch (error) {
    console.error('Erro ao buscar compositor por ID:', error)
    return null
  }
}

// Buscar contagem de vídeos por compositor
export async function getComposerVideoCount(composerId: string): Promise<number> {
  try {
    const { count, error } = await supabaseAdmin
      .from('dccmusic_video_composers')
      .select('*', { count: 'exact', head: true })
      .eq('composer_id', composerId)

    if (error) {
      console.error('Erro ao contar vídeos do compositor:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('Erro ao contar vídeos do compositor:', error)
    return 0
  }
}

// Buscar contagem de músicas por compositor
export async function getComposerMusicCount(composerId: string): Promise<number> {
  try {
    const { count, error } = await supabaseAdmin
      .from('dccmusic_music_composers')
      .select('*', { count: 'exact', head: true })
      .eq('composer_id', composerId)

    if (error) {
      console.error('Erro ao contar músicas do compositor:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('Erro ao contar músicas do compositor:', error)
    return 0
  }
}

// Buscar total de visualizações por compositor (soma de view_count dos vídeos)
export async function getComposerTotalViews(composerId: string): Promise<number> {
  try {
    // Buscar todos os vídeos do compositor
    const { data: videoRelations, error: relationsError } = await supabaseAdmin
      .from('dccmusic_video_composers')
      .select('video_id')
      .eq('composer_id', composerId)

    if (relationsError) {
      console.error('Erro ao buscar relações de vídeos:', relationsError)
      return 0
    }

    if (!videoRelations || videoRelations.length === 0) {
      return 0
    }

    const videoIds = videoRelations.map((r: any) => r.video_id)

    // Buscar view_count de todos os vídeos
    const { data: videos, error: videosError } = await supabaseAdmin
      .from('dccmusic_videos')
      .select('view_count')
      .in('id', videoIds)

    if (videosError) {
      console.error('Erro ao buscar visualizações dos vídeos:', videosError)
      return 0
    }

    const totalViews = (videos || []).reduce((sum: number, video: any) => {
      return sum + (Number(video.view_count) || 0)
    }, 0)

    return totalViews
  } catch (error) {
    console.error('Erro ao calcular visualizações do compositor:', error)
    return 0
  }
}

// Atualizar compositor
export async function updateComposer(
  id: string,
  updates: Partial<{
    name: string
    slug: string
    email: string | null
  }>
): Promise<Composer> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (updates.name !== undefined) {
      updateData.name = formatDisplayName(updates.name)
    }

    if (updates.slug !== undefined) {
      updateData.slug = updates.slug.trim()
    }

    if (updates.email !== undefined) {
      updateData.email = updates.email?.trim() || null
    }

    // Se o nome mudou mas o slug não foi fornecido, gerar slug automaticamente
    if (updates.name && !updates.slug) {
      updateData.slug = formatDisplayName(updates.name)
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
    }

    const { data, error } = await supabaseAdmin
      .from('dccmusic_composers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return mapComposer(data)
  } catch (error) {
    console.error('Erro ao atualizar compositor:', error)
    throw error
  }
}

function isMissingOptionalTableError(error: any) {
  const message = String(error?.message || error?.details || '')
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    message.includes('Could not find the table') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  )
}

async function deleteComposerRows(table: string, column: string, value: string, optional = false) {
  const { error } = await supabaseAdmin
    .from(table)
    .delete()
    .eq(column, value)

  if (error) {
    if (optional && isMissingOptionalTableError(error)) {
      return
    }
    throw error
  }
}

// Excluir compositor e dados ligados à conta.
// Músicas/vídeos públicos não são apagados; apenas a relação com o compositor.
export async function deleteComposer(id: string): Promise<Composer> {
  const composer = await getComposerById(id)
  if (!composer) {
    throw new Error('Compositor não encontrado')
  }

  try {
    const optionalDeletes: Array<Promise<void>> = []

    if (composer.email) {
      optionalDeletes.push(deleteComposerRows('dccmusic_email_events', 'recipient', composer.email, true))
    }

    // Logs administrativos podem guardar o composerId no metadata, mas não devem bloquear a exclusão.
    const { error: emailEventsMetadataError } = await supabaseAdmin
      .from('dccmusic_email_events')
      .delete()
      .contains('metadata', { composerId: id })
    if (emailEventsMetadataError && !isMissingOptionalTableError(emailEventsMetadataError)) {
      throw emailEventsMetadataError
    }

    await Promise.all(optionalDeletes)

    const dependentTables = [
      'composer_password_resets',
      'composer_email_verifications',
      'studio_credit_topups',
      'studio_video_requests',
      'studio_covers',
      'studio_versions',
      'studio_generations',
      'studio_lyrics',
      'studio_credit_transactions',
      'studio_projects',
      'dccmusic_payments',
      'dccmusic_subscriptions',
      'dccmusic_music_composers',
      'dccmusic_video_composers',
    ]

    for (const table of dependentTables) {
      await deleteComposerRows(table, 'composer_id', id, true)
    }

    const { error } = await supabaseAdmin
      .from('dccmusic_composers')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return composer
  } catch (error) {
    console.error('Erro ao excluir compositor:', error)
    throw error
  }
}

// Interface estendida para compositor com estatísticas
export interface ComposerWithStats extends Composer {
  videoCount: number
  musicCount: number
  totalViews: number
  studioLyricCount: number
  studioMusicCount: number
}

// Buscar contagem de letras criadas no Studio IA por compositor
export async function getComposerStudioLyricCount(composerId: string): Promise<number> {
  try {
    const { count, error } = await supabaseAdmin
      .from('studio_lyrics')
      .select('*', { count: 'exact', head: true })
      .eq('composer_id', composerId)

    if (error) {
      console.error('Erro ao contar letras Studio IA do compositor:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('Erro ao contar letras Studio IA do compositor:', error)
    return 0
  }
}

// Buscar contagem de músicas geradas no Studio IA por compositor
export async function getComposerStudioMusicCount(composerId: string): Promise<number> {
  try {
    const { count, error } = await supabaseAdmin
      .from('studio_generations')
      .select('*', { count: 'exact', head: true })
      .eq('composer_id', composerId)
      .neq('status', 'failed')

    if (error) {
      console.error('Erro ao contar músicas Studio IA do compositor:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('Erro ao contar músicas Studio IA do compositor:', error)
    return 0
  }
}

// Buscar todos os compositores com estatísticas
export async function getAllComposersWithStats(): Promise<ComposerWithStats[]> {
  try {
    const composers = await getAllComposers()
    
    const composersWithStats = await Promise.all(
      composers.map(async (composer) => {
        const [videoCount, musicCount, totalViews, studioLyricCount, studioMusicCount] = await Promise.all([
          getComposerVideoCount(composer.id),
          getComposerMusicCount(composer.id),
          getComposerTotalViews(composer.id),
          getComposerStudioLyricCount(composer.id),
          getComposerStudioMusicCount(composer.id),
        ])

        return {
          ...composer,
          videoCount,
          musicCount,
          totalViews,
          studioLyricCount,
          studioMusicCount,
        }
      })
    )

    return composersWithStats
  } catch (error) {
    console.error('Erro ao buscar compositores com estatísticas:', error)
    return []
  }
}

// Buscar plano ativo de um compositor
export async function getComposerActivePlan(composerId: string): Promise<Plan | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_subscriptions')
      .select(`
        *,
        plan:dccmusic_plans(*)
      `)
      .eq('composer_id', composerId)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .order('end_date', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Nenhuma assinatura ativa encontrada
      }
      throw error
    }

    if (!data || !data.plan) {
      return null
    }

    return mapPlan(data.plan)
  } catch (error) {
    console.error('[getComposerActivePlan] Erro ao buscar plano ativo:', error)
    return null
  }
}

// Liberar acesso de graça para um compositor
export async function grantFreeAccessToComposer(
  composerId: string,
  durationYears: number = 10
): Promise<void> {
  try {
    // Buscar o plano anual
    const { data: planData, error: planError } = await supabaseAdmin
      .from('dccmusic_plans')
      .select('id')
      .eq('slug', 'plano-anual-compositor')
      .single()

    if (planError || !planData) {
      throw new Error('Plano anual não encontrado')
    }

    const planId = planData.id
    const startDate = new Date()
    const endDate = new Date()
    endDate.setFullYear(endDate.getFullYear() + durationYears)

    // Criar ou atualizar assinatura
    const { data: existingSubscription, error: subCheckError } = await supabaseAdmin
      .from('dccmusic_subscriptions')
      .select('id')
      .eq('composer_id', composerId)
      .eq('plan_id', planId)
      .eq('status', 'active')
      .single()

    if (existingSubscription) {
      // Atualizar assinatura existente
      const { error: updateError } = await supabaseAdmin
        .from('dccmusic_subscriptions')
        .update({
          status: 'active',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          payment_method: 'manual',
          payment_id: `admin-free-${Date.now()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSubscription.id)

      if (updateError) {
        throw updateError
      }
    } else {
      // Criar nova assinatura
      const { error: insertError } = await supabaseAdmin
        .from('dccmusic_subscriptions')
        .insert({
          composer_id: composerId,
          plan_id: planId,
          status: 'active',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          payment_method: 'manual',
          payment_id: `admin-free-${Date.now()}`,
        })

      if (insertError) {
        throw insertError
      }
    }

    // Atualizar campos do compositor diretamente (o trigger também fará isso, mas garantimos)
    const { error: composerUpdateError } = await supabaseAdmin
      .from('dccmusic_composers')
      .update({
        is_premium: true,
        has_active_subscription: true,
        subscription_expires_at: endDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', composerId)

    if (composerUpdateError) {
      throw composerUpdateError
    }
  } catch (error) {
    console.error('Erro ao liberar acesso:', error)
    throw error
  }
}

// Revogar acesso de um compositor
export async function revokeComposerAccess(composerId: string): Promise<void> {
  try {
    // Desativar todas as assinaturas ativas
    const { error: subError } = await supabaseAdmin
      .from('dccmusic_subscriptions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('composer_id', composerId)
      .eq('status', 'active')

    if (subError) {
      throw subError
    }

    // Atualizar campos do compositor
    const { error: composerUpdateError } = await supabaseAdmin
      .from('dccmusic_composers')
      .update({
        is_premium: false,
        has_active_subscription: false,
        subscription_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', composerId)

    if (composerUpdateError) {
      throw composerUpdateError
    }
  } catch (error) {
    console.error('Erro ao revogar acesso:', error)
    throw error
  }
}

// ============================================
// QUERIES - Users
// ============================================
export async function getUserByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_users')
    .select('*')
    .eq('email', email)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data ? mapUser(data) : null
}

export async function createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) {
  // Usa password_hash se a tabela tiver essa coluna (estrutura real do Supabase)
  const insertData: any = {
    name: user.name,
    email: user.email,
    password_hash: user.password,
    email_verified: user.emailVerified?.toISOString(),
    image: user.image,
  }
  
  const { data, error } = await supabaseAdmin
    .from('dccmusic_users')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    // Fallback: se não tiver password_hash, tenta password
    if (error.message?.includes('password_hash') || error.code === '42703') {
      delete insertData.password_hash
      insertData.password = user.password
      const { data: retryData, error: retryError } = await supabaseAdmin
        .from('dccmusic_users')
        .insert(insertData)
        .select()
        .single()
      if (retryError) throw retryError
      return mapUser(retryData)
    }
    throw error
  }
  return mapUser(data)
}

// ============================================
// ANALYTICS & STATISTICS
// ============================================

// Buscar top vídeos mais vistos
export async function getTopViewedVideos(limit: number = 10): Promise<Video[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_videos')
      .select('*')
      .order('view_count', { ascending: false })
      .limit(limit)

    if (error) throw error
    if (!data || !Array.isArray(data)) return []

    const mappedVideos = await Promise.all(
      data.map((v: any) => mapVideo(v, false))
    )

    return mappedVideos
  } catch (error) {
    console.error('Erro ao buscar top vídeos:', error)
    return []
  }
}

export async function getTopViewedMusics(limit: number = 10): Promise<Music[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_musics')
      .select('*')
      .order('view_count', { ascending: false, nullsFirst: false })
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    if (!data || !Array.isArray(data)) return []

    const mapped = await Promise.all(data.map((m: any) => mapMusic(m, false)))
    return mapped
  } catch (error) {
    console.error('Erro ao buscar top músicas:', error)
    return []
  }
}

// Buscar total de visualizações
export async function getTotalViews(): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_videos')
      .select('view_count')

    if (error) throw error
    if (!data || !Array.isArray(data)) return 0

    const total = data.reduce((sum: number, video: any) => {
      return sum + (video.view_count || 0)
    }, 0)

    return total
  } catch (error) {
    console.error('Erro ao calcular total de visualizações:', error)
    return 0
  }
}

export async function getTotalMusicViews(): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin.from('dccmusic_musics').select('view_count')

    if (error) throw error
    if (!data || !Array.isArray(data)) return 0

    return data.reduce((sum: number, row: any) => sum + (row.view_count || 0), 0)
  } catch (error) {
    console.error('Erro ao calcular total de visualizações (músicas):', error)
    return 0
  }
}

// Buscar estatísticas gerais do site
export interface SiteStats {
  totalVideos: number
  totalMusics: number
  totalViews: number
  totalMusicViews: number
  averageViewsPerVideo: number
  averageViewsPerMusic: number
  topVideos: Video[]
  topMusics: Music[]
  featuredVideosCount: number
  featuredMusicsCount: number
}

export async function getSiteStats(): Promise<SiteStats> {
  try {
    const [
      videosCount,
      musicsCount,
      totalViews,
      totalMusicViews,
      topVideos,
      topMusics,
      featuredVideosCount,
      featuredMusicsCount
    ] = await Promise.all([
      countAllVideos(),
      countAllMusics(),
      getTotalViews(),
      getTotalMusicViews(),
      getTopViewedVideos(5),
      getTopViewedMusics(5),
      countVideos({ featured: true }),
      countMusics({ featured: true })
    ])

    const averageViewsPerVideo = videosCount > 0 
      ? Math.round(totalViews / videosCount) 
      : 0
    const averageViewsPerMusic = musicsCount > 0
      ? Math.round(totalMusicViews / musicsCount)
      : 0

    return {
      totalVideos: videosCount,
      totalMusics: musicsCount,
      totalViews,
      totalMusicViews,
      averageViewsPerVideo,
      averageViewsPerMusic,
      topVideos,
      topMusics,
      featuredVideosCount,
      featuredMusicsCount
    }
  } catch (error) {
    console.error('Erro ao buscar estatísticas do site:', error)
    return {
      totalVideos: 0,
      totalMusics: 0,
      totalViews: 0,
      totalMusicViews: 0,
      averageViewsPerVideo: 0,
      averageViewsPerMusic: 0,
      topVideos: [],
      topMusics: [],
      featuredVideosCount: 0,
      featuredMusicsCount: 0
    }
  }
}

// ============================================
// QUERIES - Tracked Links (Links Rastreáveis)
// ============================================

export interface TrackedLink {
  id: string
  title: string
  destinationUrl: string
  shortCode: string
  createdBy?: string | null
  notes?: string | null
  expiresAt?: Date | null
  isActive: boolean
  clickCount: number
  createdAt: Date
  updatedAt: Date
}

export interface LinkClick {
  id: string
  linkId: string
  ipAddress?: string | null
  userAgent?: string | null
  referer?: string | null
  clickedAt: Date
  country?: string | null
  city?: string | null
  browser?: string | null
  browserVersion?: string | null
  operatingSystem?: string | null
  osVersion?: string | null
  deviceType?: string | null
  language?: string | null
  queryParams?: string | null
  region?: string | null
  // Novos campos para detecção de bots
  clickType?: 'BOT_PREVIEW' | 'HUMAN_CLICK' | 'UNKNOWN' | null
  classificationReason?: string | null
  inferredSource?: string | null
  relatedPreviewId?: string | null
  // Campos de geolocalização
  asn?: string | null
  isp?: string | null
  latitude?: number | null
  longitude?: number | null
  ipMasked?: string | null
}

export interface TrackedLinkStats extends TrackedLink {
  totalClicks: number
  uniqueClicks: number
  clicks: LinkClick[]
  // Novas métricas separadas
  humanClicks: number
  botPreviews: number
  unknownClicks: number
  uniqueHumanClicks: number
  conversionRate: number // Taxa de conversão baseada em humanos
}

// Função auxiliar para contar cliques humanos de um link
async function getHumanClickCount(linkId: string): Promise<number> {
  try {
    const { count, error } = await supabaseAdmin
      .from('dccmusic_link_clicks')
      .select('*', { count: 'exact', head: true })
      .eq('link_id', linkId)
      .eq('click_type', 'HUMAN_CLICK')
    
    if (error) {
      console.error('Erro ao contar cliques humanos:', error)
      return 0
    }
    
    return count || 0
  } catch (error) {
    console.error('Erro ao contar cliques humanos:', error)
    return 0
  }
}

// Função auxiliar para contar todos os cliques (incluindo bots) - para compatibilidade
async function getRealClickCount(linkId: string): Promise<number> {
  try {
    const { count, error } = await supabaseAdmin
      .from('dccmusic_link_clicks')
      .select('*', { count: 'exact', head: true })
      .eq('link_id', linkId)
    
    if (error) {
      console.error('Erro ao contar cliques:', error)
      return 0
    }
    
    return count || 0
  } catch (error) {
    console.error('Erro ao contar cliques:', error)
    return 0
  }
}

function mapTrackedLink(data: any): TrackedLink {
  return {
    id: data.id,
    title: data.title,
    destinationUrl: data.destination_url,
    shortCode: data.short_code,
    createdBy: data.created_by || null,
    notes: data.notes || null,
    expiresAt: data.expires_at ? new Date(data.expires_at) : null,
    isActive: data.is_active !== false,
    clickCount: 0, // Será atualizado depois com contagem real
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  }
}

function mapLinkClick(data: any): LinkClick {
  return {
    id: data.id,
    linkId: data.link_id,
    ipAddress: data.ip_address || null,
    userAgent: data.user_agent || null,
    referer: data.referer || null,
    clickedAt: new Date(data.clicked_at),
    country: data.country || null,
    city: data.city || null,
    browser: data.browser || null,
    browserVersion: data.browser_version || null,
    operatingSystem: data.operating_system || null,
    osVersion: data.os_version || null,
    deviceType: data.device_type || null,
    language: data.language || null,
    queryParams: data.query_params || null,
    region: data.region || null,
    // Novos campos
    clickType: data.click_type || null,
    classificationReason: data.classification_reason || null,
    inferredSource: data.inferred_source || null,
    relatedPreviewId: data.related_preview_id || null,
    asn: data.asn || null,
    isp: data.isp || null,
    latitude: data.latitude ? parseFloat(data.latitude) : null,
    longitude: data.longitude ? parseFloat(data.longitude) : null,
    ipMasked: data.ip_masked || null,
  }
}

// Gerar código curto único
async function generateShortCode(): Promise<string> {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  
  // Tentar gerar código único (máximo 10 tentativas)
  for (let attempt = 0; attempt < 10; attempt++) {
    code = ''
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    
    // Verificar se já existe
    const { data, error } = await supabaseAdmin
      .from('dccmusic_tracked_links')
      .select('id')
      .eq('short_code', code)
      .single()
    
    if (error && error.code === 'PGRST116') {
      // Código não existe, podemos usar
      return code
    }
  }
  
  // Se não conseguiu em 10 tentativas, usar timestamp + random
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6)
}

// Criar link rastreável
export async function createTrackedLink(data: {
  title: string
  destinationUrl: string
  createdBy?: string
  notes?: string
  expiresAt?: Date
}): Promise<TrackedLink> {
  const shortCode = await generateShortCode()
  
  const insertData: any = {
    title: data.title,
    destination_url: data.destinationUrl,
    short_code: shortCode,
    created_by: data.createdBy || null,
    notes: data.notes || null,
    expires_at: data.expiresAt ? data.expiresAt.toISOString() : null,
    is_active: true,
  }
  
  const { data: result, error } = await supabaseAdmin
    .from('dccmusic_tracked_links')
    .insert(insertData)
    .select()
    .single()
  
  if (error) throw error
  return mapTrackedLink(result)
}

// Buscar link por código curto
export async function getTrackedLinkByShortCode(shortCode: string): Promise<TrackedLink | null> {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_tracked_links')
    .select('*')
    .eq('short_code', shortCode)
    .eq('is_active', true)
    .single()
  
  if (error && error.code === 'PGRST116') return null
  if (error) throw error
  
  // Verificar se expirou
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null
  }
  
  const mapped = mapTrackedLink(data)
  // Contar cliques humanos (não bots)
  mapped.clickCount = await getHumanClickCount(data.id)
  return mapped
}

// Registrar clique em um link
export async function registerLinkClick(linkId: string, clickData: {
  ipAddress?: string
  userAgent?: string
  referer?: string
  country?: string
  city?: string
  browser?: string
  browserVersion?: string
  operatingSystem?: string
  osVersion?: string
  deviceType?: string
  language?: string
  queryParams?: string
  region?: string
  // Novos campos
  clickType?: 'BOT_PREVIEW' | 'HUMAN_CLICK' | 'UNKNOWN'
  classificationReason?: string
  inferredSource?: string
  relatedPreviewId?: string
  asn?: string
  isp?: string
  latitude?: number
  longitude?: number
  ipMasked?: string
}): Promise<string> {
  const insertData: any = {
    link_id: linkId,
    ip_address: clickData.ipAddress || null,
    user_agent: clickData.userAgent || null,
    referer: clickData.referer || null,
    country: clickData.country || null,
    city: clickData.city || null,
    browser: clickData.browser || null,
    browser_version: clickData.browserVersion || null,
    operating_system: clickData.operatingSystem || null,
    os_version: clickData.osVersion || null,
    device_type: clickData.deviceType || null,
    language: clickData.language || null,
    query_params: clickData.queryParams || null,
    region: clickData.region || null,
    // Novos campos
    click_type: clickData.clickType || 'UNKNOWN',
    classification_reason: clickData.classificationReason || null,
    inferred_source: clickData.inferredSource || null,
    related_preview_id: clickData.relatedPreviewId || null,
    asn: clickData.asn || null,
    isp: clickData.isp || null,
    latitude: clickData.latitude || null,
    longitude: clickData.longitude || null,
    ip_masked: clickData.ipMasked || null,
  }
  
  const { data, error } = await supabaseAdmin
    .from('dccmusic_link_clicks')
    .insert(insertData)
    .select('id')
    .single()
  
  if (error) {
    console.error('Erro ao registrar clique:', error)
    throw error
  }
  
  return data.id
}

// Buscar estatísticas de um link
export async function getTrackedLinkStats(shortCode: string): Promise<TrackedLinkStats | null> {
  const link = await getTrackedLinkByShortCode(shortCode)
  if (!link) return null
  
  // Buscar todos os cliques
  const { data: clicks, error: clicksError } = await supabaseAdmin
    .from('dccmusic_link_clicks')
    .select('*')
    .eq('link_id', link.id)
    .order('clicked_at', { ascending: false })
  
  if (clicksError) throw clicksError
  
  const mappedClicks = (clicks || []).map(mapLinkClick)
  
  // Calcular métricas separadas
  const humanClicks = mappedClicks.filter(c => c.clickType === 'HUMAN_CLICK')
  const botPreviews = mappedClicks.filter(c => c.clickType === 'BOT_PREVIEW')
  const unknownClicks = mappedClicks.filter(c => c.clickType === 'UNKNOWN' || !c.clickType)
  
  // Cliques únicos humanos (por IP)
  const uniqueHumanIPs = new Set(
    humanClicks
      .map(c => c.ipAddress)
      .filter(ip => ip)
  )
  
  // Taxa de conversão (cliques únicos humanos / total de hits)
  const totalHits = mappedClicks.length
  const conversionRate = totalHits > 0 
    ? Math.round((uniqueHumanIPs.size / totalHits) * 100) / 100 
    : 0
  
  return {
    ...link,
    totalClicks: totalHits,
    uniqueClicks: uniqueHumanIPs.size, // Agora representa cliques únicos humanos
    clicks: mappedClicks,
    humanClicks: humanClicks.length,
    botPreviews: botPreviews.length,
    unknownClicks: unknownClicks.length,
    uniqueHumanClicks: uniqueHumanIPs.size,
    conversionRate,
  }
}

// Listar todos os links de um criador
export async function getTrackedLinksByCreator(createdBy: string): Promise<TrackedLink[]> {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_tracked_links')
    .select('*')
    .eq('created_by', createdBy)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  
  // Contar cliques reais para cada link diretamente da tabela dccmusic_link_clicks
  const linksWithCounts = await Promise.all(
    (data || []).map(async (link: any) => {
      const mapped = mapTrackedLink(link)
      // Contar cliques humanos (não bots)
      mapped.clickCount = await getHumanClickCount(link.id)
      return mapped
    })
  )
  
  return linksWithCounts
}

// Agrega contagem de cliques humanos por link (PostgREST limita ~1000 linhas por select sem paginar)
async function buildHumanClickCountByLinkMap(): Promise<Map<string, number>> {
  const clickCountMap = new Map<string, number>()
  const pageSize = 1000
  let from = 0

  for (;;) {
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('dccmusic_link_clicks')
      .select('link_id')
      .eq('click_type', 'HUMAN_CLICK')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (batchError) {
      console.error('Erro ao agregar cliques (lote):', batchError)
      break
    }
    if (!batch?.length) break

    batch.forEach((click: any) => {
      const linkId = click.link_id
      if (linkId) {
        clickCountMap.set(linkId, (clickCountMap.get(linkId) || 0) + 1)
      }
    })

    if (batch.length < pageSize) break
    from += pageSize
  }

  return clickCountMap
}

// Listar TODOS os links (para admin)
export async function getAllTrackedLinks(): Promise<TrackedLink[]> {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_tracked_links')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Erro ao buscar links:', error)
    throw error
  }
  
  const clickCountMap = await buildHumanClickCountByLinkMap()
  
  // Mesma métrica que getHumanClickCount / tela de estatísticas (cliques humanos)
  const linksWithCounts = (data || []).map((link: any) => {
    const mapped = mapTrackedLink(link)
    mapped.clickCount = clickCountMap.get(link.id) || 0
    return mapped
  })
  
  return linksWithCounts
}

// Atualizar link
export async function updateTrackedLink(
  id: string,
  updates: Partial<{
    title: string
    destinationUrl: string
    notes: string
    expiresAt: Date | null
    isActive: boolean
  }>
): Promise<TrackedLink> {
  const updateData: any = {}
  
  if (updates.title !== undefined) updateData.title = updates.title
  if (updates.destinationUrl !== undefined) updateData.destination_url = updates.destinationUrl
  if (updates.notes !== undefined) updateData.notes = updates.notes || null
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive
  
  // Tratar expiresAt - pode ser Date, null ou undefined
  if (updates.expiresAt !== undefined) {
    if (updates.expiresAt === null) {
      updateData.expires_at = null
    } else if (updates.expiresAt instanceof Date) {
      updateData.expires_at = updates.expiresAt.toISOString()
    } else {
      // Se for string, tentar converter
      try {
        updateData.expires_at = new Date(updates.expiresAt).toISOString()
      } catch {
        updateData.expires_at = null
      }
    }
  }
  
  const { data, error } = await supabaseAdmin
    .from('dccmusic_tracked_links')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    console.error('Erro ao atualizar link:', error)
    throw error
  }
  
  const mapped = mapTrackedLink(data)
  // Atualizar contador de cliques real
  mapped.clickCount = await getRealClickCount(data.id)
  return mapped
}

// ============================================
// QUERIES - Site Users (Usuários Normais)
// ============================================

export interface SiteUser {
  id: string
  name: string
  email: string
  firstName: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

function mapSiteUser(data: any): SiteUser {
  const formattedName = formatDisplayName(data.name)
  return {
    id: data.id,
    name: formattedName,
    email: data.email,
    firstName: formatDisplayName(data.first_name || data.firstName || formattedName.split(' ')[0]),
    isActive: data.is_active !== false,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  }
}

export async function getSiteUserByEmail(email: string): Promise<SiteUser | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_site_users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('is_active', true)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar usuário:', error)
      return null
    }

    return data ? mapSiteUser(data) : null
  } catch (error) {
    console.error('Erro ao buscar usuário:', error)
    return null
  }
}

export async function getSiteUserById(id: string): Promise<SiteUser | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_site_users')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar usuário:', error)
      return null
    }

    return data ? mapSiteUser(data) : null
  } catch (error) {
    console.error('Erro ao buscar usuário:', error)
    return null
  }
}

export async function createSiteUser(
  name: string,
  email: string,
  passwordHash: string
): Promise<SiteUser> {
  try {
    const formattedName = formatDisplayName(name)
    const { data, error } = await supabaseAdmin
      .from('dccmusic_site_users')
      .insert({
        name: formattedName,
        first_name: formattedName.split(' ')[0],
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
      })
      .select()
      .single()

    if (error) {
      // Se já existe, retornar o existente
      if (error.code === '23505') {
        const existing = await getSiteUserByEmail(email)
        if (existing) {
          throw new Error('Email já cadastrado')
        }
      }
      throw error
    }

    return mapSiteUser(data)
  } catch (error: any) {
    console.error('Erro ao criar usuário:', error)
    throw error
  }
}

// ============================================
// QUERIES - Ratings (Avaliações)
// ============================================

export interface Rating {
  id: string
  userId: string
  contentType: 'music' | 'video'
  contentId: string
  rating: number // 1 a 5
  createdAt: Date
  updatedAt: Date
}

function mapRating(data: any): Rating {
  return {
    id: data.id,
    userId: data.user_id,
    contentType: data.content_type,
    contentId: data.content_id,
    rating: data.rating,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  }
}

export interface RatingStats {
  averageRating: number
  totalRatings: number
  ratingDistribution: {
    1: number
    2: number
    3: number
    4: number
    5: number
  }
  userRating?: number // Rating do usuário logado (se houver)
}

export type RateableContentType = 'music' | 'video' | 'studio_music'

export async function getRatingStats(
  contentType: RateableContentType,
  contentId: string,
  userId?: string
): Promise<RatingStats> {
  try {
    const { data: ratings, error } = await supabaseAdmin
      .from('dccmusic_ratings')
      .select('*')
      .eq('content_type', contentType)
      .eq('content_id', contentId)

    if (error) {
      console.error('Erro ao buscar avaliações:', error)
      return {
        averageRating: 0,
        totalRatings: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      }
    }

    const ratingsList = (ratings || []).map(mapRating)
    const totalRatings = ratingsList.length

    if (totalRatings === 0) {
      return {
        averageRating: 0,
        totalRatings: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      }
    }

    const sum = ratingsList.reduce((acc, r) => acc + r.rating, 0)
    const averageRating = sum / totalRatings

    const distribution = {
      1: ratingsList.filter((r) => r.rating === 1).length,
      2: ratingsList.filter((r) => r.rating === 2).length,
      3: ratingsList.filter((r) => r.rating === 3).length,
      4: ratingsList.filter((r) => r.rating === 4).length,
      5: ratingsList.filter((r) => r.rating === 5).length,
    }

    const userRating = userId
      ? ratingsList.find((r) => r.userId === userId)?.rating
      : undefined

    return {
      averageRating: Math.round(averageRating * 10) / 10, // Arredondar para 1 casa decimal
      totalRatings,
      ratingDistribution: distribution,
      userRating,
    }
  } catch (error) {
    console.error('Erro ao calcular estatísticas de avaliação:', error)
    return {
      averageRating: 0,
      totalRatings: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    }
  }
}

export async function createOrUpdateRating(
  userId: string,
  contentType: RateableContentType,
  contentId: string,
  rating: number
): Promise<Rating> {
  try {
    // Verificar se já existe avaliação
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('dccmusic_ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('content_type', contentType)
      .eq('content_id', contentId)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError
    }

    if (existing) {
      // Atualizar avaliação existente
      const { data, error } = await supabaseAdmin
        .from('dccmusic_ratings')
        .update({
          rating,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      return mapRating(data)
    } else {
      // Criar nova avaliação
      const { data, error } = await supabaseAdmin
        .from('dccmusic_ratings')
        .insert({
          user_id: userId,
          content_type: contentType,
          content_id: contentId,
          rating,
        })
        .select()
        .single()

      if (error) throw error
      return mapRating(data)
    }
  } catch (error: any) {
    console.error('Erro ao criar/atualizar avaliação:', error)
    throw error
  }
}

export async function deleteRating(
  userId: string,
  contentType: RateableContentType,
  contentId: string
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('dccmusic_ratings')
      .delete()
      .eq('user_id', userId)
      .eq('content_type', contentType)
      .eq('content_id', contentId)

    if (error) throw error
  } catch (error: any) {
    console.error('Erro ao deletar avaliação:', error)
    throw error
  }
}

// ============================================
// QUERIES - Comments (Comentários)
// ============================================

export interface Comment {
  id: string
  userId: string
  userName: string
  userFirstName: string
  contentType: RateableContentType
  contentId: string
  comment: string
  isApproved: boolean
  createdAt: Date
  updatedAt: Date
}

function mapComment(data: any, userName?: string, userFirstName?: string): Comment {
  return {
    id: data.id,
    userId: data.user_id,
    userName: userName || 'Usuário',
    userFirstName: userFirstName || 'Usuário',
    contentType: data.content_type,
    contentId: data.content_id,
    comment: data.comment,
    isApproved: data.is_approved !== false,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  }
}

export async function getComments(
  contentType: RateableContentType,
  contentId: string
): Promise<Comment[]> {
  try {
    const { data: comments, error } = await supabaseAdmin
      .from('dccmusic_comments')
      .select('*')
      .eq('content_type', contentType)
      .eq('content_id', contentId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar comentários:', error)
      return []
    }

    // Buscar informações dos usuários
    const userIds = [...new Set((comments || []).map((c: any) => c.user_id))]
    if (userIds.length === 0) return []

    const { data: users, error: usersError } = await supabaseAdmin
      .from('dccmusic_site_users')
      .select('id, name, first_name')
      .in('id', userIds)

    if (usersError) {
      console.error('Erro ao buscar usuários:', usersError)
    }

    const usersMap = new Map(
      (users || []).map((u: any) => {
        const formattedName = formatDisplayName(u.name)
        return [u.id, {
          name: formattedName,
          firstName: formatDisplayName(u.first_name || formattedName.split(' ')[0]),
        }]
      })
    )

    return (comments || []).map((comment: any) => {
      const user = usersMap.get(comment.user_id)
      return mapComment(comment, user?.name, user?.firstName)
    })
  } catch (error) {
    console.error('Erro ao buscar comentários:', error)
    return []
  }
}

export async function createComment(
  userId: string,
  contentType: RateableContentType,
  contentId: string,
  comment: string
): Promise<Comment> {
  try {
    // Buscar informações do usuário
    const user = await getSiteUserById(userId)
    if (!user) {
      throw new Error('Usuário não encontrado')
    }

    const { data, error } = await supabaseAdmin
      .from('dccmusic_comments')
      .insert({
        user_id: userId,
        content_type: contentType,
        content_id: contentId,
        comment: comment.trim(),
        is_approved: true, // Por padrão aprovado, pode adicionar moderação depois
      })
      .select()
      .single()

    if (error) throw error

    return mapComment(data, user.name, user.firstName)
  } catch (error: any) {
    console.error('Erro ao criar comentário:', error)
    throw error
  }
}

export async function deleteComment(commentId: string, userId: string): Promise<void> {
  try {
    // Verificar se o comentário pertence ao usuário
    const { data: comment, error: checkError } = await supabaseAdmin
      .from('dccmusic_comments')
      .select('user_id')
      .eq('id', commentId)
      .maybeSingle()

    if (checkError) throw checkError
    if (!comment) throw new Error('Comentário não encontrado')
    if (comment.user_id !== userId) {
      throw new Error('Você não tem permissão para deletar este comentário')
    }

    const { error } = await supabaseAdmin
      .from('dccmusic_comments')
      .delete()
      .eq('id', commentId)

    if (error) throw error
  } catch (error: any) {
    console.error('Erro ao deletar comentário:', error)
    throw error
  }
}

// Buscar estatísticas do usuário (total de avaliações e comentários)
export async function getUserStats(userId: string): Promise<{
  totalRatings: number
  totalComments: number
}> {
  try {
    // Contar avaliações
    const { count: ratingsCount, error: ratingsError } = await supabaseAdmin
      .from('dccmusic_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (ratingsError) {
      console.error('Erro ao contar avaliações:', ratingsError)
    }

    // Contar comentários
    const { count: commentsCount, error: commentsError } = await supabaseAdmin
      .from('dccmusic_comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (commentsError) {
      console.error('Erro ao contar comentários:', commentsError)
    }

    return {
      totalRatings: ratingsCount || 0,
      totalComments: commentsCount || 0,
    }
  } catch (error) {
    console.error('Erro ao buscar estatísticas do usuário:', error)
    return {
      totalRatings: 0,
      totalComments: 0,
    }
  }
}

// Deletar link
export async function deleteTrackedLink(id: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_tracked_links')
    .delete()
    .eq('id', id)
    .select()
  
  if (error) {
    console.error('Erro ao deletar link no banco:', error)
    throw error
  }
  
  if (!data || data.length === 0) {
    throw new Error('Nenhum registro foi deletado')
  }
}

// ============================================
// QUERIES - Featured Payments (Destaques Pagos)
// ============================================

export interface FeaturedPayment {
  id: string
  contentType: 'music' | 'video'
  contentId: string
  composerId: string
  paymentStatus: 'pending' | 'approved' | 'rejected' | 'cancelled'
  mercadoPagoPreferenceId?: string
  mercadoPagoPaymentId?: string
  amount: number
  expiresAt: Date
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

function mapFeaturedPayment(data: any): FeaturedPayment {
  return {
    id: data.id,
    contentType: data.content_type,
    contentId: data.content_id,
    composerId: data.composer_id,
    paymentStatus: data.payment_status,
    mercadoPagoPreferenceId: data.mercado_pago_preference_id,
    mercadoPagoPaymentId: data.mercado_pago_payment_id,
    amount: parseFloat(data.amount || '9.90'),
    expiresAt: new Date(data.expires_at),
    isActive: data.is_active === true,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  }
}

// Criar registro de destaque pago (antes do pagamento)
export async function createFeaturedPayment(
  contentType: 'music' | 'video',
  contentId: string,
  composerId: string,
  preferenceId: string
): Promise<FeaturedPayment> {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 10) // 10 dias

    const { data, error } = await supabaseAdmin
      .from('dccmusic_featured_payments')
      .insert({
        content_type: contentType,
        content_id: contentId,
        composer_id: composerId,
        payment_status: 'pending',
        mercado_pago_preference_id: preferenceId,
        amount: 9.90,
        expires_at: expiresAt.toISOString(),
        is_active: false,
      })
      .select()
      .single()

    if (error) throw error
    return mapFeaturedPayment(data)
  } catch (error: any) {
    console.error('Erro ao criar destaque pago:', error)
    throw error
  }
}

// Atualizar status do pagamento de destaque
export async function updateFeaturedPaymentStatus(
  preferenceId: string,
  paymentId: string,
  status: 'approved' | 'rejected' | 'cancelled'
): Promise<FeaturedPayment | null> {
  try {
    if (status === 'approved') {
      // Usar função do banco para ativar
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 10)

      const { data, error } = await supabaseAdmin
        .from('dccmusic_featured_payments')
        .update({
          payment_status: 'approved',
          mercado_pago_payment_id: paymentId,
          is_active: true,
          expires_at: expiresAt.toISOString(),
        })
        .eq('mercado_pago_preference_id', preferenceId)
        .eq('payment_status', 'pending')
        .select()
        .single()

      if (error) throw error
      return data ? mapFeaturedPayment(data) : null
    } else {
      const { data, error } = await supabaseAdmin
        .from('dccmusic_featured_payments')
        .update({
          payment_status: status,
          is_active: false,
        })
        .eq('mercado_pago_preference_id', preferenceId)
        .select()
        .single()

      if (error) throw error
      return data ? mapFeaturedPayment(data) : null
    }
  } catch (error: any) {
    console.error('Erro ao atualizar status do destaque:', error)
    throw error
  }
}

// Verificar se conteúdo tem destaque ativo
export async function hasActiveFeatured(
  contentType: 'music' | 'video',
  contentId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_featured_payments')
      .select('id')
      .eq('content_type', contentType)
      .eq('content_id', contentId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .limit(1)

    if (error) {
      console.error('Erro ao verificar destaque:', error)
      return false
    }

    return (data?.length || 0) > 0
  } catch (error) {
    console.error('Erro ao verificar destaque:', error)
    return false
  }
}

// Buscar destaque ativo de um conteúdo
export async function getActiveFeatured(
  contentType: 'music' | 'video',
  contentId: string
): Promise<FeaturedPayment | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_featured_payments')
      .select('*')
      .eq('content_type', contentType)
      .eq('content_id', contentId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar destaque:', error)
      return null
    }

    return data ? mapFeaturedPayment(data) : null
  } catch (error) {
    console.error('Erro ao buscar destaque:', error)
    return null
  }
}

// Desativar destaques expirados (chamado periodicamente)
export async function deactivateExpiredFeatured(): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin
      .from('dccmusic_featured_payments')
      .update({ is_active: false })
      .eq('is_active', true)
      .lt('expires_at', new Date().toISOString())
      .select()

    if (error) {
      console.error('Erro ao desativar destaques expirados:', error)
      return 0
    }

    return data?.length || 0
  } catch (error) {
    console.error('Erro ao desativar destaques expirados:', error)
    return 0
  }
}
