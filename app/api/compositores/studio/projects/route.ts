import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import {
  canCreateStudioMusicWithCredits,
  createUniqueProjectSlug,
  getFreeMusicUsage,
  getStudioAccess,
  getStudioCreditUsage,
  mapStudioProject,
} from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'
import { getStudioVersionAudioUrls } from '@/lib/studio-audio-backup'
import { createStudioAudioSignedUrl } from '@/lib/studio-audio-backup'
import { getStudioCoverImageUrl } from '@/lib/studio-cover-url'
import { formatMusicTitle } from '@/lib/normalize'
import { normalizeStudioLyricStructure } from '@/lib/studio-lyric-normalizer'
import { getStudioVersionVoices } from '@/lib/studio-generation-voice'
import {
  isPoliticalCampaignContent,
  POLITICAL_CAMPAIGN_READY_LYRIC_MESSAGE,
} from '@/lib/studio-political-content'

export const dynamic = 'force-dynamic'
const STUDIO_TITLE_MAX_LENGTH = 30
const ORIGINALS_FILTER = 'originais'
const PROJECTS_PAGE_SIZE = 24

function buildProjectDescription(body: any) {
  const idea = typeof body.idea === 'string' ? body.idea.trim() : ''
  const voiceGender = typeof body.voiceGender === 'string' ? body.voiceGender.trim() : ''
  const voiceTone = typeof body.voiceTone === 'string' ? body.voiceTone.trim() : ''
  const avoidInstruments = typeof body.avoidInstruments === 'string' ? body.avoidInstruments.trim() : ''
  const wantInstruments = typeof body.wantInstruments === 'string' ? body.wantInstruments.trim() : ''
  const extraInstructions = typeof body.extraInstructions === 'string'
    ? body.extraInstructions.replace(/\s+/g, ' ').trim().slice(0, 700)
    : ''
  const ownPrompt = typeof body.ownPrompt === 'string'
    ? body.ownPrompt.replace(/\s+/g, ' ').trim().slice(0, 1000)
    : ''
  const useOwnPrompt = body.useOwnPrompt === true && ownPrompt.length > 0
  const voiceNotes = [voiceGender, voiceTone]
    .filter((value) => value && value !== 'Deixar a IA escolher')

  const lines = [idea]
  const songLanguage = typeof body.songLanguage === 'string' && body.songLanguage.trim()
    ? body.songLanguage.trim()
    : 'Português (Brasil)'

  lines.push('', `Idioma da música: ${songLanguage}`)

  if (useOwnPrompt) {
    lines.push('', 'Modo de prompt próprio: ativo', `Prompt próprio do compositor: ${ownPrompt}`)
    return lines.filter(Boolean).join('\n')
  }

  if (voiceNotes.length > 0) {
    lines.push('', `Preferência de voz: ${voiceNotes.join(', ')}`)
  }

  if (wantInstruments) {
    lines.push('', `Instrumentos desejados: ${wantInstruments}`)
  }

  if (avoidInstruments) {
    lines.push('', `Instrumentos proibidos: ${avoidInstruments}`)
  }

  if (extraInstructions) {
    lines.push('', `Instruções extras do compositor: ${extraInstructions}`)
  }

  const description = lines.filter(Boolean).join('\n')
  return description || null
}

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado', errorCode: 'unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'
    const dashboardSummary = searchParams.get('dashboard') === '1'
    const paginated = !dashboardSummary && searchParams.has('page')
    const requestedPage = Number(searchParams.get('page') || 1)
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1

    let query = supabaseAdmin
      .from('studio_projects')
      .select(dashboardSummary ? 'id, title, style, mood, status, updated_at' : '*')
      .eq('composer_id', composer.composerId)
      .order('updated_at', { ascending: false })

    if (dashboardSummary) query = query.range(0, 5)
    else if (paginated) query = query.range((page - 1) * PROJECTS_PAGE_SIZE, page * PROJECTS_PAGE_SIZE)

    if (filter === 'drafts') query = query.eq('status', 'draft')
    if (filter === 'published') query = query.eq('status', 'published')
    if (filter === 'favorites') query = query.eq('favorite', true)
    let originalGenerationByProject = new Map<string, any>()
    if (filter === ORIGINALS_FILTER) {
      const { data: enhancedGenerations, error: enhancedError } = await supabaseAdmin
        .from('studio_generations')
        .select('project_id,request_payload,created_at')
        .eq('composer_id', composer.composerId)
        .eq('request_payload->>feature', 'enhance_music')
        .order('created_at', { ascending: false })

      if (enhancedError) throw enhancedError
      for (const generation of enhancedGenerations || []) {
        if (!originalGenerationByProject.has(generation.project_id)) originalGenerationByProject.set(generation.project_id, generation)
      }
      if (filter === ORIGINALS_FILTER) {
        const enhancedProjectIds = [...originalGenerationByProject.keys()]
        if (enhancedProjectIds.length === 0) return NextResponse.json({ projects: [] })
        query = query.in('id', enhancedProjectIds)
      }
    }

    const { data, error } = await query
    if (error) throw error
    const pageData = paginated ? (data || []).slice(0, PROJECTS_PAGE_SIZE) : (data || [])
    const hasMore = paginated && (data || []).length > PROJECTS_PAGE_SIZE

    // The dashboard only needs six cards. Avoid loading every lyric, version,
    // audio URL and signed asset from the full projects endpoint.
    if (dashboardSummary) {
      const projectIds = (data || []).map((project: any) => project.id)
      const { data: covers, error: coversError } = projectIds.length > 0
        ? await supabaseAdmin
            .from('studio_covers')
            .select('id, project_id, image_url, image_path, is_premium')
            .eq('composer_id', composer.composerId)
            .eq('is_current', true)
            .in('project_id', projectIds)
        : { data: [], error: null }
      if (coversError) throw coversError

      const coverByProject = new Map<string, any>()
      for (const cover of covers || []) coverByProject.set(cover.project_id, cover)
      const projects = await Promise.all((data || []).map(async (project: any) => {
        const cover = coverByProject.get(project.id)
        return {
          id: project.id,
          title: project.title,
          style: project.style,
          mood: project.mood,
          status: project.status,
          updatedAt: project.updated_at,
          cover: cover ? {
            id: cover.id,
            imageUrl: await getStudioCoverImageUrl(cover, { preview: true }),
            isPremium: cover.is_premium,
          } : null,
        }
      }))
      return NextResponse.json({ projects })
    }

    const projectIds = pageData.map((project: any) => project.id)
    if (projectIds.length === 0) {
      return NextResponse.json({ projects: [], page, hasMore })
    }

    // Load related assets in batches for the current page rather than issuing
    // several queries for every project. The detail endpoint remains unchanged.
    const [
      { data: lyrics, error: lyricsError },
      { data: versions, error: versionsError },
      { data: covers, error: coversError },
    ] = await Promise.all([
      supabaseAdmin.from('studio_lyrics').select('id, project_id, content, created_at')
        .eq('is_current', true).in('project_id', projectIds).order('created_at', { ascending: false }),
      supabaseAdmin.from('studio_versions').select('*')
        .eq('composer_id', composer.composerId).in('project_id', projectIds)
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('studio_covers').select('*')
        .eq('is_current', true).in('project_id', projectIds)
        .order('created_at', { ascending: false }),
    ])
    if (lyricsError) throw lyricsError
    if (versionsError) throw versionsError
    if (coversError) throw coversError

    // Only enhanced generations for displayed projects are needed outside the
    // originals filter. Originals were identified before paging.
    if (filter !== ORIGINALS_FILTER && filter !== 'cifras') {
      const { data: enhancedGenerations, error: enhancedError } = await supabaseAdmin
        .from('studio_generations')
        .select('project_id,request_payload,created_at')
        .eq('composer_id', composer.composerId)
        .eq('request_payload->>feature', 'enhance_music')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
      if (enhancedError) throw enhancedError
      for (const generation of enhancedGenerations || []) {
        if (!originalGenerationByProject.has(generation.project_id)) {
          originalGenerationByProject.set(generation.project_id, generation)
        }
      }
    }

    const lyricByProject = new Map<string, any>()
    for (const lyric of lyrics || []) {
      if (!lyricByProject.has(lyric.project_id)) lyricByProject.set(lyric.project_id, lyric)
    }
    const coverByProject = new Map<string, any>()
    for (const cover of covers || []) {
      if (!coverByProject.has(cover.project_id)) coverByProject.set(cover.project_id, cover)
    }
    const versionsByProject = new Map<string, any[]>()
    const currentVersionByProject = new Map<string, any>()
    for (const version of versions || []) {
      const list = versionsByProject.get(version.project_id) || []
      list.push(version)
      versionsByProject.set(version.project_id, list)
      if (version.is_current && !currentVersionByProject.has(version.project_id)) {
        currentVersionByProject.set(version.project_id, version)
      }
    }
    const voiceByVersionId = await getStudioVersionVoices(composer.composerId, versions || [])
    const audioUrlPromises = new Map<string, ReturnType<typeof getStudioVersionAudioUrls>>()
    const getAudio = (version: any) => {
      if (!audioUrlPromises.has(version.id)) {
        audioUrlPromises.set(version.id, getStudioVersionAudioUrls(version))
      }
      return audioUrlPromises.get(version.id)!
    }

    const projects = await Promise.all(
      pageData.map(async (project: any) => {
        const lyric = lyricByProject.get(project.id)
        const version = currentVersionByProject.get(project.id)
        const cover = coverByProject.get(project.id)
        const projectVersions = versionsByProject.get(project.id) || []
        const [versionAudio, coverImageUrl, versionsWithAudio] = await Promise.all([
          version ? getAudio(version) : Promise.resolve(null),
          cover ? getStudioCoverImageUrl(cover, { preview: true }) : Promise.resolve(null),
          Promise.all(projectVersions
            .filter((item: any) => item.audio_url || item.stream_audio_url || item.audio_path || item.stream_audio_path)
            .map(async (item: any) => {
              const audio = await getAudio(item)
              return {
                id: item.id,
                audioUrl: audio.audioUrl,
                streamAudioUrl: audio.streamAudioUrl,
                duration: item.duration,
                versionName: item.version_name,
                style: item.style,
                isCurrent: Boolean(item.is_current),
                createdAt: item.created_at,
              }
            })),
        ])
        const latestVoice = projectVersions.map((item: any) => voiceByVersionId.get(item.id)).find(Boolean) || null
        const originalGeneration = originalGenerationByProject.get(project.id)
        const originalAudio = originalGeneration?.request_payload?.originalAudio
        const originalAudioUrl = filter === ORIGINALS_FILTER && originalAudio?.path
          ? await createStudioAudioSignedUrl(originalAudio.path, originalAudio.provider || 'r2')
          : null

        return {
          ...mapStudioProject(project, {
            lyric: lyric?.content || null,
            version: version ? {
              id: version.id,
              audioUrl: versionAudio?.audioUrl,
              streamAudioUrl: versionAudio?.streamAudioUrl,
              duration: version.duration,
              versionName: version.version_name,
            } : null,
            cover: cover ? {
              id: cover.id,
              imageUrl: coverImageUrl,
              isPremium: cover.is_premium,
            } : null,
            versions: versionsWithAudio,
            versionCount: versionsWithAudio.length,
            customVoice: latestVoice,
          }),
          createdFromOriginal: Boolean(originalAudio?.path),
          ...(filter === ORIGINALS_FILTER && originalAudio?.path ? {
            originalAudio: {
              audioUrl: originalAudioUrl,
              audioPath: originalAudio.path,
              audioProvider: originalAudio.provider || 'r2',
              audioContentType: originalAudio.contentType || 'audio/mpeg',
              audioSizeBytes: Number(originalAudio.sizeBytes) || 0,
            },
          } : {}),
        }
      })
    )

    const responseProjects = filter === ORIGINALS_FILTER
      ? projects.filter((project: any, index: number, list: any[]) => {
          const path = String(project?.originalAudio?.audioPath || '').trim()
          if (!path) return true
          return list.findIndex((candidate: any) =>
            String(candidate?.originalAudio?.audioPath || '').trim() === path
          ) === index
        })
      : projects

    return NextResponse.json({ projects: responseProjects, page, hasMore })
  } catch (error: any) {
    console.error('[Studio IA] Erro listar projetos:', error)
    return NextResponse.json({ error: 'Erro ao listar projetos', errorCode: 'load' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { hasAccess, limits } = await getStudioAccess(composer.composerId)
    const usage = await getStudioCreditUsage(composer.composerId, limits)
    const hasPaidCredits = canCreateStudioMusicWithCredits(usage)

    if (!hasAccess && !hasPaidCredits) {
      const freeMusicUsage = await getFreeMusicUsage(composer.composerId)
      if (freeMusicUsage.remaining <= 0) {
        return NextResponse.json(
          {
            error: 'Você já usou sua música grátis. Para continuar criando, escolha um plano ou compre uma recarga avulsa.',
          },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const hasOwnLyric = typeof body.lyric === 'string' && body.lyric.trim().length > 0
    if (!hasOwnLyric && isPoliticalCampaignContent(body.title, body.idea)) {
      return NextResponse.json(
        {
          error: POLITICAL_CAMPAIGN_READY_LYRIC_MESSAGE,
          errorCode: 'politicalCampaignReadyLyricRequired',
        },
        { status: 422 }
      )
    }

    const rawTitle = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, STUDIO_TITLE_MAX_LENGTH) : 'Nova música'
    const title = formatMusicTitle(rawTitle)
    const slug = await createUniqueProjectSlug(composer.composerId, title)

    const { data, error } = await supabaseAdmin
      .from('studio_projects')
      .insert({
        composer_id: composer.composerId,
        title,
        slug,
        style: body.style || null,
        mood: body.mood || null,
        structure: body.structure || null,
        line_count: body.lineCount || null,
        status: 'draft',
        description: buildProjectDescription(body),
      })
      .select('*')
      .single()

    if (error) throw error

    if (typeof body.lyric === 'string' && body.lyric.trim()) {
      const rawLyric = body.lyric.trim()
      const lyricNormalization = normalizeStudioLyricStructure(rawLyric)

      const { error: lyricError } = await supabaseAdmin
        .from('studio_lyrics')
        .insert({
          project_id: data.id,
          composer_id: composer.composerId,
          content: lyricNormalization.lyric,
          is_current: true,
          prompt: {
            source: 'own_lyric',
            improveStructureForAi: true,
            structureNormalizationRequired: true,
            lyricNormalized: lyricNormalization.changed,
            linesBefore: lyricNormalization.linesBefore,
            linesAfter: lyricNormalization.linesAfter,
            songLanguage: body.songLanguage || 'Português (Brasil)',
          },
        })

      if (lyricError) throw lyricError
    }

    return NextResponse.json({ project: mapStudioProject(data) })
  } catch (error: any) {
    console.error('[Studio IA] Erro criar projeto:', error)
    return NextResponse.json({ error: 'Erro ao criar projeto' }, { status: 500 })
  }
}
