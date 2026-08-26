import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { createAdminPlayback } from '@/lib/admin-playback'
import { createStudioAudioSignedUrl, getStudioVersionAudioUrls, validateStudioInputUploadedAsset } from '@/lib/studio-audio-backup'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function requireAdmin() {
  return getServerSession(authOptions)
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { data: versions, error } = await supabaseAdmin
      .from('studio_versions')
      .select('id, project_id, composer_id, version_name, audio_url, stream_audio_url, audio_path, stream_audio_path, audio_storage_provider, stream_audio_storage_provider, created_at')
      .or('audio_url.not.is.null,audio_path.not.is.null,stream_audio_url.not.is.null,stream_audio_path.not.is.null')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error

    const projectIds = [...new Set((versions || []).map((item: any) => item.project_id).filter(Boolean))]
    const composerIds = [...new Set((versions || []).map((item: any) => item.composer_id).filter(Boolean))]
    const [{ data: projects }, { data: composers }] = await Promise.all([
      projectIds.length ? supabaseAdmin.from('studio_projects').select('id, title').in('id', projectIds) : Promise.resolve({ data: [] as any[] }),
      composerIds.length ? supabaseAdmin.from('dccmusic_composers').select('id, name, email').in('id', composerIds) : Promise.resolve({ data: [] as any[] }),
    ])
    const projectMap = new Map((projects || []).map((item: any) => [item.id, item]))
    const composerMap = new Map((composers || []).map((item: any) => [item.id, item]))

    return NextResponse.json({ songs: (versions || []).map((version: any) => {
      const project: any = projectMap.get(version.project_id)
      const composer: any = composerMap.get(version.composer_id)
      return {
        id: version.id,
        title: project?.title || 'Música sem título',
        versionName: version.version_name || 'Versão',
        composer: composer?.name || composer?.email || 'Compositor',
        createdAt: version.created_at,
      }
    }) })
  } catch (error: any) {
    console.error('[Admin Playback] list error:', error)
    return NextResponse.json({ error: error?.message || 'Erro ao carregar músicas.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    let sourceUrl = ''
    let title = String(body.title || '').trim()

    if (body.versionId) {
      const { data: version, error } = await supabaseAdmin.from('studio_versions').select('*').eq('id', String(body.versionId)).maybeSingle()
      if (error) throw error
      if (!version) return NextResponse.json({ error: 'Música não encontrada.' }, { status: 404 })
      const { data: project } = await supabaseAdmin.from('studio_projects').select('title').eq('id', version.project_id).maybeSingle()
      title = title || project?.title || version.version_name || 'musica'
      const audio = await getStudioVersionAudioUrls(version)
      sourceUrl = audio.audioUrl || audio.streamAudioUrl || ''
    } else if (body.upload?.path) {
      validateStudioInputUploadedAsset({
        composerId: 'admin-playback',
        path: String(body.upload.path),
        provider: String(body.upload.provider),
        contentType: String(body.upload.contentType || 'audio/mpeg'),
        sizeBytes: Number(body.upload.sizeBytes),
      })
      sourceUrl = await createStudioAudioSignedUrl(body.upload.path, body.upload.provider) || ''
    }

    if (!sourceUrl) return NextResponse.json({ error: 'Escolha ou envie uma música.' }, { status: 400 })
    const output = await createAdminPlayback({ sourceUrl, title })
    const downloadUrl = await createStudioAudioSignedUrl(output.path, output.provider)
    if (!downloadUrl) throw new Error('Playback criado, mas não foi possível gerar o link de download.')
    const vocalUrl = output.vocal
      ? await createStudioAudioSignedUrl(output.vocal.path, output.vocal.provider)
      : null

    const usedFallback = output.separationProvider === 'mureka'
    return NextResponse.json({
      success: true,
      downloadUrl,
      vocalUrl,
      fileName: `${title || 'musica'} - Playback.mp3`,
      provider: output.separationProvider,
      message: usedFallback
        ? 'Voz retirada! A Suno falhou e a Mureka concluiu o playback automaticamente.'
        : 'Voz retirada pela Suno! O playback está pronto para ouvir e baixar.',
    })
  } catch (error: any) {
    console.error('[Admin Playback] create error:', error)
    return NextResponse.json({ error: error?.message || 'Erro ao criar playback.' }, { status: 500 })
  }
}
