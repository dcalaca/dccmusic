import { getGoogleCloudAccessToken, getVertexPublisherModelUrl } from '@/lib/veo-vertex'
import { isVeoLabStoryboard, VEO_LAB_SCENE_COUNT, type VeoLabStoryboard } from '@/lib/veo-lab'

function extractJson(text: string) {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const firstBrace = clean.indexOf('{')
  const lastBrace = clean.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error('JSON ausente')
  return JSON.parse(clean.slice(firstBrace, lastBrace + 1))
}

export async function createVeoLabStoryboard(lyrics: string, visualDirection: string): Promise<VeoLabStoryboard> {
  const accessToken = await getGoogleCloudAccessToken()
  const model = process.env.VEO_STORY_MODEL || 'gemini-2.5-flash'
  const response = await fetch(`${getVertexPublisherModelUrl(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: [
        'You are a Brazilian music-video creative director. Read the song lyrics and design one coherent 30-second release teaser split into exactly five chronological scenes of six seconds.',
        'The five scenes MUST show different actions, compositions and story beats. Together they form a beginning, development, turn, climax and resolution.',
        'Create a precise locked character bible: apparent age, face, hair, skin tone, body, wardrobe and accessories. Never use celebrity names. Keep the exact same people and wardrobe throughout.',
        'Write title, logline, scene story summaries and captions in Brazilian Portuguese. Write characterBible, visualStyle and videoPrompt in detailed English optimized for Veo.',
        'For each scene, choose one short caption from the supplied lyrics that emotionally matches that six-second moment. Preserve the lyric wording and use at most 12 words.',
        'Do not quote or display lyrics inside the video. No typography, subtitles, logos, singing or dialogue.',
        `Optional user visual reference: ${visualDirection || 'None. Infer the best cinematic visual direction from the lyrics, mood and story.'}`,
        `LYRICS:\n${lyrics.slice(0, 12000)}`,
        'Return only valid JSON with this shape: {"title":"...","logline":"...","characterBible":"...","visualStyle":"...","scenes":[{"title":"...","story":"...","videoPrompt":"...","caption":"short excerpt from lyrics"}]}. Exactly five scenes.',
      ].join('\n\n') }] }],
      generationConfig: {
        temperature: 0.65,
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
        responseSchema: {
          type: 'OBJECT',
          required: ['title', 'logline', 'characterBible', 'visualStyle', 'scenes'],
          properties: {
            title: { type: 'STRING' },
            logline: { type: 'STRING' },
            characterBible: { type: 'STRING' },
            visualStyle: { type: 'STRING' },
            scenes: {
              type: 'ARRAY', minItems: 5, maxItems: 5,
              items: {
                type: 'OBJECT', required: ['title', 'story', 'videoPrompt', 'caption'],
                properties: {
                  title: { type: 'STRING' },
                  story: { type: 'STRING' },
                  videoPrompt: { type: 'STRING' },
                  caption: { type: 'STRING' },
                },
              },
            },
          },
        },
      },
    }),
    cache: 'no-store',
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(result?.error?.message || 'Não foi possível interpretar a letra.')
  const text = result?.candidates?.[0]?.content?.parts
    ?.filter((part: any) => !part?.thought && typeof part?.text === 'string')
    .map((part: any) => part.text)
    .join('') || ''
  let storyboard: any
  try { storyboard = extractJson(text) } catch { throw new Error('A IA não devolveu um roteiro válido. Tente novamente.') }
  if (Array.isArray(storyboard?.scenes) && storyboard.scenes.length === VEO_LAB_SCENE_COUNT) {
    const lyricLines = lyrics.split(/\r?\n/)
      .map((line) => line.replace(/^\s*\[[^\]]+]\s*/, '').trim())
      .filter((line) => line.length >= 3 && !/^\s*(verso|refrão|ponte|intro|final)\s*:?\s*$/i.test(line))
    storyboard.scenes = storyboard.scenes.map((scene: any, index: number) => ({
      ...scene,
      caption: typeof scene?.caption === 'string' && scene.caption.trim()
        ? scene.caption.trim()
        : (lyricLines[Math.min(lyricLines.length - 1, Math.floor(index * lyricLines.length / VEO_LAB_SCENE_COUNT))] || ''),
    }))
  }
  if (!isVeoLabStoryboard(storyboard)) throw new Error(`O roteiro precisa ter exatamente ${VEO_LAB_SCENE_COUNT} cenas completas.`)
  return storyboard
}

export async function createVeoCharacterReference(storyboard: VeoLabStoryboard) {
  const accessToken = await getGoogleCloudAccessToken()
  const model = process.env.VEO_CHARACTER_IMAGE_MODEL || 'imagen-4.0-generate-001'
  const response = await fetch(`${getVertexPublisherModelUrl(model)}:predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      instances: [{ prompt: [
        'Create a clean cinematic casting reference photograph for a music video.',
        `Characters: ${storyboard.characterBible}`,
        `Visual language: ${storyboard.visualStyle}`,
        'Show every recurring character together, full body, facing camera, neutral simple studio background, wardrobe and accessories clearly visible, realistic anatomy, adult characters only.',
        'No text, no labels, no collage borders, no logos, no watermark.',
      ].join(' ') }],
      parameters: { sampleCount: 1, aspectRatio: '16:9', personGeneration: 'allow_adult' },
    }),
    cache: 'no-store',
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(result?.error?.message || 'Não foi possível criar a referência dos personagens.')
  const bytesBase64Encoded = result?.predictions?.[0]?.bytesBase64Encoded
  if (!bytesBase64Encoded) throw new Error('O Google não devolveu a referência dos personagens.')
  return { bytesBase64Encoded: String(bytesBase64Encoded), mimeType: String(result?.predictions?.[0]?.mimeType || 'image/png') }
}
