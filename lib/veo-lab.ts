export const VEO_LAB_SCENE_COUNT = 4
export const VEO_LAB_SCENE_SECONDS = 8
export const VEO_LAB_PREVIEW_SECONDS = 30

export type VeoLabAspectRatio = '9:16' | '16:9'

const sceneDirections = [
  'Opening shot: establish the place and emotional atmosphere with a strong cinematic hook.',
  'Second shot: move closer to the main subject and continue the same visual story.',
  'Third shot: raise the emotion and movement while preserving character, wardrobe, lighting, and location continuity.',
  'Final shot: deliver a memorable visual climax and a clean ending suitable for a music-release teaser.',
]

export function buildVeoLabScenePrompts(prompt: string) {
  const cleanPrompt = prompt.replace(/\s+/g, ' ').trim()

  return sceneDirections.map((direction, index) => [
    cleanPrompt,
    direction,
    `Scene ${index + 1} of ${VEO_LAB_SCENE_COUNT}.`,
    'Cinematic music video, coherent visual identity, no captions, no subtitles, no logos, no watermark.',
    'The final soundtrack will be replaced by the user selected song, so prioritize visual storytelling.',
  ].join(' '))
}

export function isVeoLabAspectRatio(value: unknown): value is VeoLabAspectRatio {
  return value === '9:16' || value === '16:9'
}

export function extractVeoVideoUri(payload: any): string | null {
  return payload?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
    || payload?.response?.generatedVideos?.[0]?.video?.uri
    || null
}
