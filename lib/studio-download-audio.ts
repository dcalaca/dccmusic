import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/** Rebuild the MP3 seek/duration index without re-encoding the audio frames. */
export async function prepareStudioMp3Download(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dcc-mp3-download-'))
  try {
    const input = path.join(directory, 'input.mp3')
    const output = path.join(directory, 'output.mp3')
    await fs.writeFile(input, new Uint8Array(bytes))
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path as string
    await execFileAsync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-i', input, '-map', '0:a:0', '-c:a', 'copy',
      '-map_metadata', '-1', '-write_xing', '1', output,
    ], { timeout: 30_000, maxBuffer: 1024 * 1024 })
    const prepared = await fs.readFile(output)
    if (!prepared.byteLength) throw new Error('empty_prepared_mp3')
    return new Uint8Array(prepared).buffer
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
}
