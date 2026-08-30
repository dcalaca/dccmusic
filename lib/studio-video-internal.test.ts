import { describe, expect, it } from 'vitest'
import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { buildInternalVideoAss, lyricCards } from './studio-video-internal'

const execFileAsync = promisify(execFile)

function ffmpegPath() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@ffmpeg-installer/ffmpeg').path as string
}

describe('studio video interno', () => {
  it('remove marcadores e agrupa duas linhas por tela', () => {
    expect(lyricCards('[Verso 1]\nLinha um\nLinha dois\n\n[Refrão]\nLinha três')).toEqual([
      'Linha um\nLinha dois',
      'Linha três',
    ])
  })

  it('gera legendas ASS dentro da duração do áudio', () => {
    const ass = buildInternalVideoAss({
      title: 'Minha {Música}',
      artist: 'Compositor',
      lyrics: 'Primeira linha\nSegunda linha\nTerceira linha',
      durationSeconds: 60,
    })
    expect(ass).toContain('Dialogue: 0,0:00:00.00,0:01:00.00,Title')
    expect(ass).toContain('Minha \\{Música\\}')
    expect(ass).toContain('Primeira linha\\NSegunda linha')
  })

  it('renderiza um MP4 vertical reproduzível com o FFmpeg empacotado', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dcc-video-test-'))
    const cover = path.join(tempDir, 'cover.png')
    const audio = path.join(tempDir, 'audio.m4a')
    const subtitles = path.join(tempDir, 'lyrics.ass')
    const fontConfig = path.join(tempDir, 'fonts.conf')
    const fontCache = path.join(tempDir, 'font-cache')
    const fontDir = path.join(process.cwd(), 'node_modules', '@fontsource-variable', 'inter', 'files')
    const output = path.join(tempDir, 'output.mp4')
    try {
      await fs.mkdir(fontCache, { recursive: true })
      await Promise.all([
        execFileAsync(ffmpegPath(), ['-f', 'lavfi', '-i', 'color=c=0x34105f:s=720x720:d=1', '-frames:v', '1', '-y', cover]),
        execFileAsync(ffmpegPath(), ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:a', 'aac', '-y', audio]),
        fs.writeFile(subtitles, buildInternalVideoAss({
          title: 'Teste DCC',
          artist: 'Compositor',
          lyrics: 'Primeira linha\nSegunda linha',
          durationSeconds: 3,
        })),
        fs.writeFile(fontConfig, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig><dir>${fontDir}</dir><cachedir>${fontCache}</cachedir></fontconfig>`),
      ])
      const filter = `[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,boxblur=20:5[bg];[0:v]scale=620:620:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:210,ass=${subtitles.replace(/([\\:])/g, '\\$1')}:fontsdir=${fontDir.replace(/([\\:])/g, '\\$1')}`
      await execFileAsync(ffmpegPath(), [
        '-loop', '1', '-i', cover, '-i', audio, '-filter_complex', filter,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-shortest', '-movflags', '+faststart', '-y', output,
      ], {
        timeout: 30_000,
        env: { ...process.env, FONTCONFIG_FILE: fontConfig, FONTCONFIG_PATH: tempDir },
      })
      const result = await fs.readFile(output)
      expect(result.byteLength).toBeGreaterThan(10_000)
      expect(result.subarray(4, 8).toString()).toBe('ftyp')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  }, 40_000)
})
