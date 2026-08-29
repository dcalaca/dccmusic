import { supabaseAdmin } from '@/lib/supabase'
import { getStudioCallbackUrl } from '@/lib/studio'
import { formatMusicTitle } from '@/lib/normalize'
import { getStudioVersionAudioUrls } from '@/lib/studio-audio-backup'
import { backupStudioVideoRequest, resolveStudioVideoUrl } from '@/lib/studio-video-backup'
import {
  buildMurekaLyricsVideoPayload,
  extractMurekaLyricsVideoUrl,
  getStudioVersionDurationMs,
  getStudioVideoAudioId,
  isMurekaStudioTrack,
  isSunoRecordMissingError,
  translateStudioVideoProviderError,
} from '@/lib/studio-video-helpers'

export function getStudioVideoRequestVersionId(videoRequest: any): string | null {
  const metadata = videoRequest?.metadata
  if (!metadata || typeof metadata !== 'object') return null
  const versionId = metadata.version_id || metadata.versionId || null
  return versionId ? String(versionId) : null
}

export async function mapStudioVideoRequest(videoRequest: any) {
  if (!videoRequest) return null
  return {
    id: videoRequest.id,
    status: videoRequest.status,
    amount: videoRequest.amount,
    paymentGateway: videoRequest.payment_gateway,
    paymentPreferenceId: videoRequest.payment_preference_id,
    paymentId: videoRequest.payment_id,
    providerTaskId: videoRequest.provider_task_id,
    videoUrl: await resolveStudioVideoUrl(videoRequest),
    errorMessage: videoRequest.error_message
      ? translateStudioVideoProviderError(videoRequest.error_message)
      : videoRequest.error_message,
    paidAt: videoRequest.paid_at,
    completedAt: videoRequest.completed_at,
    createdAt: videoRequest.created_at,
    updatedAt: videoRequest.updated_at,
    versionId: getStudioVideoRequestVersionId(videoRequest),
    versionName: videoRequest.metadata?.version_name || videoRequest.metadata?.versionName || null,
  }
}

export const STUDIO_VIDEO_COURTESY_PROJECT_IDS = [
  'e2d26798-b1ff-4291-b9d5-acac1802cd47',
]

export function studioVideoCanRegenerate(videoRequest: any, project: { id?: string; title?: string } | null) {
  if (!videoRequest || videoRequest.status !== 'completed' || !videoRequest.video_url) return false
  if (videoRequest.metadata?.courtesy_regenerate) return false
  if (project?.id && STUDIO_VIDEO_COURTESY_PROJECT_IDS.includes(String(project.id))) return true
  const author = String(videoRequest.request_payload?.author || videoRequest.metadata?.author || '').trim()
  const expected = formatMusicTitle(String(project?.title || '').trim())
  if (!author) return true
  if (!expected) return false
  return formatMusicTitle(author) !== expected
}

function getExistingVideoTaskId(result: any) {
  return result?.data?.taskId || result?.data?.task_id || null
}

function isExistingMp4Conflict(result: any, response: Response) {
  const message = String(result?.msg || '').toLowerCase()
  return response.status === 409 || result?.code === 409 || message.includes('already exists')
}

const MAX_STUDIO_VIDEO_START_RETRIES = 6

function isTransientVideoStartError(result: any, response: Response) {
  const message = String(result?.msg || result?.message || result?.error?.message || '').toLowerCase()
  const code = Number(result?.code || response.status || 0)
  return (
    code >= 500 ||
    message.includes('failed to add suno mp4 generation task') ||
    message.includes('internal error') ||
    message.includes('try again later') ||
    message.includes('temporarily unavailable') ||
    message.includes('timeout')
  )
}

async function scheduleVideoStartRetry(videoRequest: any, result: any) {
  const retryCount = Math.max(0, Number(videoRequest?.metadata?.video_retry_count || 0)) + 1
  if (retryCount > MAX_STUDIO_VIDEO_START_RETRIES) return null

  const rawProviderError = String(
    result?.msg || result?.message || result?.error?.message || 'Falha temporária ao iniciar vídeo.'
  ).slice(0, 500)
  const { data, error } = await supabaseAdmin
    .from('studio_video_requests')
    .update({
      status: 'retry_pending',
      metadata: {
        ...(videoRequest.metadata || {}),
        video_retry_count: retryCount,
        video_retry_reason: rawProviderError,
        video_retry_scheduled_at: new Date().toISOString(),
      },
      response_payload: result,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoRequest.id)
    .select('*')
    .single()

  if (error) throw error
  console.warn('[Studio Video] Início reagendado automaticamente', {
    videoRequestId: videoRequest.id,
    retryCount,
    providerError: rawProviderError,
  })
  return data
}

async function markVideoRequestCompleted(videoRequestId: string, input: {
  providerTaskId: string | null
  videoUrl: string
  responsePayload?: any
}) {
  const { data, error } = await supabaseAdmin
    .from('studio_video_requests')
    .update({
      status: 'completed',
      provider_task_id: input.providerTaskId,
      video_url: input.videoUrl,
      video_backup_status: 'pending',
      video_backup_error: null,
      response_payload: input.responsePayload || null,
      error_message: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoRequestId)
    .select('*')
    .single()

  if (error) throw error
  const backup = await backupStudioVideoRequest(data)
  return backup.backedUp && backup.videoRequest ? backup.videoRequest : data
}

async function fetchExistingMp4Record(videoTaskId: string) {
  const response = await fetch(
    `https://api.sunoapi.org/api/v1/mp4/record-info?taskId=${encodeURIComponent(videoTaskId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.SUNOAPI_KEY}`,
      },
      cache: 'no-store',
    }
  )
  const result = await response.json().catch(() => null)
  if (!response.ok || result?.code !== 200) {
    return null
  }

  const videoUrl =
    result?.data?.response?.videoUrl ||
    result?.data?.response?.video_url ||
    result?.data?.videoUrl ||
    result?.data?.video_url ||
    null

  if (!videoUrl) return null

  return {
    providerTaskId: result?.data?.taskId || result?.data?.task_id || videoTaskId,
    videoUrl: String(videoUrl),
    responsePayload: result,
  }
}

async function recoverExistingVideoRequest(videoRequest: any, existingTaskId: string | null, responsePayload?: any) {
  if (existingTaskId) {
    const record = await fetchExistingMp4Record(existingTaskId)
    if (record?.videoUrl) {
      return markVideoRequestCompleted(videoRequest.id, {
        providerTaskId: record.providerTaskId,
        videoUrl: record.videoUrl,
        responsePayload: responsePayload || record.responsePayload,
      })
    }
  }

  const versionId = getStudioVideoRequestVersionId(videoRequest)
  const { data: completedRequests } = await supabaseAdmin
    .from('studio_video_requests')
    .select('*')
    .eq('project_id', videoRequest.project_id)
    .eq('composer_id', videoRequest.composer_id)
    .eq('status', 'completed')
    .not('video_url', 'is', null)
    .neq('id', videoRequest.id)
    .order('completed_at', { ascending: false })
    .limit(30)

  const completedRequest = (completedRequests || []).find((item: any) => {
    const itemVersionId = getStudioVideoRequestVersionId(item)
    if (versionId) return itemVersionId === versionId
    return !itemVersionId
  })

  if (completedRequest?.video_url) {
    return markVideoRequestCompleted(videoRequest.id, {
      providerTaskId: completedRequest.provider_task_id || existingTaskId,
      videoUrl: completedRequest.video_url,
      responsePayload: responsePayload || completedRequest.response_payload,
    })
  }

  return null
}

export async function startStudioVideoGeneration(videoRequestId: string, options?: { skipRecover?: boolean }) {
  const { data: videoRequest, error: requestError } = await supabaseAdmin
    .from('studio_video_requests')
    .select('*')
    .eq('id', videoRequestId)
    .maybeSingle()

  if (requestError) throw requestError
  if (!videoRequest) throw new Error('Solicitação de vídeo com letra não encontrada.')

  // O vídeo simples é produzido internamente pelo cron com o áudio permanente.
  // Assim a criação não depende do endpoint MP4 da Suno.
  if (process.env.INTERNAL_STUDIO_VIDEO_ENABLED !== 'false') {
    const { data, error } = await supabaseAdmin
      .from('studio_video_requests')
      .update({
        status: 'retry_pending',
        request_payload: {
          ...(videoRequest.request_payload || {}),
          provider: 'dcc-internal',
          format: 'static-cover-lyrics-v1',
        },
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoRequest.id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  if (!process.env.SUNOAPI_KEY) {
    throw new Error('Geração de vídeo com letra não configurada no servidor.')
  }

  const requestedVersionId = getStudioVideoRequestVersionId(videoRequest)
  const [{ data: project }, { data: composer }, { data: requestedVersion }, { data: currentVersion }] = await Promise.all([
    supabaseAdmin
      .from('studio_projects')
      .select('id, title')
      .eq('id', videoRequest.project_id)
      .maybeSingle(),
    supabaseAdmin
      .from('dccmusic_composers')
      .select('name')
      .eq('id', videoRequest.composer_id)
      .maybeSingle(),
    requestedVersionId
      ? supabaseAdmin
          .from('studio_versions')
          .select('*')
          .eq('project_id', videoRequest.project_id)
          .eq('id', requestedVersionId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from('studio_versions')
      .select('*')
      .eq('project_id', videoRequest.project_id)
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  const version = requestedVersionId ? requestedVersion : currentVersion
  if (requestedVersionId && !requestedVersion) {
    const errorMessage = 'A versão escolhida para o vídeo não foi encontrada neste projeto.'
    await supabaseAdmin
      .from('studio_video_requests')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoRequest.id)
    throw new Error(errorMessage)
  }

  const { data: generation } = await supabaseAdmin
    .from('studio_generations')
    .select('*')
    .eq('id', version?.generation_id || '')
    .maybeSingle()

  const fallbackGeneration = !generation && !requestedVersionId
    ? await supabaseAdmin
        .from('studio_generations')
        .select('*')
        .eq('project_id', videoRequest.project_id)
        .eq('composer_id', videoRequest.composer_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : null

  const generationToUse = generation || fallbackGeneration?.data
  const taskId = generationToUse?.provider_task_id
  const audioId = getStudioVideoAudioId(version, generationToUse)
  const songTitle = formatMusicTitle(String(project?.title || '').trim()) || 'DCC Music'
  const artistName = String(composer?.name || '').trim() || 'DCC Music'

  if (isMurekaStudioTrack(generationToUse, version)) {
    // O endpoint nativo de lyric video da Mureka não aceita o nome do artista.
    // Quando recebe um song_id, ele imprime no MP4 o proprietário da conta da API,
    // o que pode atribuir a música ao administrador da plataforma. Passe primeiro
    // pelo fluxo da Suno, que aceita domainName e preserva o nome do compositor.
    const refreshed = await startLyricVideoRefreshFromOriginalAudio({
      videoRequest,
      version,
      project,
      composerName: artistName,
      songTitle,
    })
    if (refreshed) return refreshed

    const errorMessage = 'Não consegui preparar este vídeo com o nome correto do compositor agora.'
    await supabaseAdmin
      .from('studio_video_requests')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoRequest.id)
    throw new Error(errorMessage)
  }

  if (!taskId || !audioId) {
    const errorMessage = 'Não encontrei os dados técnicos da música para gerar o vídeo com letra.'
    await supabaseAdmin
      .from('studio_video_requests')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoRequest.id)
    throw new Error(errorMessage)
  }

  if (!options?.skipRecover) {
    const recoveredFromDb = await recoverExistingVideoRequest(videoRequest, null)
    if (recoveredFromDb) return recoveredFromDb
  }

  const payload = {
    taskId,
    audioId,
    callBackUrl: getStudioCallbackUrl('/api/studio/suno/video-callback'),
    title: songTitle.slice(0, 50),
    author: artistName.slice(0, 50),
    domainName: artistName.slice(0, 50),
  }

  await supabaseAdmin
    .from('studio_video_requests')
    .update({
      status: 'in_production',
      request_payload: payload,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoRequest.id)

  const response = await fetch('https://api.sunoapi.org/api/v1/mp4/generate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUNOAPI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => null)

  console.info('[Studio IA] Resposta Suno MP4:', {
    httpStatus: response.status,
    code: result?.code,
    message: result?.msg || result?.message || null,
    taskId,
    audioId,
    videoRequestId: videoRequest.id,
  })

  if (isExistingMp4Conflict(result, response)) {
    const existingTaskId = getExistingVideoTaskId(result)
    if (!options?.skipRecover) {
      const recovered = await recoverExistingVideoRequest(videoRequest, existingTaskId, result)
      if (recovered) return recovered
    }

    const refreshed = await startLyricVideoRefreshFromOriginalAudio({
      videoRequest,
      version,
      project,
      composerName: artistName,
      songTitle,
    })
    if (refreshed) return refreshed

    const errorMessage = 'Este vídeo com letra já existe, mas não consegui recuperar o link agora. Atualize a página ou fale com o suporte.'
    await supabaseAdmin
      .from('studio_video_requests')
      .update({
        status: 'failed',
        response_payload: result,
        error_message: errorMessage,
        provider_task_id: existingTaskId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoRequest.id)
    throw new Error(errorMessage)
  }

  if (!response.ok || result?.code !== 200) {
    if (isSunoRecordMissingError(result) && isMurekaStudioTrack(generationToUse, version)) {
      return startMurekaLyricsVideoGeneration({
        videoRequest,
        version,
        generation: generationToUse,
        songTitle,
        artistName,
      })
    }

    if (isTransientVideoStartError(result, response)) {
      const scheduledRetry = await scheduleVideoStartRetry(videoRequest, result)
      if (scheduledRetry) return scheduledRetry
    }

    const errorMessage = translateStudioVideoProviderError(
      result?.msg,
      'Não consegui iniciar a geração do vídeo com letra agora.'
    )
    await supabaseAdmin
      .from('studio_video_requests')
      .update({
        status: 'failed',
        response_payload: result,
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoRequest.id)
    throw new Error(errorMessage)
  }

  const videoTaskId = getExistingVideoTaskId(result)

  const { data: updatedRequest, error: updateError } = await supabaseAdmin
    .from('studio_video_requests')
    .update({
      status: 'in_production',
      provider_task_id: videoTaskId,
      response_payload: result,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoRequest.id)
    .select('*')
    .single()

  if (updateError) throw updateError
  return updatedRequest
}

export async function startStudioVideoGenerationWithProviderIds(input: {
  videoRequestId: string
  taskId: string
  audioId: string
  songTitle?: string
  artistName?: string
}) {
  const { data: videoRequest, error: requestError } = await supabaseAdmin
    .from('studio_video_requests')
    .select('*')
    .eq('id', input.videoRequestId)
    .maybeSingle()

  if (requestError) throw requestError
  if (!videoRequest) throw new Error('Solicitação de vídeo com letra não encontrada.')
  if (!process.env.SUNOAPI_KEY) throw new Error('Geração de vídeo com letra não configurada no servidor.')

  const [{ data: project }, { data: composer }] = await Promise.all([
    supabaseAdmin.from('studio_projects').select('id, title').eq('id', videoRequest.project_id).maybeSingle(),
    supabaseAdmin.from('dccmusic_composers').select('name').eq('id', videoRequest.composer_id).maybeSingle(),
  ])

  const songTitle = formatMusicTitle(String(input.songTitle || project?.title || '').trim()) || 'DCC Music'
  const artistName = String(input.artistName || composer?.name || '').trim() || 'DCC Music'
  const payload = {
    taskId: input.taskId,
    audioId: input.audioId,
    callBackUrl: getStudioCallbackUrl('/api/studio/suno/video-callback'),
    title: songTitle.slice(0, 50),
    author: artistName.slice(0, 50),
    domainName: artistName.slice(0, 50),
  }

  await supabaseAdmin
    .from('studio_video_requests')
    .update({
      status: 'in_production',
      request_payload: payload,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoRequest.id)

  const response = await fetch('https://api.sunoapi.org/api/v1/mp4/generate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUNOAPI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => null)

  console.info('[Studio IA] Resposta Suno MP4 (provider IDs):', {
    httpStatus: response.status,
    code: result?.code,
    message: result?.msg || result?.message || null,
    taskId: input.taskId,
    audioId: input.audioId,
    videoRequestId: videoRequest.id,
  })

  if (isExistingMp4Conflict(result, response)) {
    const existingTaskId = getExistingVideoTaskId(result)
    const recovered = await recoverExistingVideoRequest(videoRequest, existingTaskId, result)
    if (recovered) return recovered
  }

  if (!response.ok || result?.code !== 200) {
    if (isTransientVideoStartError(result, response)) {
      const scheduledRetry = await scheduleVideoStartRetry(videoRequest, result)
      if (scheduledRetry) return scheduledRetry
    }

    const errorMessage = translateStudioVideoProviderError(
      result?.msg,
      'Não consegui iniciar a geração do vídeo com letra agora.'
    )
    await supabaseAdmin
      .from('studio_video_requests')
      .update({
        status: 'failed',
        response_payload: result,
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoRequest.id)
    throw new Error(errorMessage)
  }

  const { data: updatedRequest, error: updateError } = await supabaseAdmin
    .from('studio_video_requests')
    .update({
      status: 'in_production',
      provider_task_id: getExistingVideoTaskId(result),
      response_payload: result,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoRequest.id)
    .select('*')
    .single()

  if (updateError) throw updateError
  return updatedRequest
}

async function getLyricVideoCoverUrl(videoRequest: any) {
  const metadataCover = String(videoRequest?.metadata?.cover_url || '').trim()
  const { data: cover } = await supabaseAdmin
    .from('studio_covers')
    .select('image_url, image_path')
    .eq('project_id', videoRequest.project_id)
    .eq('composer_id', videoRequest.composer_id)
    .eq('is_current', true)
    .maybeSingle()

  if (cover?.image_path) {
    const { data } = await supabaseAdmin.storage
      .from('studio-assets')
      .createSignedUrl(cover.image_path, 60 * 60 * 24)
    if (data?.signedUrl) return data.signedUrl
  }

  return String(cover?.image_url || metadataCover || '').trim() || null
}

async function startMurekaLyricsVideoGeneration(input: {
  videoRequest: any
  version: any
  generation: any
  songTitle: string
  artistName: string
}) {
  const apiKey = process.env.MUREKA_API_KEY?.trim()
  if (!apiKey) {
    const errorMessage = 'Geração de vídeo com letra não configurada para este tipo de música.'
    await supabaseAdmin
      .from('studio_video_requests')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.videoRequest.id)
    throw new Error(errorMessage)
  }

  const songId = getStudioVideoAudioId(input.version, input.generation)
  if (!songId) {
    const errorMessage = 'Não encontrei os dados técnicos da música para gerar o vídeo com letra.'
    await supabaseAdmin
      .from('studio_video_requests')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.videoRequest.id)
    throw new Error(errorMessage)
  }

  const coverUrl = await getLyricVideoCoverUrl(input.videoRequest)
  const payload = buildMurekaLyricsVideoPayload({
    songId,
    title: input.songTitle,
    coverUrl,
    durationMs: getStudioVersionDurationMs(input.version),
  })

  await supabaseAdmin
    .from('studio_video_requests')
    .update({
      status: 'in_production',
      request_payload: {
        provider: 'mureka',
        artist: input.artistName,
        ...payload,
      },
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.videoRequest.id)

  async function requestMurekaLyricsVideo(body: Record<string, any>) {
    const response = await fetch('https://api.mureka.ai/v1/lyrics-video/generate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const result = await response.json().catch(() => null)
    return { response, result, videoUrl: extractMurekaLyricsVideoUrl(result) }
  }

  let payloadToStore = payload
  let { response, result, videoUrl } = await requestMurekaLyricsVideo(payload)

  if ((!response.ok || !videoUrl) && payload.cover) {
    const fallbackPayload: Record<string, any> = { ...payload, layout: 'layout_1' }
    delete fallbackPayload.cover
    const retry = await requestMurekaLyricsVideo(fallbackPayload)
    if (retry.videoUrl) {
      payloadToStore = fallbackPayload
      response = retry.response
      result = retry.result
      videoUrl = retry.videoUrl
    }
  }

  if (payloadToStore !== payload) {
    await supabaseAdmin
      .from('studio_video_requests')
      .update({
        request_payload: {
          provider: 'mureka',
          artist: input.artistName,
          ...payloadToStore,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.videoRequest.id)
  }

  if (!response.ok || !videoUrl) {
    const errorMessage = translateStudioVideoProviderError(
      result?.error?.message || result?.message || result?.msg,
      'Não consegui gerar o vídeo com letra desta música agora. Tente novamente em instantes.'
    )
    await supabaseAdmin
      .from('studio_video_requests')
      .update({
        status: 'failed',
        response_payload: result,
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.videoRequest.id)
    throw new Error(errorMessage)
  }

  return markVideoRequestCompleted(input.videoRequest.id, {
    providerTaskId: songId,
    videoUrl,
    responsePayload: result,
  })
}

async function startLyricVideoRefreshFromOriginalAudio(input: {
  videoRequest: any
  version: any
  project: any
  composerName: string
  songTitle: string
}) {
  if (!process.env.SUNOAPI_KEY) return null

  const audio = input.version ? await getStudioVersionAudioUrls(input.version) : null
  const audioUrl = audio?.audioUrl || audio?.streamAudioUrl || input.version?.audio_url || input.version?.stream_audio_url
  if (!audioUrl) return null

  const { data: lyric } = await supabaseAdmin
    .from('studio_lyrics')
    .select('content')
    .eq('project_id', input.videoRequest.project_id)
    .eq('is_current', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lyricContent = String(lyric?.content || '').trim()
  if (!lyricContent) return null

  const payload = {
    uploadUrl: audioUrl,
    customMode: true,
    instrumental: false,
    prompt: lyricContent.slice(0, 5000),
    style: String(input.version?.style || input.project?.style || 'música brasileira').slice(0, 1000),
    title: input.songTitle.slice(0, 80),
    model: 'V5_5',
    callBackUrl: getStudioCallbackUrl('/api/studio/suno/callback'),
    audioWeight: 0.97,
    styleWeight: 0.12,
    weirdnessConstraint: 0.2,
  }

  const response = await fetch('https://api.sunoapi.org/api/v1/generate/upload-cover', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUNOAPI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => null)
  const refreshTaskId = result?.data?.taskId || result?.data?.task_id || null
  if (!response.ok || result?.code !== 200 || !refreshTaskId) {
    return null
  }

  await supabaseAdmin
    .from('studio_generations')
    .insert({
      project_id: input.videoRequest.project_id,
      composer_id: input.videoRequest.composer_id,
      provider: 'sunoapi',
      provider_task_id: refreshTaskId,
      status: 'processing',
      request_payload: {
        feature: 'lyric_video_refresh',
        videoRequestId: input.videoRequest.id,
        songTitle: input.songTitle,
        artistName: input.composerName,
        ...payload,
      },
    })

  const { data: updatedRequest } = await supabaseAdmin
    .from('studio_video_requests')
    .update({
      status: 'in_production',
      request_payload: payload,
      response_payload: result,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.videoRequest.id)
    .select('*')
    .single()

  return updatedRequest
}
