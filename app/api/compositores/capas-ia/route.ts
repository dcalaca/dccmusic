import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import * as db from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MONTHLY_LIMIT = 100
const COOLDOWN_SECONDS = 30
const BUCKET_NAME = 'ai-covers'

const allowedMusicStyles = ['Sertanejo', 'Funk', 'Trap', 'Gospel', 'Pagode', 'Rock', 'MPB', 'Pop', 'Eletrônica']
const allowedVisualStyles = ['Realista', 'Cinematográfica', 'Anime', 'Vintage', 'Neon', 'Minimalista', 'Sombria', 'Romântica']

type CoverRow = {
  id: string
  title: string | null
  input_text: string
  music_style: string
  visual_style: string
  prompt: string
  image_path: string
  image_mime: string
  month_key: string
  created_at: string
}

function currentMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function isGoldPlan(plan: db.Plan | null) {
  if (!plan || !plan.isActive) return false

  const name = `${plan.name || ''} ${plan.slug || ''}`.toLowerCase()
  return Boolean(
    plan.hasGoldBadge ||
    plan.hasPriorityFeatured ||
    name.includes('ouro') ||
    name.includes('gold')
  )
}

async function getGoldAccess(composerId: string) {
  const plan = await db.getComposerActivePlan(composerId)
  return {
    plan,
    hasAccess: isGoldPlan(plan),
  }
}

async function ensureBucket() {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
  if (listError) {
    console.error('[Capas IA] Erro ao listar buckets:', listError)
    return
  }

  if (buckets?.some((bucket) => bucket.name === BUCKET_NAME)) return

  const { error } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/png'],
  })

  if (error && !String(error.message || '').toLowerCase().includes('already exists')) {
    throw error
  }
}

async function createSignedUrl(imagePath: string) {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(imagePath, 60 * 60)

  if (error) {
    console.error('[Capas IA] Erro ao criar URL assinada:', error)
    return null
  }

  return data.signedUrl
}

async function getUsage(composerId: string, monthKey: string) {
  const { count, error } = await supabaseAdmin
    .from('dccmusic_ai_covers')
    .select('*', { count: 'exact', head: true })
    .eq('composer_id', composerId)
    .eq('month_key', monthKey)

  if (error) throw error
  return count || 0
}

async function getHistory(composerId: string) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_ai_covers')
    .select('*')
    .eq('composer_id', composerId)
    .order('created_at', { ascending: false })
    .limit(24)

  if (error) throw error

  return await Promise.all(
    ((data || []) as CoverRow[]).map(async (cover) => ({
      id: cover.id,
      title: cover.title,
      musicStyle: cover.music_style,
      visualStyle: cover.visual_style,
      createdAt: cover.created_at,
      imageUrl: await createSignedUrl(cover.image_path),
    }))
  )
}

async function checkCooldown(composerId: string) {
  const since = new Date(Date.now() - COOLDOWN_SECONDS * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('dccmusic_ai_covers')
    .select('created_at')
    .eq('composer_id', composerId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw error

  if (data && data.length > 0) {
    const lastCreatedAt = new Date(data[0].created_at).getTime()
    const waitSeconds = Math.max(1, COOLDOWN_SECONDS - Math.floor((Date.now() - lastCreatedAt) / 1000))
    return waitSeconds
  }

  return 0
}

async function createProfessionalPrompt(inputText: string, musicStyle: string, visualStyle: string, coverDescription: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('A geração de capas não está configurada no servidor.')
  }

  const visualDirection = coverDescription
    ? `\nDireção visual opcional pedida pelo usuário:\n${coverDescription}\n`
    : '\nDireção visual opcional pedida pelo usuário: não informada. Crie somente a imagem com base na emoção da música.\n'

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content:
            'Você é um diretor de arte musical premium. Transforme letras ou descrições de músicas em prompts curtos e fortes para capas profissionais de álbum. Não inclua texto, letras, logotipos, marcas, watermark ou tipografia na imagem. Foque emoção, ambiente, luz, composição, textura e qualidade cinematográfica.',
        },
        {
          role: 'user',
          content: `Estilo musical: ${musicStyle}\nEstilo visual: ${visualStyle}\nLetra ou descrição:\n${inputText}${visualDirection}\nCrie um prompt em inglês para gerar uma capa quadrada 1:1, premium, moderna, emocional, cinematográfica, nível Spotify/Apple Music/YouTube Music. Responda somente o prompt final.`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Capas IA] Erro GPT:', errorText)
    throw new Error('Não consegui interpretar a música agora. Tente novamente em instantes.')
  }

  const data = await response.json()
  const prompt = data.choices?.[0]?.message?.content?.trim()

  if (!prompt) {
    throw new Error('A IA não retornou um prompt válido')
  }

  return `${prompt}\n\nSquare album cover, no text, no letters, no logo, no watermark, high-end professional music cover, cinematic lighting, rich details, polished streaming-platform artwork.`
}

async function generateCoverImage(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('A geração de capas não está configurada no servidor.')
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
      quality: 'high',
      n: 1,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Capas IA] Erro Image API:', errorText)
    throw new Error('Não consegui gerar a capa agora. Tente novamente em instantes.')
  }

  const data = await response.json()
  const imageBase64 = data.data?.[0]?.b64_json

  if (!imageBase64) {
    throw new Error('A geração de imagem não retornou uma capa válida.')
  }

  return imageBase64
}

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { plan, hasAccess } = await getGoldAccess(composer.composerId)
    if (!hasAccess) {
      return NextResponse.json(
        {
          allowed: false,
          error: 'O Gerador de Capas IA é exclusivo para assinantes ativos do Plano Ouro.',
          planName: plan?.name || null,
        },
        { status: 403 }
      )
    }

    const monthKey = currentMonthKey()
    const [used, history] = await Promise.all([
      getUsage(composer.composerId, monthKey),
      getHistory(composer.composerId),
    ])

    return NextResponse.json({
      allowed: true,
      limit: MONTHLY_LIMIT,
      used,
      remaining: Math.max(0, MONTHLY_LIMIT - used),
      monthKey,
      planName: plan?.name || 'Plano Ouro',
      history,
    })
  } catch (error: any) {
    console.error('[Capas IA] Erro no status:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar Gerador de Capas IA' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { hasAccess } = await getGoldAccess(composer.composerId)
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'O Gerador de Capas IA é exclusivo para assinantes ativos do Plano Ouro.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : ''
    const inputText = typeof body.inputText === 'string' ? body.inputText.trim() : ''
    const coverDescription = typeof body.coverDescription === 'string' ? body.coverDescription.trim().slice(0, 1500) : ''
    const musicStyle = allowedMusicStyles.includes(body.musicStyle) ? body.musicStyle : 'Pop'
    const visualStyle = allowedVisualStyles.includes(body.visualStyle) ? body.visualStyle : 'Cinematográfica'

    if (inputText.length < 20) {
      return NextResponse.json(
        { error: 'Escreva pelo menos uma descrição ou trecho da letra com 20 caracteres.' },
        { status: 400 }
      )
    }

    if (inputText.length > 6000) {
      return NextResponse.json(
        { error: 'O texto está muito grande. Use até 6000 caracteres.' },
        { status: 400 }
      )
    }

    const waitSeconds = await checkCooldown(composer.composerId)
    if (waitSeconds > 0) {
      return NextResponse.json(
        { error: `Aguarde ${waitSeconds}s para gerar uma nova capa.`, waitSeconds },
        { status: 429 }
      )
    }

    const monthKey = currentMonthKey()
    const used = await getUsage(composer.composerId, monthKey)
    if (used >= MONTHLY_LIMIT) {
      return NextResponse.json(
        {
          error: 'Você atingiu o limite mensal de 100 capas do Plano Ouro. O contador será renovado automaticamente no próximo mês.',
          used,
          limit: MONTHLY_LIMIT,
        },
        { status: 429 }
      )
    }

    await ensureBucket()

    const prompt = await createProfessionalPrompt(inputText, musicStyle, visualStyle, coverDescription)
    const imageBase64 = await generateCoverImage(prompt)
    const imageBuffer = Buffer.from(imageBase64, 'base64')
    const imagePath = `${composer.composerId}/${monthKey}/${randomUUID()}.png`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(imagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: false,
      })

    if (uploadError) {
      console.error('[Capas IA] Erro ao salvar imagem:', uploadError)
      throw new Error('A capa foi gerada, mas não consegui salvar no histórico.')
    }

    const { data: cover, error: insertError } = await supabaseAdmin
      .from('dccmusic_ai_covers')
      .insert({
        composer_id: composer.composerId,
        title: title || null,
        input_text: inputText,
        music_style: musicStyle,
        visual_style: visualStyle,
        prompt,
        image_path: imagePath,
        image_mime: 'image/png',
        month_key: monthKey,
      })
      .select('*')
      .single()

    if (insertError) throw insertError

    const imageUrl = await createSignedUrl(imagePath)
    const newUsed = used + 1

    return NextResponse.json({
      success: true,
      cover: {
        id: cover.id,
        title: cover.title,
        musicStyle: cover.music_style,
        visualStyle: cover.visual_style,
        createdAt: cover.created_at,
        imageUrl,
      },
      used: newUsed,
      limit: MONTHLY_LIMIT,
      remaining: Math.max(0, MONTHLY_LIMIT - newUsed),
    })
  } catch (error: any) {
    console.error('[Capas IA] Erro ao gerar capa:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar capa' },
      { status: 500 }
    )
  }
}
