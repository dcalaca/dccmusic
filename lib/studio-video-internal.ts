import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { backupStudioVersionAudio, downloadStudioAudioBuffer } from '@/lib/studio-audio-backup'
import { saveInternalStudioVideo } from '@/lib/studio-video-backup'
import { getStudioVideoRequestVersionId } from '@/lib/studio-video'
import { supabaseAdmin } from '@/lib/supabase'

const execFileAsync = promisify(execFile)

function resolveFfmpegPath() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@ffmpeg-installer/ffmpeg').path as string
  } catch {
    return process.env.FFMPEG_PATH || 'ffmpeg'
  }
}

function resolveVideoFontPath() {
  // O caminho é montado em runtime para o webpack não tentar interpretar o
  // arquivo binário como JavaScript. O next.config inclui a fonte no bundle.
  return path.join(
    process.cwd(),
    'node_modules',
    '@fontsource-variable',
    'inter',
    'files',
    'inter-latin-ext-wght-normal.woff2'
  )
}

function assTime(seconds: number) {
  const value = Math.max(0, seconds)
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const secs = Math.floor(value % 60)
  const centis = Math.floor((value - Math.floor(value)) * 100)
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`
}

function assEscape(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\r?\n/g, '\\N')
}

export function lyricCards(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\s*[\[(].{1,50}[\])]\s*$/.test(line))

  const cards: string[] = []
  for (let index = 0; index < lines.length; index += 2) {
    cards.push(lines.slice(index, index + 2).join('\n'))
  }
  return cards.length ? cards : ['DCC Music']
}

function wrapVideoText(value: string, maxCharacters: number, maxLines = 3) {
  const paragraphs = String(value || '').split(/\r?\n/)
  const lines: string[] = []

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean)
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (candidate.length <= maxCharacters || !current) {
        current = candidate
      } else {
        lines.push(current)
        current = word
      }
    }
    if (current) lines.push(current)
  }

  if (lines.length <= maxLines) return lines.join('\n')
  const visible = lines.slice(0, maxLines)
  visible[maxLines - 1] = `${visible[maxLines - 1].replace(/[.…]+$/, '')}…`
  return visible.join('\n')
}

function lyricCardSchedule(lyrics: string, durationSecondsValue: number) {
  const duration = Math.max(10, durationSecondsValue || 240)
  const cards = lyricCards(lyrics)
  const intro = Math.min(6, duration * 0.06)
  const outro = Math.min(5, duration * 0.04)
  const available = Math.max(5, duration - intro - outro)
  const weights = cards.map((card) => Math.max(12, card.replace(/\s/g, '').length))
  const totalWeight = weights.reduce((sum, value) => sum + value, 0)
  let cursor = intro

  return cards.map((card, index) => {
    const cardDuration = index === cards.length - 1
      ? duration - outro - cursor
      : available * (weights[index] / totalWeight)
    const end = Math.min(duration - outro, cursor + Math.max(2.2, cardDuration))
    const scheduled = { text: wrapVideoText(card, 30, 4), start: cursor, end }
    cursor = end
    return scheduled
  })
}

export function buildInternalVideoAss(input: {
  title: string
  artist: string
  lyrics: string
  durationSeconds: number
}) {
  const duration = Math.max(10, input.durationSeconds || 240)
  const events = lyricCardSchedule(input.lyrics, duration).map((card) => (
    `Dialogue: 0,${assTime(card.start)},${assTime(card.end)},Lyrics,,0,0,0,,{\\fad(240,240)}${assEscape(card.text)}`
  ))

  const safeTitle = assEscape(input.title || 'DCC Music')
  const safeArtist = assEscape(input.artist || 'DCC Music')
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 2

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Title,Inter,48,&H00FFFFFF,&H000000FF,&H00101010,&H90000000,-1,0,0,0,100,100,0,0,1,3,1,8,45,45,72,1
Style: Artist,Inter,29,&H00E8E8E8,&H000000FF,&H00101010,&H90000000,0,0,0,0,100,100,0,0,1,2,1,8,45,45,132,1
Style: Lyrics,Inter,46,&H00FFFFFF,&H000000FF,&H00101010,&HAA000000,-1,0,0,0,100,100,0,0,3,2,0,2,55,55,130,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
Dialogue: 0,0:00:00.00,${assTime(duration)},Title,,0,0,0,,${safeTitle}
Dialogue: 0,0:00:00.00,${assTime(duration)},Artist,,0,0,0,,${safeArtist}
${events.join('\n')}
`
}

function filterPath(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

export function buildInternalVideoTextFilter(input: {
  fontPath: string
  titlePath: string
  artistPath: string
  lyricPaths: Array<{ path: string; start: number; end: number }>
}) {
  const font = filterPath(input.fontPath)
  const title = filterPath(input.titlePath)
  const artist = filterPath(input.artistPath)
  const filters = [
    `[branded]drawtext=fontfile='${font}':textfile='${title}':expansion=none:fontcolor=white:fontsize=44:line_spacing=7:borderw=3:bordercolor=black@0.9:x=35:y=48[text-title]`,
    `[text-title]drawtext=fontfile='${font}':textfile='${artist}':expansion=none:fontcolor=white@0.9:fontsize=27:borderw=2:bordercolor=black@0.9:x=37:y=154[text-artist]`,
  ]
  let previous = 'text-artist'

  input.lyricPaths.forEach((card, index) => {
    const next = `text-lyric-${index}`
    const textPath = filterPath(card.path)
    filters.push(
      `[${previous}]drawtext=fontfile='${font}':textfile='${textPath}':expansion=none:fontcolor=white:fontsize=42:line_spacing=11:borderw=3:bordercolor=black@0.95:box=1:boxcolor=black@0.58:boxborderw=22:x=(w-text_w)/2:y=h-text_h-105:enable='between(t,${card.start.toFixed(3)},${card.end.toFixed(3)})'[${next}]`
    )
    previous = next
  })

  return { filters, outputLabel: previous }
}

function fallbackCoverBuffer() {
  const width = 720
  const height = 1280
  const header = Buffer.from(`P6\n${width} ${height}\n255\n`)
  const pixels = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3
      pixels[offset] = 12 + Math.floor((x / width) * 28)
      pixels[offset + 1] = 7 + Math.floor((y / height) * 16)
      pixels[offset + 2] = 28 + Math.floor((x / width) * 55)
    }
  }
  return Buffer.concat([header, pixels])
}

async function fetchBuffer(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Falha ao baixar a capa (${response.status}).`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (!buffer.byteLength) throw new Error('A capa está vazia.')
  return buffer
}

async function getCoverBuffer(videoRequest: any) {
  const { data: cover } = await supabaseAdmin
    .from('studio_covers')
    .select('image_url, image_path')
    .eq('project_id', videoRequest.project_id)
    .eq('composer_id', videoRequest.composer_id)
    .eq('is_current', true)
    .maybeSingle()

  if (cover?.image_path) {
    const { data, error } = await supabaseAdmin.storage.from('studio-assets').download(cover.image_path)
    if (!error && data) return Buffer.from(await data.arrayBuffer())
  }
  const remoteUrl = String(cover?.image_url || videoRequest?.metadata?.cover_url || '').trim()
  if (remoteUrl) {
    try {
      return await fetchBuffer(remoteUrl)
    } catch (error) {
      console.warn('[Studio Video Interno] Não foi possível usar a capa:', error)
    }
  }
  return fallbackCoverBuffer()
}

function durationSeconds(version: any) {
  const raw = Number(version?.provider_payload?.duration || version?.duration || 0)
  if (!Number.isFinite(raw) || raw <= 0) return 240
  return raw > 10000 ? raw / 1000 : raw
}

export async function renderInternalStudioVideo(videoRequestId: string) {
  const { data: videoRequest, error: requestError } = await supabaseAdmin
    .from('studio_video_requests')
    .select('*')
    .eq('id', videoRequestId)
    .maybeSingle()
  if (requestError) throw requestError
  if (!videoRequest) throw new Error('Solicitação de vídeo não encontrada.')

  const versionId = getStudioVideoRequestVersionId(videoRequest)
  const [{ data: project }, { data: composer }, { data: version }, { data: lyric }] = await Promise.all([
    supabaseAdmin.from('studio_projects').select('title').eq('id', videoRequest.project_id).maybeSingle(),
    supabaseAdmin.from('dccmusic_composers').select('name').eq('id', videoRequest.composer_id).maybeSingle(),
    versionId
      ? supabaseAdmin.from('studio_versions').select('*').eq('id', versionId).eq('project_id', videoRequest.project_id).maybeSingle()
      : supabaseAdmin.from('studio_versions').select('*').eq('project_id', videoRequest.project_id).eq('is_current', true).maybeSingle(),
    supabaseAdmin.from('studio_lyrics').select('content').eq('project_id', videoRequest.project_id).eq('is_current', true).maybeSingle(),
  ])
  if (!version) throw new Error('Versão da música não encontrada.')

  // Para o piloto não dependemos do cron: antes de renderizar, tentamos salvar
  // a cópia permanente da própria versão. Com isso qualquer projeto do Douglas
  // que ainda tenha o áudio disponível pode ser usado no teste.
  let videoVersion = version
  if (!videoVersion.audio_path || videoVersion.audio_backup_status !== 'backed_up') {
    const backup = await backupStudioVersionAudio({
      versionId: videoVersion.id,
      composerId: videoRequest.composer_id,
      audioUrl: videoVersion.audio_url,
      streamAudioUrl: videoVersion.stream_audio_url,
      forceFullAudioUpgrade: true,
    })
    if (!backup.backedUp) {
      throw new Error('Não consegui salvar a cópia permanente deste áudio para criar o vídeo.')
    }
    const { data: refreshedVersion, error: refreshedVersionError } = await supabaseAdmin
      .from('studio_versions')
      .select('*')
      .eq('id', videoVersion.id)
      .maybeSingle()
    if (refreshedVersionError) throw refreshedVersionError
    if (!refreshedVersion?.audio_path || refreshedVersion.audio_backup_status !== 'backed_up') {
      throw new Error('A cópia permanente deste áudio ainda não ficou disponível.')
    }
    videoVersion = refreshedVersion
  }

  const audio = await downloadStudioAudioBuffer(videoVersion.audio_path, videoVersion.audio_storage_provider)
  if (!audio?.buffer.byteLength) throw new Error('O áudio permanente está vazio.')
  const cover = await getCoverBuffer(videoRequest)
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dcc-lyric-video-'))
  const audioPath = path.join(tempDir, 'audio')
  const coverPath = path.join(tempDir, 'cover')
  const logoPath = path.join(tempDir, 'dcc-logo.png')
  const assPath = path.join(tempDir, 'lyrics.ass')
  const fontConfigPath = path.join(tempDir, 'fonts.conf')
  const fontCacheDir = path.join(tempDir, 'font-cache')
  const outputPath = path.join(tempDir, 'video.mp4')

  await supabaseAdmin.from('studio_video_requests').update({
    status: 'in_production',
    error_message: null,
    request_payload: {
      ...(videoRequest.request_payload || {}),
      provider: 'dcc-internal',
      format: 'static-cover-lyrics-v5',
    },
    updated_at: new Date().toISOString(),
  }).eq('id', videoRequest.id)

  try {
    const fontDir = path.dirname(resolveVideoFontPath())
    await fs.mkdir(fontCacheDir, { recursive: true })
    await Promise.all([
      fs.writeFile(audioPath, audio.buffer),
      fs.writeFile(coverPath, cover),
      fs.copyFile(path.join(process.cwd(), 'public', 'logopng.png'), logoPath),
      fs.writeFile(fontConfigPath, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${fontDir}</dir>
  <cachedir>${fontCacheDir}</cachedir>
</fontconfig>
`, 'utf8'),
      fs.writeFile(assPath, buildInternalVideoAss({
        title: wrapVideoText(String(project?.title || videoRequest?.metadata?.project_title || 'DCC Music'), 22, 2),
        artist: `Compositor: ${wrapVideoText(String(composer?.name || videoRequest?.metadata?.composer_name || 'DCC Music'), 34, 1)}`,
        lyrics: String(lyric?.content || ''),
        durationSeconds: durationSeconds(videoVersion),
      }), 'utf8'),
    ])

    // O mapa explícito impede o FFmpeg de escolher por engano a capa original
    // quando há várias entradas de vídeo. O último filtro é o único vídeo de
    // saída e contém marca, título, compositor e os cartões da letra.
    const filter = [
      '[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,boxblur=20:5[bg]',
      '[0:v]scale=620:620:force_original_aspect_ratio=decrease[fg]',
      '[2:v]scale=150:-1,colorchannelmixer=aa=0.82[logo]',
      '[bg][fg]overlay=(W-w)/2:220[video]',
      '[video][logo]overlay=W-w-34:34[branded]',
      `[branded]ass=filename='${filterPath(assPath)}':fontsdir='${filterPath(fontDir)}'[rendered]`,
    ].join(';')
    await execFileAsync(resolveFfmpegPath(), [
      '-hide_banner', '-loglevel', 'error', '-loop', '1', '-i', coverPath, '-i', audioPath, '-loop', '1', '-i', logoPath,
      '-filter_complex', filter,
      '-map', '[rendered]', '-map', '1:a:0',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', '-y', outputPath,
    ], {
      timeout: 280_000,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        FONTCONFIG_FILE: fontConfigPath,
        FONTCONFIG_PATH: tempDir,
      },
    })

    const output = await fs.readFile(outputPath)
    if (output.byteLength < 10_000) throw new Error('O arquivo de vídeo gerado ficou inválido.')
    return await saveInternalStudioVideo({ videoRequest, buffer: output })
  } catch (error: any) {
    console.error('[Studio Video Interno] Renderização falhou.', {
      videoRequestId: videoRequest.id,
      code: error?.code || null,
      signal: error?.signal || null,
      stderr: String(error?.stderr || '').slice(-4000),
    })
    await supabaseAdmin.from('studio_video_requests').update({
      status: 'retry_pending',
      error_message: 'Estamos preparando o vídeo novamente.',
      video_backup_error: error?.message || String(error),
      updated_at: new Date().toISOString(),
    }).eq('id', videoRequest.id)
    throw error
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
