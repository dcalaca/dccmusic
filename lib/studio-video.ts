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

  const videoTaskId = result?.data?.taskId || result?.data?.task_id || null

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
