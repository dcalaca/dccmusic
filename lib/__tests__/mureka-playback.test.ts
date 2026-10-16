import { afterEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'

const upload = vi.hoisted(() => vi.fn(async (input: { fileName: string }) => ({ path: input.fileName, provider: 'supabase' })))
vi.mock('@/lib/studio-audio-backup', () => ({ uploadStudioAudioBuffer: upload }))
import { createMurekaAdminPlayback, findMurekaPlaybackStems } from '../mureka-playback'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks() })

describe('Mureka playback', () => {
  it('finds the two WAV stems inside a nested ZIP and ignores metadata', () => {
    const zip = new JSZip()
    zip.file('song/accompaniment.wav', 'audio')
    zip.file('song/vocals.wav', 'audio')
    zip.file('__MACOSX/vocals.wav', 'metadata')
    const stems = findMurekaPlaybackStems(zip)
    expect(stems.instrumental.name).toBe('song/accompaniment.wav')
    expect(stems.vocal.name).toBe('song/vocals.wav')
  })
  it('fails rather than offering incomplete or unrelated tracks', () => {
    const zip = new JSZip()
    zip.file('drums.wav', 'audio')
    zip.file('vocals.wav', 'audio')
    expect(() => findMurekaPlaybackStems(zip)).toThrow('não retornou')
  })
  it('uses the two-stem model and saves both original WAV outputs', async () => {
    vi.stubEnv('MUREKA_API_KEY', 'test-key')
    const zip = new JSZip()
    const wav = Buffer.from('RIFF0000WAVEtest')
    zip.file('instrumental.wav', wav)
    zip.file('vocals.wav', wav)
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ zip_url: 'https://cdn.mureka.ai/stems.zip' }))
      .mockResolvedValueOnce(new Response(bytes))
    vi.stubGlobal('fetch', fetchMock)
    const result = await createMurekaAdminPlayback({ sourceUrl: 'https://audio.example/song.mp3', title: 'Minha música' })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ url: 'https://audio.example/song.mp3', model: 'audio-separation-3' })
    expect(upload).toHaveBeenCalledTimes(2)
    expect(upload.mock.calls[0][0]).toMatchObject({ contentType: 'audio/wav', buffer: wav })
    expect(result.separationProvider).toBe('mureka')
    expect(result.vocal.path).toMatch(/voz.*\.wav$/)
  })
  it('does not save files when the provider rejects the request', async () => {
    vi.stubEnv('MUREKA_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'rejected' }, { status: 422 })))
    await expect(createMurekaAdminPlayback({ sourceUrl: 'https://audio.example/song.mp3' })).rejects.toThrow('não conseguiu')
    expect(upload).not.toHaveBeenCalled()
  })
})
