import { isVeoLabStoryboard, VEO_LAB_SCENE_COUNT, type VeoLabStoryboard } from '@/lib/veo-lab'

function extractJson(text: string) {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const firstBrace = clean.indexOf('{')
  const lastBrace = clean.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error('JSON ausente')
  return JSON.parse(clean.slice(firstBrace, lastBrace + 1))
}

function lyricLinesFrom(lyrics: string) {
  return lyrics.split(/\r?\n/)
    .map((line) => line.replace(/^\s*\[[^\]]+]\s*/, '').trim())
    .filter((line) => line.length >= 3 && !/^\s*(verso|refrão|ponte|intro|final)\s*:?\s*$/i.test(line))
}

export async function createVeoLabStoryboard(lyrics: string, visualDirection: string): Promise<VeoLabStoryboard> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('A chave da OpenAI não está configurada.')
  const model = process.env.OPENAI_VIDEO_STORY_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini'
  const instructions = [
    'You are a Brazilian music-video creative director. Read the song lyrics and design one coherent 30-second release teaser split into exactly five chronological scenes of six seconds.',
    'The five scenes MUST show different actions, compositions and story beats. Together they form a beginning, development, turn, climax and resolution.',
    'Create a precise locked character bible: apparent age, face, hair, skin tone, body, wardrobe and accessories. Never use celebrity names. Keep the exact same people and wardrobe throughout.',
    'LANGUAGE RULE: everything visible to the user MUST be written in natural Brazilian Portuguese: title, logline, every scene title, every scene story and every caption.',
    'Only the technical fields characterBible, visualStyle and videoPrompt may be written in detailed English optimized for Veo. Never write scene story in English.',
    'For each scene, choose one short caption from the supplied lyrics that emotionally matches that six-second moment. Preserve the lyric wording and use at most 12 words.',
    'Do not put typography, subtitles, logos, singing or dialogue inside videoPrompt. Captions are rendered separately by the application.',
    `Optional user visual reference: ${visualDirection || 'None. Infer the best cinematic visual direction from the lyrics, mood and story.'}`,
    `LYRICS:\n${lyrics.slice(0, 12000)}`,
    'Return only valid JSON with this shape: {"title":"...","logline":"...","characterBible":"...","visualStyle":"...","scenes":[{"title":"...","story":"...","videoPrompt":"...","caption":"short excerpt from lyrics"}]}. Exactly five scenes.',
  ].join('\n\n')
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Você é um diretor de videoclipes brasileiro. Todo texto visível ao usuário deve ser escrito em português do Brasil. Apenas prompts técnicos destinados ao Veo são escritos em inglês. Retorne JSON estruturado e pronto para produção.' },
        { role: 'user', content: instructions },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'music_video_storyboard',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'logline', 'characterBible', 'visualStyle', 'scenes'],
            properties: {
              title: { type: 'string', description: 'Título do roteiro em português brasileiro.' },
              logline: { type: 'string', description: 'Resumo da história em português brasileiro.' },
              characterBible: { type: 'string', description: 'Technical locked character description in English for Veo.' },
              visualStyle: { type: 'string', description: 'Technical visual style in English for Veo.' },
              scenes: {
                type: 'array', minItems: 5, maxItems: 5,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['title', 'story', 'videoPrompt', 'caption'],
                  properties: {
                    title: { type: 'string', description: 'Nome curto da cena em português brasileiro.' },
                    story: { type: 'string', description: 'Descrição narrativa da cena em português brasileiro. Nunca em inglês.' },
                    videoPrompt: { type: 'string', description: 'Detailed technical generation prompt in English for Veo.' },
                    caption: { type: 'string', description: 'Trecho curto da letra original, em português brasileiro.' },
                  },
                },
              },
            },
          },
        },
      },
      temperature: 0.65,
      max_tokens: 4096,
    }),
    cache: 'no-store',
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(result?.error?.message || 'A OpenAI não conseguiu interpretar a letra.')
  const text = String(result?.choices?.[0]?.message?.content || '')
  let storyboard: any
  try { storyboard = extractJson(text) } catch { throw new Error('A OpenAI não devolveu o roteiro estruturado. Tente novamente.') }
  if (Array.isArray(storyboard?.scenes) && storyboard.scenes.length === VEO_LAB_SCENE_COUNT) {
    const lyricLines = lyricLinesFrom(lyrics)
    storyboard.scenes = storyboard.scenes.map((scene: any, index: number) => ({
      ...scene,
      caption: typeof scene?.caption === 'string' && scene.caption.trim()
        ? scene.caption.trim()
        : (lyricLines[Math.min(lyricLines.length - 1, Math.floor(index * lyricLines.length / VEO_LAB_SCENE_COUNT))] || ''),
    }))
  }
  if (!isVeoLabStoryboard(storyboard)) throw new Error(`A OpenAI não devolveu as ${VEO_LAB_SCENE_COUNT} cenas completas.`)
  return storyboard
}
