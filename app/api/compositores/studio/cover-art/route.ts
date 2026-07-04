import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { addStudioCreditTransaction, getStudioAccess, getStudioCreditUsage } from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET_NAME = 'ai-covers'
const MAX_REFERENCE_IMAGES = 3
const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024
const allowedImageTypes = ['image/png', 'image/jpeg', 'image/webp']
const musicStyles = ['Sertanejo', 'Romântico', 'Gospel', 'Funk', 'Brega romântico popular', 'Pagode', 'Pop', 'Trap', 'Rock', 'Livre']
const visualStyles = ['Moderno', 'Antigo', 'Cinematográfico', 'Luxo', 'Romântico', 'Sombrio', 'Colorido', 'Minimalista']
const environments = ['Sertão', 'Cidade', 'Praia', 'Palco', 'Fazenda', 'Rua à noite', 'Estúdio musical', 'Céu estrelado']
const artDirections = ['Realista', 'Desenho', 'Cena de filme', 'Pôster musical', 'Capa de álbum', 'Vintage', 'Neon', 'Editorial']
const qualityOptions = [
  { id: 'low', label: 'Qualidade baixa', credits: 10, openAiQuality: 'low', inputFidelity: null },
  { id: 'medium', label: 'Qualidade média', credits: 20, openAiQuality: 'medium', inputFidelity: null },
  { id: 'pro', label: 'Qualidade pró', credits: 30, openAiQuality: 'high', inputFidelity: 'high' },
]

function getQualityOption(value: FormDataEntryValue | null) {
  return qualityOptions.find((option) => option.id === String(value || '')) || qualityOptions[0]
}

function currentMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

async function ensureBucket() {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
  if (listError) {
    console.error('[Studio Cover Art] Erro ao listar buckets:', listError)
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

  if (error) return null
  return data.signedUrl
}

async function getHistory(composerId: string) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_ai_covers')
    .select('*')
    .eq('composer_id', composerId)
    .order('created_at', { ascending: false })
    .limit(24)

  if (error) throw error

  return Promise.all((data || []).map(async (cover: any) => ({
    id: cover.id,
    title: cover.title,
    musicStyle: cover.music_style,
    visualStyle: cover.visual_style,
    createdAt: cover.created_at,
    imageUrl: await createSignedUrl(cover.image_path),
  })))
}

function pickTypographyDirection(musicStyle: string) {
  const normalizedStyle = musicStyle.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const baseDirections = [
    'Custom luxury serif typography, elegant high-contrast letters, subtle gold foil, refined shadows, premium editorial album cover mood.',
    'Bold condensed 3D title lettering, strong poster impact, beveled edges, cinematic shadows, glossy commercial streaming-cover finish.',
    'Hand-painted brush script title, expressive strokes, energetic swashes, textured ink, warm highlights and premium music-single personality.',
    'Modern handwritten signature lettering, elegant flowing title, intimate singer-songwriter feel, subtle glow, integrated with the scene lighting.',
    'Metallic embossed title, sculpted depth, dramatic rim light, tactile texture, high-end major-label album artwork.',
    'Clean modern custom display lettering, wide spacing, layered shadow, premium minimal commercial cover, not generic sans-serif.',
  ]
  const styleDirections = normalizedStyle.includes('sertanejo')
    ? [
        'Premium sertanejo romantic typography: custom brush script with western elegance, warm gold glow, rustic luxury, stage-light shadows.',
        'Modern country-pop title design: bold slab-serif lettering, subtle 3D bevel, leather/wood texture, warm spotlight highlights.',
        'Elegant Brazilian sertanejo hit-single lettering: large handwritten title, refined swashes, golden sunset/stage glow, commercial Spotify look.',
      ]
    : normalizedStyle.includes('romantico') || normalizedStyle.includes('brega')
      ? [
          'Romantic popular title design: expressive custom script, red-gold glow, soft shadows, dramatic emotional album-cover feel.',
          'Nostalgic romantic typography: vintage serif mixed with handwritten signature, warm texture, elegant old-school Brazilian music artwork.',
          'Iconic love-song lettering: large flowing brush title, heartwarming glow, polished depth, premium sentimental single cover.',
        ]
      : normalizedStyle.includes('gospel')
        ? [
            'Inspirational gospel typography: luminous elegant serif, white and gold highlights, clean spiritual glow, refined vertical hierarchy.',
            'Premium worship cover lettering: graceful custom script, soft light rays, embossed gold details, peaceful high-end finish.',
          ]
        : normalizedStyle.includes('funk')
          ? [
              'Premium funk typography: energetic custom letters, neon glow, chrome accents, urban nightlife depth, bold party-single impact.',
              'Street-pop title design: graffiti-inspired but readable lettering, electric color accents, 3D shadow, club poster energy.',
            ]
          : []

  const directions = [...styleDirections, ...baseDirections]
  const randomSource = randomUUID().replace(/-/g, '')
  const index = parseInt(randomSource.slice(0, 8), 16) % directions.length
  return directions[index]
}

function buildTypographyBlock(songTitle: string, artistName: string, musicStyle: string) {
  const titleText = songTitle.trim()
  const artistText = artistName.trim()
  const textLines = [titleText, artistText].filter(Boolean).join('\n')
  const typographyDirection = pickTypographyDirection(musicStyle)

  if (!textLines) {
    return `
Typography instructions:
Do not include any typography.
Do not write any text.
Do not write random symbols.
Do not write the music style.
Do not add logos, watermarks, labels or brand names.
`.trim()
  }

  return `
Typography instructions:
Typography is EXTREMELY IMPORTANT.
Create a premium music album cover, not a generic poster.
The title must look like a professional Spotify hit single.
Use large artistic lettering.
Create custom typography.
Do NOT use plain fonts.
Do NOT use generic poster text.
Do NOT use Arial, Helvetica, default sans-serif, default serif or basic text overlay.
Use stylized brush lettering only when the chosen typography direction asks for it.
Use cinematic depth.
Use dramatic shadows.
Use glowing highlights.
Use texture, volume, bevels, embossing, gold foil, metallic effect, handwritten strokes or neon glow only when appropriate to the chosen direction.
Make the title look designed by a professional album-cover artist.
The typography should feel iconic, memorable and commercially polished.
The song title must occupy 20% to 30% of the cover.
The title should be integrated into the artwork itself, not floating as a flat overlay.
The artist name should be smaller than the title, elegant, readable and balanced.
Use elegant composition, balanced spacing and strong visual hierarchy.
Use high-end typography, title integrated into the scene, bold readable letters and polished poster design.

Typography style references:
Modern country music album cover.
Premium Brazilian sertanejo artwork.
Netflix poster quality.
Billboard chart single cover.
Sony Music album design.
Universal Music artwork.
Professional Brazilian streaming artwork.

Avoid:
- Arial
- Helvetica
- Generic fonts
- Basic text overlay
- Small unreadable letters
- Random symbols
- Plain white text with no personality

Chosen typography direction for this cover:
${typographyDirection}

Follow the chosen typography direction strongly.
Do not repeat the same typography style from previous covers.
Do not default to the same brush/gold font every time.
Make this cover's lettering feel custom and different from other generated covers while still matching the music style.

Text to include:
${textLines}

Do not add any other text.
Do not misspell the words.
Do not write the music style.
Do not write random symbols.
Do not use small unreadable letters.
Do not add logos, watermarks, labels or brand names.
`.trim()
}

async function buildCoverPrompt(input: {
  songTitle: string
  artistName: string
  userIdea: string
  musicStyle: string
  visualStyle: string
  environment: string
  artDirection: string
  hasReferenceImages: boolean
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('A criação de capa não está configurada no servidor.')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
      temperature: 0.85,
      messages: [
        {
          role: 'system',
          content:
            'Você é um diretor de arte especialista em capas musicais brasileiras. Interprete o pedido do usuário e escreva um prompt em inglês para gerar uma capa quadrada 1:1 impactante, comercial e bonita. Se houver fotos de referência, a prioridade absoluta é preservar a identidade da pessoa da imagem 1: mesmo rosto, formato do rosto, tom de pele, cabelo, barba, idade aparente, proporções faciais e aparência geral. Não invente outro modelo, não troque etnia, não troque idade, não troque barba/cabelo. Só mude roupa, iluminação, cenário e composição conforme necessário para virar capa musical. Só inclua texto/tipografia na capa se o usuário informar nome da música ou cantor. Se ambos estiverem vazios, gere uma capa sem nenhuma palavra, letra, logotipo ou marca d’água.',
        },
        {
          role: 'user',
          content: [
            buildUnifiedArtDirection({
              musicStyle: input.musicStyle,
              visualStyle: input.visualStyle,
              environment: input.environment,
              artDirection: input.artDirection,
              userIdea: input.userIdea,
            }),
            `Nome da música: ${input.songTitle || 'vazio, não escrever título na capa'}`,
            `Cantor/artista: ${input.artistName || 'vazio, não escrever artista na capa'}`,
            input.hasReferenceImages
              ? 'Há fotos de referência da pessoa. Use principalmente a imagem 1 como referência de identidade. Prioridade máxima: a pessoa da capa precisa ser reconhecível como a mesma pessoa das fotos, mantendo rosto, formato facial, cabelo, barba, tom de pele, idade aparente e expressão. Não crie uma pessoa bonita genérica; preserve a pessoa real.'
              : 'Não há foto de referência. Crie a capa apenas pelo texto do usuário.',
            'Responda somente com o prompt final em inglês para geração de imagem.',
          ].join('\n'),
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Studio Cover Art] Erro GPT:', errorText)
    throw new Error('Não consegui interpretar o pedido da capa agora.')
  }

  const data = await response.json()
  const prompt = data.choices?.[0]?.message?.content?.trim()
  if (!prompt) throw new Error('A IA não retornou uma direção visual válida.')

  const typographyBlock = buildTypographyBlock(input.songTitle, input.artistName, input.musicStyle)

  return `${prompt}

Professional Brazilian album cover, premium streaming artwork, cinematic lighting, strong commercial design, high-end typography, title integrated into the scene, bold readable letters, polished poster design.

${typographyBlock}

Square 1:1 album cover, professional cover art, premium Brazilian music artwork, high contrast, polished composition.`
}

function getStyleRule(musicStyle: string) {
  const normalized = musicStyle.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  if (normalized.includes('sertanejo')) {
    return 'If the musical style is Sertanejo: use Brazilian sertanejo visual language, acoustic guitar, warm lights, emotional singer posture, premium country-pop mood and rustic-luxury details only when they fit the selected environment. Do not replace the selected environment. Do not write the word Sertanejo on the cover.'
  }
  if (normalized.includes('romantico') && !normalized.includes('brega')) {
    return 'If the musical style is romantic: use soft light, emotional mood, bokeh, golden or red tones and intimate atmosphere only when they fit the selected environment. Do not replace the selected environment. Do not write the style name on the cover.'
  }
  if (normalized.includes('gospel')) {
    return 'If the musical style is Gospel: use bright clean light, inspiring atmosphere, white and gold tones and refined spiritual mood only when they fit the selected environment. Do not replace the selected environment. Do not write the style name on the cover.'
  }
  if (normalized.includes('funk')) {
    return 'If the musical style is Funk: use urban visual, neon, energy and nightlife contrast only when they fit the selected environment. Do not replace the selected environment. Do not write the style name on the cover.'
  }
  if (normalized.includes('brega')) {
    return 'If the musical style is popular romantic brega: use nostalgic visual, warm light, popular singer pose and emotional mood only when they fit the selected environment. Do not replace the selected environment. Never write the word brega on the cover.'
  }

  return 'Use a professional Brazilian music cover style coherent with the informed musical style and selected environment. Do not write the style name on the cover.'
}

function getEnvironmentRule(environment: string) {
  const normalized = environment.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  if (normalized.includes('palco')) {
    return 'The environment MUST be a music stage. Show clear stage elements such as spotlights, stage floor, microphones, lighting rigs, LED/backdrop, concert atmosphere or elegant live-show setup. Do not use countryside, dirt road, farm or open sunset field as the main background.'
  }
  if (normalized.includes('fazenda')) {
    return 'The environment MUST be a farm or rustic countryside setting, with coherent rural details. Do not turn it into a city street or generic studio.'
  }
  if (normalized.includes('sertao')) {
    return 'The environment MUST be the Brazilian sertao/countryside, with warm rural atmosphere, earth tones and open landscape.'
  }
  if (normalized.includes('cidade')) {
    return 'The environment MUST be a city setting, with urban architecture, streets, skyline or modern city lighting.'
  }
  if (normalized.includes('praia')) {
    return 'The environment MUST be a beach/coastal setting, with ocean, sand, tropical light or seaside atmosphere.'
  }
  if (normalized.includes('rua')) {
    return 'The environment MUST be a night street setting, with urban lights, asphalt, storefronts, neon or cinematic street mood.'
  }
  if (normalized.includes('estudio')) {
    return 'The environment MUST be a music studio, with studio lights, acoustic panels, microphone, instruments or recording-room atmosphere.'
  }
  if (normalized.includes('ceu')) {
    return 'The environment MUST include a starry sky as a major visual element, with cinematic night mood.'
  }

  return `The selected environment is "${environment}". Make this environment clearly visible and do not replace it with another setting.`
}

function buildUnifiedArtDirection(input: {
  musicStyle: string
  visualStyle: string
  environment: string
  artDirection: string
  userIdea: string
}) {
  return `
MANDATORY CREATIVE BRIEF:
The musical style is: ${input.musicStyle}.
The visual style is: ${input.visualStyle}.
The environment is: ${input.environment}.
The type of artwork is: ${input.artDirection}.
The user's specific request is: ${input.userIdea}.

You must follow all these selected fields at the same time.
Do not ignore the selected environment.
Do not replace the selected environment with a generic background.
Do not let the musical style override the selected environment.
If there is any conflict, preserve the selected environment and adapt the musical style inside that environment.

Environment rule:
${getEnvironmentRule(input.environment)}

Style rule:
${getStyleRule(input.musicStyle)}
`.trim()
}

async function fileToDataUrl(file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return `data:${file.type || 'image/jpeg'};base64,${base64}`
}

async function analyzeReferencePerson(file: File) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('A criação de capa não está configurada no servidor.')

  try {
    const imageUrl = await fileToDataUrl(file)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content:
              'You are a visual identity analyst for album-cover generation. Analyze the uploaded portrait and describe the person objectively so another image model can preserve identity. Do not identify the person by name. Do not guess sensitive attributes. Focus on visible facial structure and visual details.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  'Analyze this person from the uploaded photo.',
                  'Return a concise but detailed visual identity description in English.',
                  'Describe only visible traits:',
                  '- apparent age range',
                  '- face shape',
                  '- hair color, haircut and hairline',
                  '- beard/mustache style',
                  '- skin tone as visual appearance',
                  '- eyes/eyebrows',
                  '- nose, mouth, cheeks, jawline',
                  '- glasses, if present',
                  '- expression',
                  '- pose and face angle',
                  '- clothing visible in the portrait',
                  '',
                  'End with: The generated cover must preserve this exact facial identity.',
                ].join('\n'),
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Studio Cover Art] Erro análise visual:', errorText)
      return ''
    }

    const data = await response.json()
    return String(data.choices?.[0]?.message?.content || '').trim().slice(0, 1800)
  } catch (error) {
    console.error('[Studio Cover Art] Falha ao analisar foto:', error)
    return ''
  }
}

function buildIdentityPreservingPrompt(input: {
  songTitle: string
  artistName: string
  userIdea: string
  musicStyle: string
  visualStyle: string
  environment: string
  artDirection: string
  personAnalysis?: string
}) {
  const titleText = input.songTitle || ''
  const artistText = input.artistName || ''
  const typographyBlock = buildTypographyBlock(titleText, artistText, input.musicStyle)

  return `
Transform the uploaded photo into a professional music cover for streaming.
This is an image edit. Start from the uploaded photo and turn that same photo/person into album-cover artwork.

${buildUnifiedArtDirection(input)}

Use the person from the uploaded image as the main subject.
The uploaded image is the base image to edit, not just a loose inspiration.
Keep the real person from the photo. Do not invent, regenerate or replace the face.
Preserve the person's face with maximum fidelity.
Preserve the apparent age, hair, beard, glasses, skin tone, facial expression, facial proportions and visual identity.
Keep the same facial geometry, eyes, nose, mouth, cheeks, forehead, jawline, beard shape, hairline, skin details and expression.
Keep the subject's pose and face angle as close as possible to the uploaded photo.
You may improve clothing, lighting, background and album-cover composition, but the face must remain the same real person.
Do not create another person.
Do not replace the face.
Do not change the main facial structure.
Do not beautify the person into a generic model.
Do not make the person younger, older, thinner, heavier or more symmetrical.
Do not change ethnicity, age range, beard, hairline, nose shape, face shape or overall identity.
The person must remain clearly recognizable as the same individual from the uploaded photo.

Visual identity analysis from the uploaded photo:
${input.personAnalysis || 'Preserve all visible facial traits from the uploaded photo exactly.'}

Art direction:
- professional music cover
- square composition for Spotify, YouTube Music and digital platforms
- cinematic lighting
- high sharpness
- premium finish
- realistic appearance
- strong commercial design
- high-end typography
- title integrated into the scene
- bold readable letters
- polished poster design
- background coherent with the selected environment and musical style
- clothes and scenery may be improved artistically, but without de-characterizing the person
- visual style: ${input.visualStyle}
- environment: ${input.environment}
- art format: ${input.artDirection}
- user request: ${input.userIdea}

Music data:
Title: ${titleText || 'none'}
Artist: ${artistText || 'none'}
Musical style: ${input.musicStyle}

${typographyBlock}

No brand logos.
No watermarks.
No extra random text.
The person needs to be the same as the uploaded photo. Preserve facial identity with maximum fidelity. Treat this as a high-fidelity edit of the uploaded portrait into an album cover.
`.trim()
}

async function fileToUploadPart(file: File, index: number) {
  if (!allowedImageTypes.includes(file.type)) {
    throw new Error('Envie fotos em PNG, JPG ou WEBP.')
  }

  const arrayBuffer = await file.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error('Cada foto de referência precisa ter no máximo 8 MB.')
  }

  return {
    name: 'image',
    file: new Blob([arrayBuffer], { type: file.type }),
    filename: `referencia-${index}.${file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg'}`,
  }
}

async function readOpenAiImageError(response: Response) {
  const errorText = await response.text()
  console.error('[Studio Cover Art] Erro Image API:', errorText)

  try {
    const parsed = JSON.parse(errorText)
    const message = parsed?.error?.message || parsed?.message
    if (message) return String(message)
  } catch {
    // A OpenAI/Vercel pode devolver texto puro em alguns erros de payload.
  }

  return errorText
}

async function appendImageFiles(formData: FormData, referenceFiles: File[], fieldName = 'image') {
  const uploadParts = await Promise.all(
    referenceFiles.map((file, index) => fileToUploadPart(file, index))
  )
  uploadParts.forEach((part) => {
    formData.append(fieldName, part.file, part.filename)
  })
}

async function requestImageEdit(input: {
  endpoint: string
  apiKey: string
  prompt: string
  referenceFiles: File[]
  model: string
  quality: string
  useAutoParams: boolean
  imageFieldName?: string
}) {
  const formData = new FormData()
  formData.set('model', input.model)
  formData.set('prompt', input.prompt)
  formData.set('n', '1')

  if (input.useAutoParams) {
    formData.set('size', 'auto')
    formData.set('quality', 'auto')
    formData.set('background', 'auto')
    formData.set('moderation', 'auto')
  } else {
    formData.set('size', '1024x1024')
    formData.set('quality', input.quality === 'high' ? 'high' : 'medium')
    formData.set('input_fidelity', 'high')
  }

  await appendImageFiles(formData, input.referenceFiles, input.imageFieldName || 'image')

  return fetch(input.endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.apiKey}` },
    body: formData,
  })
}

async function generateImage(input: {
  prompt: string
  referenceFiles: File[]
  quality: string
  inputFidelity?: string | null
  qualityId?: string
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('A criação de capa não está configurada no servidor.')

  const endpoint = input.referenceFiles.length > 0
    ? 'https://api.openai.com/v1/images/edits'
    : 'https://api.openai.com/v1/images/generations'

  let response: Response

  if (input.referenceFiles.length > 0) {
    const primaryReferenceFiles = input.referenceFiles.slice(0, 1)
    const imageModel = input.qualityId === 'pro' ? (process.env.OPENAI_IMAGE_PRO_MODEL || 'gpt-image-2') : (process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1')
    response = await requestImageEdit({
      endpoint,
      apiKey,
      prompt: input.prompt,
      referenceFiles: primaryReferenceFiles,
      model: imageModel,
      quality: input.quality,
      useAutoParams: imageModel === 'gpt-image-2',
      imageFieldName: 'image',
    })

    if (!response.ok && imageModel === 'gpt-image-2') {
      const firstError = await readOpenAiImageError(response)
      console.error('[Studio Cover Art] gpt-image-2 falhou, tentando fallback gpt-image-1:', firstError)
      response = await requestImageEdit({
        endpoint,
        apiKey,
        prompt: input.prompt,
        referenceFiles: primaryReferenceFiles,
        model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
        quality: 'high',
        useAutoParams: false,
        imageFieldName: 'image',
      })
    }
  } else {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.qualityId === 'pro' ? (process.env.OPENAI_IMAGE_PRO_MODEL || 'gpt-image-2') : (process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'),
        prompt: input.prompt,
        size: '1024x1024',
        quality: input.quality,
        n: 1,
      }),
    })
  }

  if (!response.ok) {
    const openAiError = await readOpenAiImageError(response)
    const lowerError = openAiError.toLowerCase()
    if ((lowerError.includes('image') || lowerError.includes('file')) && !lowerError.includes('parameter') && !lowerError.includes('unknown') && !lowerError.includes('invalid')) {
      throw new Error('A IA não aceitou uma das fotos enviadas. Tente enviar 1 foto principal em JPG, com o rosto bem visível e boa iluminação.')
    }
    throw new Error('Não consegui gerar a capa agora. Tente novamente em instantes.')
  }

  const data = await response.json()
  const imageBase64 = data.data?.[0]?.b64_json
  if (!imageBase64) throw new Error('A geração de imagem não retornou uma capa válida.')

  return imageBase64
}

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { limits } = await getStudioAccess(composer.composerId)
    const usage = await getStudioCreditUsage(composer.composerId, limits)
    const history = await getHistory(composer.composerId)

    return NextResponse.json({
      credits: {
        cost: qualityOptions[0].credits,
        remaining: usage.remaining,
        canCreate: usage.remaining >= qualityOptions[0].credits,
      },
      options: {
        musicStyles,
        visualStyles,
        environments,
        artDirections,
        qualities: qualityOptions.map(({ id, label, credits }) => ({ id, label, credits })),
      },
      history,
    })
  } catch (error: any) {
    console.error('[Studio Cover Art] Erro status:', error)
    return NextResponse.json({ error: error.message || 'Erro ao carregar criação de capa' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { limits } = await getStudioAccess(composer.composerId)
    const usage = await getStudioCreditUsage(composer.composerId, limits)
    const formData = await request.formData()
    const qualityOption = getQualityOption(formData.get('quality'))
    const creditCost = qualityOption.credits

    if (usage.remaining < creditCost) {
      return NextResponse.json(
        { error: `Você precisa de ${creditCost} créditos para criar essa capa. Faça uma recarga para continuar.` },
        { status: 429 }
      )
    }

    const songTitle = String(formData.get('songTitle') || '').trim().slice(0, 80)
    const artistName = String(formData.get('artistName') || '').trim().slice(0, 80)
    const userIdea = String(formData.get('userIdea') || '').trim().slice(0, 3000)
    const musicStyle = String(formData.get('musicStyle') || 'Sertanejo')
    const visualStyle = String(formData.get('visualStyle') || 'Moderno')
    const environment = String(formData.get('environment') || 'Cidade')
    const artDirection = String(formData.get('artDirection') || 'Capa de álbum')
    const referenceFiles = formData
      .getAll('referenceImages')
      .filter((item): item is File => item instanceof File && item.size > 0)
      .slice(0, MAX_REFERENCE_IMAGES)

    if (userIdea.length < 10) return NextResponse.json({ error: 'Escreva o que você quer na capa.' }, { status: 400 })

    await ensureBucket()

    const normalizedMusicStyle = musicStyles.includes(musicStyle) ? musicStyle : 'Sertanejo'
    const normalizedVisualStyle = visualStyles.includes(visualStyle) ? visualStyle : 'Moderno'
    const normalizedEnvironment = environments.includes(environment) ? environment : 'Cidade'
    const normalizedArtDirection = artDirections.includes(artDirection) ? artDirection : 'Capa de álbum'
    const personAnalysis = referenceFiles.length > 0
      ? await analyzeReferencePerson(referenceFiles[0])
      : ''
    const prompt = referenceFiles.length > 0
      ? buildIdentityPreservingPrompt({
          songTitle,
          artistName,
          userIdea,
          musicStyle: normalizedMusicStyle,
          visualStyle: normalizedVisualStyle,
          environment: normalizedEnvironment,
          artDirection: normalizedArtDirection,
          personAnalysis,
        })
      : await buildCoverPrompt({
          songTitle,
          artistName,
          userIdea,
          musicStyle: normalizedMusicStyle,
          visualStyle: normalizedVisualStyle,
          environment: normalizedEnvironment,
          artDirection: normalizedArtDirection,
          hasReferenceImages: false,
        })

    const imageBase64 = await generateImage({
      prompt,
      referenceFiles,
      quality: qualityOption.openAiQuality,
      inputFidelity: qualityOption.inputFidelity,
      qualityId: qualityOption.id,
    })
    const imageBuffer = Buffer.from(imageBase64, 'base64')
    const monthKey = currentMonthKey()
    const imagePath = `${composer.composerId}/studio-cover-art/${monthKey}/${randomUUID()}.png`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(imagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: false,
      })

    if (uploadError) throw uploadError

    const { data: cover, error: insertError } = await supabaseAdmin
      .from('dccmusic_ai_covers')
      .insert({
        composer_id: composer.composerId,
        title: songTitle,
        input_text: [
          `Nome da música: ${songTitle}`,
          `Cantor: ${artistName}`,
          `Estilo musical: ${normalizedMusicStyle}`,
          `Pedido: ${userIdea}`,
          `Fotos de referência: ${referenceFiles.length}`,
          `Qualidade: ${qualityOption.label}`,
          `Análise visual usada: ${personAnalysis ? 'sim' : 'não'}`,
        ].join('\n'),
        music_style: normalizedMusicStyle,
        visual_style: `${normalizedVisualStyle} / ${normalizedEnvironment} / ${normalizedArtDirection}`,
        prompt,
        image_path: imagePath,
        image_mime: 'image/png',
        month_key: monthKey,
      })
      .select('*')
      .single()

    if (insertError) throw insertError

    await addStudioCreditTransaction({
      composerId: composer.composerId,
      action: 'studio_cover_art',
      amount: creditCost,
      description: `Criação de capa personalizada no DCC Studio IA (${qualityOption.label})`,
      metadata: {
        coverId: cover.id,
        referenceImageCount: referenceFiles.length,
        quality: qualityOption.id,
        creditCost,
        songTitle,
        artistName,
      },
    })

    const imageUrl = await createSignedUrl(imagePath)

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
      credits: {
        cost: creditCost,
        remaining: Math.max(0, usage.remaining - creditCost),
      },
    })
  } catch (error: any) {
    console.error('[Studio Cover Art] Erro gerar capa:', error)
    return NextResponse.json({ error: error.message || 'Erro ao criar capa' }, { status: 500 })
  }
}
