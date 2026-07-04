import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import {
  canCreateStudioMusicWithCredits,
  createUniqueProjectSlug,
  getCurrentProjectAssets,
  getFreeMusicUsage,
  getStudioAccess,
  getStudioCreditUsage,
  mapStudioProject,
} from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'
import { getStudioVersionAudioUrls } from '@/lib/studio-audio-backup'
import { getStudioCoverImageUrl } from '@/lib/studio-cover-url'
import { formatMusicTitle } from '@/lib/normalize'

export const dynamic = 'force-dynamic'
const STUDIO_TITLE_MAX_LENGTH = 30

function buildProjectDescription(body: any) {
  const idea = typeof body.idea === 'string' ? body.idea.trim() : ''
  const voiceGender = typeof body.voiceGender === 'string' ? body.voiceGender.trim() : ''
  const voiceTone = typeof body.voiceTone === 'string' ? body.voiceTone.trim() : ''
  const avoidInstruments = typeof body.avoidInstruments === 'string' ? body.avoidInstruments.trim() : ''
  const wantInstruments = typeof body.wantInstruments === 'string' ? body.wantInstruments.trim() : ''
  const extraInstructions = typeof body.extraInstructions === 'string'
    ? body.extraInstructions.replace(/\s+/g, ' ').trim().slice(0, 700)
    : ''
  const voiceNotes = [voiceGender, voiceTone]
    .filter((value) => value && value !== 'Deixar a IA escolher')

  const lines = [idea]

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
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'

    let query = supabaseAdmin
      .from('studio_projects')
      .select('*')
      .eq('composer_id', composer.composerId)
      .order('updated_at', { ascending: false })

    if (filter === 'drafts') query = query.eq('status', 'draft')
    if (filter === 'published') query = query.eq('status', 'published')
    if (filter === 'favorites') query = query.eq('favorite', true)

    const { data, error } = await query
    if (error) throw error

    const projects = await Promise.all(
      (data || []).map(async (project: any) => {
        const { lyric, version, cover } = await getCurrentProjectAssets(project.id)
        const versionAudio = version ? await getStudioVersionAudioUrls(version) : null
        const coverImageUrl = cover ? await getStudioCoverImageUrl(cover) : null
        const { data: projectVersions } = await supabaseAdmin
          .from('studio_versions')
          .select('*')
          .eq('project_id', project.id)
          .eq('composer_id', composer.composerId)
          .order('created_at', { ascending: false })

        const versionsWithAudio = await Promise.all((projectVersions || [])
          .filter((item: any) => item.audio_url || item.stream_audio_url || item.audio_path || item.stream_audio_path)
          .map(async (item: any) => {
            const audio = await getStudioVersionAudioUrls(item)
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
          }))

        return mapStudioProject(project, {
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
        })
      })
    )

    return NextResponse.json({ projects })
  } catch (error: any) {
    console.error('[Studio IA] Erro listar projetos:', error)
    return NextResponse.json({ error: error.message || 'Erro ao listar projetos' }, { status: 500 })
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
      const { error: lyricError } = await supabaseAdmin
        .from('studio_lyrics')
        .insert({
          project_id: data.id,
          composer_id: composer.composerId,
          content: body.lyric,
          is_current: true,
        })

      if (lyricError) throw lyricError
    }

    return NextResponse.json({ project: mapStudioProject(data) })
  } catch (error: any) {
    console.error('[Studio IA] Erro criar projeto:', error)
    return NextResponse.json({ error: error.message || 'Erro ao criar projeto' }, { status: 500 })
  }
}
