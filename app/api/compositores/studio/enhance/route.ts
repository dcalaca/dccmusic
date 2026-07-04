import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import {
  addStudioCreditTransaction,
  canCreateStudioMusicWithCredits,
  createUniqueProjectSlug,
  getFreeMusicUsage,
  getStudioCallbackUrl,
  getStudioAccess,
  getStudioCreditUsage,
  STUDIO_MUSIC_CREDITS,
} from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'
import { createStudioAudioSignedUrl, uploadStudioInputAudio } from '@/lib/studio-audio-backup'
import { formatMusicTitle } from '@/lib/normalize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_TITLE_LENGTH = 30
const MAX_STUDIO_MUSIC_DURATION_INSTRUCTION = 'duração máxima obrigatória de 4 minutos e 30 segundos, música objetiva, uma única versão completa em cada faixa, encerrar depois do final, sem recomeçar a música dentro do mesmo áudio, sem repetir a música inteira dentro do mesmo áudio, sem final longo, sem solo extenso, sem repetições para alongar'
const MAX_STUDIO_MUSIC_NEGATIVE_TAGS = 'different song, noisy audio, extended outro, long instrumental solo, repeated loop, duplicate song, restart song, repeat entire song, multiple versions in one audio, over 4 minutes 30 seconds, rushed vocals, mumbled vocals, unclear pronunciation, words too fast'

const improvementPrompts: Record<string, string> = {
  similar: 'Melhore a qualidade geral, mantendo a melodia, a letra, o ritmo e a essência o mais parecido possível com o áudio original.',
  professional: 'Transforme em uma versão mais profissional, com mixagem melhor, voz mais clara e instrumentos mais bem produzidos, mantendo a composição original.',
  vocal: 'Destaque a voz principal, deixando a interpretação mais clara e presente, mantendo letra, melodia e estrutura.',
  instruments: 'Melhore os instrumentos e o arranjo, deixando a produção mais cheia e profissional, sem mudar a essência da música.',
}

function getImprovementPrompt(value: FormDataEntryValue | null) {
  const key = String(value || 'similar')
  return improvementPrompts[key] || improvementPrompts.similar
}

function getStyle(formData: FormData) {
  const style = String(formData.get('style') || '').trim()
  const improvement = getImprovementPrompt(formData.get('improvement'))
  return [
    style || 'produção musical brasileira profissional',
    'melhor qualidade de áudio',
    'voz clara',
    'dicção natural sem atropelar palavras',
    'fraseado com respiração natural',
    'instrumentos bem mixados',
    'masterização moderna',
    MAX_STUDIO_MUSIC_DURATION_INSTRUCTION,
    improvement,
  ].join(', ').slice(0, 1000)
}

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { hasAccess, limits } = await getStudioAccess(composer.composerId)
    const usage = await getStudioCreditUsage(composer.composerId, limits)
    const hasPaidCredits = canCreateStudioMusicWithCredits(usage)
    let isFreeGeneration = false

    if (!hasAccess && !hasPaidCredits) {
      const freeMusicUsage = await getFreeMusicUsage(composer.composerId)
      if (freeMusicUsage.remaining <= 0) {
        return NextResponse.json(
          {
            error: 'Você já usou sua música grátis. Assine um plano DCC Studio IA ou faça uma recarga avulsa para melhorar músicas.',
          },
          { status: 403 }
        )
      }
      isFreeGeneration = true
    }

    if (!isFreeGeneration && !hasPaidCredits) {
      return NextResponse.json({ error: 'Você precisa de pelo menos 10 créditos para melhorar uma música.' }, { status: 429 })
    }

    const apiKey = process.env.SUNOAPI_KEY?.trim()
    if (!apiKey) return NextResponse.json({ error: 'Melhoria de música não configurada no servidor.' }, { status: 500 })

    const formData = await request.formData()
    const file = formData.get('audio')
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: 'Envie o áudio da música que deseja melhorar.' }, { status: 400 })
    }

    const rawTitle = String(formData.get('title') || '').trim().slice(0, MAX_TITLE_LENGTH) || 'Música melhorada'
    const title = formatMusicTitle(rawTitle)
    const lyric = String(formData.get('lyric') || '').trim()
    const slug = await createUniqueProjectSlug(composer.composerId, title)
    const uploaded = await uploadStudioInputAudio({
      composerId: composer.composerId,
      file,
      kind: 'enhance-source',
    })
    const uploadUrl = await createStudioAudioSignedUrl(uploaded.path, uploaded.provider)
    if (!uploadUrl) throw new Error('Não foi possível preparar o áudio enviado.')

    const { data: project, error: projectError } = await supabaseAdmin
      .from('studio_projects')
      .insert({
        composer_id: composer.composerId,
        title,
        slug,
        style: String(formData.get('style') || '').trim() || null,
        mood: 'Melhoria de áudio',
        status: 'generating',
        description: [
          'Projeto criado pela função Melhorar minha música.',
          'A IA deve tentar manter melodia, letra e essência do áudio original.',
          getImprovementPrompt(formData.get('improvement')),
        ].join('\n'),
      })
      .select('*')
      .single()

    if (projectError) throw projectError

    if (lyric) {
      const { error: lyricError } = await supabaseAdmin
        .from('studio_lyrics')
        .insert({
          project_id: project.id,
          composer_id: composer.composerId,
          content: lyric,
          is_current: true,
        })
      if (lyricError) throw lyricError
    }

    const improvementPrompt = getImprovementPrompt(formData.get('improvement'))
    const payload: any = lyric ? {
      uploadUrl,
      customMode: true,
      instrumental: false,
      prompt: lyric.slice(0, 5000),
      style: getStyle(formData),
      title,
      model: 'V5_5',
      callBackUrl: getStudioCallbackUrl('/api/studio/suno/callback'),
      audioWeight: 0.85,
      styleWeight: 0.38,
      weirdnessConstraint: 0.28,
      negativeTags: MAX_STUDIO_MUSIC_NEGATIVE_TAGS,
    } : {
      uploadUrl,
      customMode: false,
      instrumental: false,
      prompt: improvementPrompt.slice(0, 500),
      model: 'V5_5',
      callBackUrl: getStudioCallbackUrl('/api/studio/suno/callback'),
      audioWeight: 0.85,
      styleWeight: 0.38,
      weirdnessConstraint: 0.28,
      negativeTags: MAX_STUDIO_MUSIC_NEGATIVE_TAGS,
    }

    const response = await fetch('https://api.sunoapi.org/api/v1/generate/upload-cover', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => null)

    if (!response.ok || result?.code !== 200 || !result?.data?.taskId) {
      await supabaseAdmin
        .from('studio_projects')
        .update({ status: 'draft', updated_at: new Date().toISOString() })
        .eq('id', project.id)
      return NextResponse.json({ error: result?.msg || 'Não conseguimos iniciar a melhoria da música agora.' }, { status: 500 })
    }

    const taskId = result.data.taskId
    const { data: generation, error: generationError } = await supabaseAdmin
      .from('studio_generations')
      .insert({
        project_id: project.id,
        composer_id: composer.composerId,
        provider: 'sunoapi',
        provider_task_id: taskId,
        status: 'processing',
        request_payload: {
          ...payload,
          originalAudio: {
            path: uploaded.path,
            provider: uploaded.provider,
            contentType: uploaded.contentType,
            sizeBytes: uploaded.sizeBytes,
          },
          feature: 'enhance_music',
        },
        response_payload: result,
      })
      .select('*')
      .single()

    if (generationError) throw generationError

    await addStudioCreditTransaction({
      composerId: composer.composerId,
      projectId: project.id,
      action: isFreeGeneration ? 'free_music_generation' : 'music_generation',
      amount: isFreeGeneration ? 0 : STUDIO_MUSIC_CREDITS,
      description: isFreeGeneration ? 'Melhoria de música grátis no DCC Studio IA' : 'Melhoria de música no DCC Studio IA',
      metadata: { taskId, free: isFreeGeneration, feature: 'enhance_music' },
    })

    return NextResponse.json({
      success: true,
      projectId: project.id,
      generationId: generation.id,
      message: 'Melhoria iniciada. A nova versão pode levar alguns minutos para ficar pronta.',
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro melhorar música:', error)
    return NextResponse.json({ error: error.message || 'Erro ao melhorar música' }, { status: 500 })
  }
}
