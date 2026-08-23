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
import {
  createStudioAudioSignedUrl,
  downloadStudioAudioBuffer,
  uploadStudioInputAudio,
  validateStudioInputUploadedAsset,
} from '@/lib/studio-audio-backup'
import { formatMusicTitle } from '@/lib/normalize'
import { transcribeStudioAudioBuffer, transcribeStudioAudioFile } from '@/lib/studio-transcribe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_TITLE_LENGTH = 30
const MAX_STUDIO_MUSIC_DURATION_INSTRUCTION = 'duração máxima obrigatória de 4 minutos e 30 segundos, música objetiva, uma única versão completa em cada faixa, encerrar depois do final, sem recomeçar a música dentro do mesmo áudio, sem repetir a música inteira dentro do mesmo áudio, sem final longo, sem solo extenso, sem repetições para alongar'
const MAX_STUDIO_MUSIC_NEGATIVE_TAGS = 'different song, noisy audio, extended outro, long instrumental solo, repeated loop, duplicate song, restart song, repeat entire song, multiple versions in one audio, over 4 minutes 30 seconds, rushed vocals, mumbled vocals, unclear pronunciation, words too fast'

const improvementPrompts: Record<string, string> = {
  similar: 'Melhore a qualidade geral, mantendo a melodia, a letra, o ritmo e a essência o mais parecido possível com o áudio original.',
  professional: 'Transforme em uma versão mais profissional, com mixagem melhor, voz mais clara e instrumentos mais bem produzidos, mantendo a composição original.',
  vocal: 'Destaque a voz principal, deixando a interpretação mais clara e presente, mantendo letra, melodia e estrutura.',
  instruments: 'Melhore os instrumentos e o arranjo, deixando a produção mais cheia e profissional, sem mudar a essência da música.',
}

const voicePrompts: Record<string, string> = {
  same: 'preserve o perfil vocal do áudio original',
  male: 'voz principal masculina, natural e expressiva, male lead vocal',
  female: 'voz principal feminina, natural e expressiva, female lead vocal',
}

const voiceStylePrompts: Record<string, string> = {
  natural: 'interpretação vocal natural e equilibrada',
  soft: 'voz suave, íntima e delicada, soft vocal delivery',
  powerful: 'voz potente, firme e emocional, powerful vocal delivery',
  deep: 'voz mais grave e encorpada, warm deep vocal tone',
  bright: 'voz mais aguda, clara e brilhante, bright clear vocal tone',
}

function getImprovementPrompt(value: any) {
  const key = String(value || 'similar')
  return improvementPrompts[key] || improvementPrompts.similar
}

function getVoicePrompt(value: any) {
  const key = String(value || 'same')
  return voicePrompts[key] || voicePrompts.same
}

function getVoiceStylePrompt(value: any) {
  const key = String(value || 'natural')
  return voiceStylePrompts[key] || voiceStylePrompts.natural
}

function getStyle(input: {
  style?: string | null
  improvement?: string | null
  voice?: string | null
  voiceStyle?: string | null
}) {
  const style = String(input.style || '').trim()
  const improvement = getImprovementPrompt(input.improvement)
  return [
    style || 'produção musical brasileira profissional',
    getVoicePrompt(input.voice),
    getVoiceStylePrompt(input.voiceStyle),
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

    const contentTypeHeader = request.headers.get('content-type') || ''
    let rawTitle = 'Música melhorada'
    let style = ''
    let improvement = 'similar'
    let voice = 'same'
    let voiceStyle = 'natural'
    let lyric = ''
    let uploaded: {
      path: string
      provider: 'r2' | 'supabase'
      contentType: string
      sizeBytes: number
    } | null = null
    let sourceFile: File | null = null

    if (contentTypeHeader.includes('application/json')) {
      const body = await request.json()
      rawTitle = String(body?.title || '').trim().slice(0, MAX_TITLE_LENGTH) || 'Música melhorada'
      style = String(body?.style || '').trim()
      improvement = String(body?.improvement || 'similar')
      voice = String(body?.voice || 'same')
      voiceStyle = String(body?.voiceStyle || 'natural')
      lyric = String(body?.lyric || '').trim()

      validateStudioInputUploadedAsset({
        composerId: composer.composerId,
        path: String(body?.audioPath || ''),
        provider: String(body?.audioProvider || 'r2'),
        contentType: String(body?.audioContentType || 'audio/mpeg'),
        sizeBytes: Number(body?.audioSizeBytes) || 0,
      })

      uploaded = {
        path: String(body.audioPath),
        provider: 'r2',
        contentType: String(body.audioContentType || 'audio/mpeg'),
        sizeBytes: Number(body.audioSizeBytes) || 0,
      }
    } else {
      const formData = await request.formData()
      const file = formData.get('audio')
      if (!(file instanceof File) || file.size <= 0) {
        return NextResponse.json({ error: 'Envie o áudio da música que deseja melhorar.' }, { status: 400 })
      }
      sourceFile = file
      rawTitle = String(formData.get('title') || '').trim().slice(0, MAX_TITLE_LENGTH) || 'Música melhorada'
      style = String(formData.get('style') || '').trim()
      improvement = String(formData.get('improvement') || 'similar')
      voice = String(formData.get('voice') || 'same')
      voiceStyle = String(formData.get('voiceStyle') || 'natural')
      lyric = String(formData.get('lyric') || '').trim()
      uploaded = await uploadStudioInputAudio({
        composerId: composer.composerId,
        file,
        kind: 'enhance-source',
      })
    }

    if (!uploaded) {
      return NextResponse.json({ error: 'Envie o áudio da música que deseja melhorar.' }, { status: 400 })
    }

    const title = formatMusicTitle(rawTitle)
    let lyricSource: 'manual' | 'whisper' | 'none' = lyric ? 'manual' : 'none'

    if (!lyric) {
      try {
        if (sourceFile) {
          lyric = await transcribeStudioAudioFile(sourceFile, sourceFile.name || 'enhance-source.mp3')
        } else {
          const downloaded = await downloadStudioAudioBuffer(uploaded.path, uploaded.provider)
          if (!downloaded) throw new Error('Áudio indisponível para transcrição.')
          lyric = await transcribeStudioAudioBuffer({
            buffer: downloaded.buffer,
            fileName: uploaded.path.split('/').pop() || 'enhance-source.mp3',
            contentType: downloaded.contentType || uploaded.contentType,
          })
        }
        lyricSource = 'whisper'
      } catch (transcriptionError: any) {
        console.error('[Studio IA] Transcrição automática no enhance falhou:', transcriptionError)
      }
    }

    const slug = await createUniqueProjectSlug(composer.composerId, title)
    const uploadUrl = await createStudioAudioSignedUrl(uploaded.path, uploaded.provider)
    if (!uploadUrl) throw new Error('Não foi possível preparar o áudio enviado.')

    const { data: project, error: projectError } = await supabaseAdmin
      .from('studio_projects')
      .insert({
        composer_id: composer.composerId,
        title,
        slug,
        style: style || null,
        mood: 'Melhoria de áudio',
        status: 'generating',
        description: [
          'Projeto criado pela função Melhorar minha música.',
          'A IA deve tentar manter melodia, letra e essência do áudio original.',
          getImprovementPrompt(improvement),
          `Preferência de voz: ${getVoicePrompt(voice)}.`,
          `Estilo vocal: ${getVoiceStylePrompt(voiceStyle)}.`,
          lyricSource === 'whisper' ? 'Letra obtida por transcrição automática do áudio enviado.' : null,
        ].filter(Boolean).join('\n'),
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

    const improvementPrompt = getImprovementPrompt(improvement)
    const explicitVoiceChange = voice === 'male' || voice === 'female'
    const audioWeight = explicitVoiceChange ? 0.72 : 0.85
    const styleWeight = explicitVoiceChange ? 0.52 : 0.38

    const payload: any = lyric ? {
      uploadUrl,
      customMode: true,
      instrumental: false,
      prompt: lyric.slice(0, 5000),
      style: getStyle({ style, improvement, voice, voiceStyle }),
      title,
      model: 'V5_5',
      callBackUrl: getStudioCallbackUrl('/api/studio/suno/callback'),
      audioWeight,
      styleWeight,
      weirdnessConstraint: 0.28,
      negativeTags: MAX_STUDIO_MUSIC_NEGATIVE_TAGS,
    } : {
      uploadUrl,
      customMode: false,
      instrumental: false,
      prompt: [
        improvementPrompt,
        getVoicePrompt(voice),
        getVoiceStylePrompt(voiceStyle),
      ].join('. ').slice(0, 500),
      model: 'V5_5',
      callBackUrl: getStudioCallbackUrl('/api/studio/suno/callback'),
      audioWeight,
      styleWeight,
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
          lyricSource,
          voice,
          voiceStyle,
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
      metadata: { taskId, free: isFreeGeneration, feature: 'enhance_music', lyricSource, voice, voiceStyle },
    })

    return NextResponse.json({
      success: true,
      projectId: project.id,
      generationId: generation.id,
      lyricTranscribed: lyricSource === 'whisper',
      message: lyricSource === 'whisper'
        ? 'Letra transcrita do áudio e melhoria iniciada. Acompanhe no projeto.'
        : 'Melhoria iniciada. A nova versão pode levar alguns minutos para ficar pronta.',
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro melhorar música:', error)
    return NextResponse.json({ error: error.message || 'Erro ao melhorar música' }, { status: 500 })
  }
}
