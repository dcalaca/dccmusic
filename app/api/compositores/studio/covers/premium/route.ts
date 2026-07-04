import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import {
  addStudioCreditTransaction,
  getCurrentProjectAssets,
  getProjectForComposer,
  getStudioAccess,
  getStudioCreditUsage,
  STUDIO_PREMIUM_COVER_CREDITS,
  studioMonthKey,
} from '@/lib/studio'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function createSignedUrl(path: string) {
  const { data } = await supabaseAdmin.storage
    .from('studio-assets')
    .createSignedUrl(path, 60 * 60)
  return data?.signedUrl || null
}

async function buildCoverPrompt(input: {
  title: string
  style: string | null
  mood: string | null
  lyric: string
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('A geração de capa premium não está configurada no servidor.')

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
          content: 'Você é diretor de arte musical. Crie prompts premium para capas de música, sem texto, sem logotipo e sem marca d’água.',
        },
        {
          role: 'user',
          content: `Nome: ${input.title}\nEstilo: ${input.style || 'Livre'}\nClima: ${input.mood || 'Livre'}\nLetra:\n${input.lyric.slice(0, 3000)}\n\nCrie um prompt em inglês para uma capa quadrada cinematográfica, moderna, profissional, emocional e pronta para streaming. Responda só o prompt.`,
        },
      ],
    }),
  })

  if (!response.ok) throw new Error('Não consegui criar o prompt da capa premium.')
  const data = await response.json()
  return `${data.choices?.[0]?.message?.content || ''}\nNo text, no letters, no logo, no watermark.`
}

async function generateImage(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('A geração de capa premium não está configurada no servidor.')

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
      quality: 'low',
      n: 1,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('[Studio IA] Erro imagem premium:', text)
    throw new Error('Não consegui gerar a capa premium agora.')
  }

  const data = await response.json()
  const imageBase64 = data.data?.[0]?.b64_json
  if (!imageBase64) throw new Error('A geração de imagem não retornou uma capa válida.')
  return imageBase64
}

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { hasAccess, limits } = await getStudioAccess(composer.composerId)
    if (!hasAccess) return NextResponse.json({ error: 'Recurso exclusivo do DCC Studio IA.' }, { status: 403 })

    if (limits.premiumCoverLimit <= 0) {
      return NextResponse.json(
        { error: 'Capas premium IA estão disponíveis a partir do Studio Pro.' },
        { status: 403 }
      )
    }

    const usage = await getStudioCreditUsage(composer.composerId, limits)
    if (usage.premiumCoverGenerations >= usage.premiumCoverLimit) {
      return NextResponse.json(
        { error: `Você atingiu o limite mensal de ${usage.premiumCoverLimit} capas premium IA.` },
        { status: 429 }
      )
    }

    if (usage.remaining < STUDIO_PREMIUM_COVER_CREDITS) {
      return NextResponse.json({ error: 'Créditos insuficientes para melhorar a capa.' }, { status: 429 })
    }

    const body = await request.json()
    const project = await getProjectForComposer(body.projectId, composer.composerId)
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const { lyric } = await getCurrentProjectAssets(project.id)
    const prompt = await buildCoverPrompt({
      title: project.title,
      style: project.style,
      mood: project.mood,
      lyric: lyric?.content || project.description || project.title,
    })
    const imageBase64 = await generateImage(prompt)
    const imageBuffer = Buffer.from(imageBase64, 'base64')
    const imagePath = `${composer.composerId}/covers/${studioMonthKey()}/${randomUUID()}.png`

    await supabaseAdmin.storage
      .from('studio-assets')
      .upload(imagePath, imageBuffer, { contentType: 'image/png', upsert: false })

    const signedUrl = await createSignedUrl(imagePath)

    await supabaseAdmin
      .from('studio_covers')
      .update({ is_current: false })
      .eq('project_id', project.id)
      .eq('composer_id', composer.composerId)

    const { data: cover, error } = await supabaseAdmin
      .from('studio_covers')
      .insert({
        project_id: project.id,
        composer_id: composer.composerId,
        provider: 'openai',
        image_url: signedUrl,
        image_path: imagePath,
        prompt,
        is_premium: true,
        is_current: true,
      })
      .select('*')
      .single()

    if (error) throw error

    await addStudioCreditTransaction({
      composerId: composer.composerId,
      projectId: project.id,
      action: 'premium_cover',
      amount: STUDIO_PREMIUM_COVER_CREDITS,
      description: 'Melhoria de capa com IA Premium',
    })

    return NextResponse.json({
      cover: {
        id: cover.id,
        imageUrl: signedUrl,
        isPremium: true,
      },
    })
  } catch (error: any) {
    console.error('[Studio IA] Erro capa premium:', error)
    return NextResponse.json({ error: error.message || 'Erro ao gerar capa premium' }, { status: 500 })
  }
}
