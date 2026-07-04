import { randomUUID } from 'crypto'
import { supabaseAdmin } from './supabase'
import { studioMonthKey } from './studio'

const SIMPLE_COVER_MODEL = process.env.OPENAI_SIMPLE_COVER_IMAGE_MODEL || 'gpt-image-2'
const SIMPLE_COVER_SIZE = process.env.OPENAI_SIMPLE_COVER_SIZE || '1024x1024'
const SIMPLE_COVER_QUALITY = process.env.OPENAI_SIMPLE_COVER_QUALITY || 'low'

async function createSignedUrl(path: string) {
  const { data } = await supabaseAdmin.storage
    .from('studio-assets')
    .createSignedUrl(path, 60 * 60)
  return data?.signedUrl || null
}

function buildSimpleCoverPrompt(input: {
  title: string
  style?: string | null
  mood?: string | null
  description?: string | null
}) {
  const parts = [
    'Square album cover artwork for a Brazilian independent music release.',
    `Song title context: ${input.title || 'Untitled song'}.`,
    input.style ? `Music style: ${input.style}.` : null,
    input.mood ? `Mood: ${input.mood}.` : null,
    input.description ? `Story/context: ${input.description.slice(0, 500)}.` : null,
    'Modern, emotional, cinematic, streaming-platform ready, strong visual mood, no typography.',
    'No text, no letters, no logo, no watermark, no brand marks.',
  ].filter(Boolean)

  return parts.join(' ')
}

async function generateSimpleCoverImage(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SIMPLE_COVER_MODEL,
      prompt,
      size: SIMPLE_COVER_SIZE,
      quality: SIMPLE_COVER_QUALITY,
      n: 1,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    console.error('[Studio IA] Erro capa simples:', text)
    return null
  }

  const data = await response.json()
  return data.data?.[0]?.b64_json || null
}

export async function ensureSimpleStudioCover(input: {
  projectId: string
  composerId: string
  title: string
  style?: string | null
  mood?: string | null
  description?: string | null
  replaceCurrent?: boolean
}) {
  const { data: currentCover } = await supabaseAdmin
    .from('studio_covers')
    .select('id, image_url, is_premium, provider')
    .eq('project_id', input.projectId)
    .eq('composer_id', input.composerId)
    .eq('is_current', true)
    .maybeSingle()

  if (currentCover?.is_premium) return currentCover
  if (currentCover?.image_url && currentCover.provider === 'openai') return currentCover
  if (currentCover?.image_url && !input.replaceCurrent) return currentCover

  const prompt = buildSimpleCoverPrompt(input)
  const imageBase64 = await generateSimpleCoverImage(prompt)
  if (!imageBase64) return null

  const imageBuffer = Buffer.from(imageBase64, 'base64')
  const imagePath = `${input.composerId}/covers/simple/${studioMonthKey()}/${randomUUID()}.png`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('studio-assets')
    .upload(imagePath, imageBuffer, { contentType: 'image/png', upsert: false })

  if (uploadError) throw uploadError

  const signedUrl = await createSignedUrl(imagePath)
  if (!signedUrl) throw new Error('Não foi possível criar URL da capa simples.')

  await supabaseAdmin
    .from('studio_covers')
    .update({ is_current: false })
    .eq('project_id', input.projectId)
    .eq('composer_id', input.composerId)

  const { data: cover, error } = await supabaseAdmin
    .from('studio_covers')
    .insert({
      project_id: input.projectId,
      composer_id: input.composerId,
      provider: 'openai',
      image_url: signedUrl,
      image_path: imagePath,
      prompt,
      is_premium: false,
      is_current: true,
    })
    .select('id, image_url')
    .single()

  if (error) throw error
  return cover
}
