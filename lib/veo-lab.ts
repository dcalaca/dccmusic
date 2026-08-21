export const VEO_LAB_SCENE_COUNT = 5
export const VEO_LAB_SCENE_SECONDS = 6
export const VEO_LAB_GENERATION_SECONDS = 8
export const VEO_LAB_PREVIEW_SECONDS = 30

export type VeoLabAspectRatio = '9:16' | '16:9'

export type VeoLabStoryboardScene = {
  title: string
  story: string
  videoPrompt: string
}

export type VeoLabStoryboard = {
  title: string
  logline: string
  characterBible: string
  visualStyle: string
  scenes: VeoLabStoryboardScene[]
}

export function isVeoLabStoryboard(value: unknown): value is VeoLabStoryboard {
  const item = value as VeoLabStoryboard
  return Boolean(
    item && typeof item.title === 'string' && typeof item.logline === 'string'
    && typeof item.characterBible === 'string' && typeof item.visualStyle === 'string'
    && Array.isArray(item.scenes) && item.scenes.length === VEO_LAB_SCENE_COUNT
    && item.scenes.every((scene) => scene && typeof scene.title === 'string' && typeof scene.story === 'string' && typeof scene.videoPrompt === 'string'),
  )
}

export function buildVeoLabScenePrompts(storyboard: VeoLabStoryboard) {
  return storyboard.scenes.map((scene, index) => [
    `SCENE ${index + 1} OF ${VEO_LAB_SCENE_COUNT}: ${scene.videoPrompt}`,
    `LOCKED CHARACTERS — reproduce exactly in every scene: ${storyboard.characterBible}`,
    `LOCKED VISUAL LANGUAGE: ${storyboard.visualStyle}`,
    `Narrative purpose: ${scene.story}`,
    'This scene must have a clearly different location, action, framing, and camera movement from all other scenes while advancing the same continuous story.',
    'Cinematic music video, adult characters, no dialogue, no captions, no subtitles, no logos, no watermark.',
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
