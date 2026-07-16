import { supabaseAdmin } from '@/lib/supabase'
import { getStudioCallbackUrl } from '@/lib/studio'

function getAudioId(version: any, generation: any) {
  return (
    generation?.provider_audio_id ||
    version?.provider_payload?.id ||
    version?.provider_payload?.audio_id ||
    version?.provider_payload?.audioId ||
    null
  )
}

function getExistingVideoTaskId(result: any) {
  return result?.data?.taskId || result?.data?.task_id || null
}

function isExistingMp4Conflict(result: any, response: Response) {
  const message = String(result?.msg || '').toLowerCase()
  return response.status === 409 || result?.code === 409 || message.includes('already exists')
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
      response_payload: input.responsePayload || null,
      error_message: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoRequestId)
    .select('*')
    .single()

  if (error) throw error
  return data
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

  const { data: completedRequest } = await supabaseAdmin
    .from('studio_video_requests')
    .select('*')
    .eq('project_id', videoRequest.project_id)
    .eq('composer_id', videoRequest.composer_id)
    .eq('status', 'completed')
    .not('video_url', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (completedRequest?.video_url) {
    return markVideoRequestCompleted(videoRequest.id, {
      providerTaskId: completedRequest.provider_task_id || existingTaskId,
      videoUrl: completedRequest.video_url,
      responsePayload: responsePayload || completedRequest.response_payload,
    })
  }

  return null
}

export async function startStudioVideoGeneration(videoRequestId: string) {
  const { data: videoRequest, error: requestError } = await supabaseAdmin
    .from('studio_video_requests')
    .select('*')
    .eq('id', videoRequestId)
    .maybeSingle()

  if (requestError) throw requestError
  if (!videoRequest) throw new Error('Solicitação de vídeo com letra não encontrada.')

  if (!process.env.SUNOAPI_KEY) {
    throw new Error('Geração de vídeo com letra não configurada no servidor.')
  }

  const [{ data: project }, { data: composer }, { data: version }] = await Promise.all([
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
    supabaseAdmin
      .from('studio_versions')
      .select('*')
      .eq('project_id', videoRequest.project_id)
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const { data: generation } = await supabaseAdmin
    .from('studio_generations')
    .select('*')
    .eq('id', version?.generation_id || '')
    .maybeSingle()

  const fallbackGeneration = generation ? null : await supabaseAdmin
    .from('studio_generations')
    .select('*')
    .eq('project_id', videoRequest.project_id)
    .eq('composer_id', videoRequest.composer_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const generationToUse = generation || fallbackGeneration?.data
  const taskId = generationToUse?.provider_task_id
  const audioId = getAudioId(version, generationToUse)

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

  const recoveredFromDb = await recoverExistingVideoRequest(videoRequest, null)
  if (recoveredFromDb) return recoveredFromDb

  const payload = {
    taskId,
    audioId,
    callBackUrl: getStudioCallbackUrl('/api/studio/suno/video-callback'),
    author: String(composer?.name || project?.title || 'DCC Music').slice(0, 50),
    domainName: 'DCC Music',
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

  if (isExistingMp4Conflict(result, response)) {
    const existingTaskId = getExistingVideoTaskId(result)
    const recovered = await recoverExistingVideoRequest(videoRequest, existingTaskId, result)
    if (recovered) return recovered

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
    const errorMessage = result?.msg || 'Não consegui iniciar a geração do vídeo com letra agora.'
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
