/**
 * Recupera letra de um projeto "melhorar" transcrevendo o áudio original (Whisper).
 * Uso: npx tsx scripts/recover-enhance-lyric.ts <projectId>
 */
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const projectId = process.argv[2]
  if (!projectId) {
    console.error('Uso: npx tsx scripts/recover-enhance-lyric.ts <projectId>')
    process.exit(1)
  }

  const { downloadStudioAudioBuffer } = await import('../lib/studio-audio-backup')
  const { transcribeStudioAudioBuffer } = await import('../lib/studio-transcribe')
  const { supabaseAdmin } = await import('../lib/supabase')

  const { data: project, error: projectError } = await supabaseAdmin
    .from('studio_projects')
    .select('id, composer_id, title')
    .eq('id', projectId)
    .maybeSingle()

  if (projectError || !project) {
    console.error('Projeto não encontrado', projectError)
    process.exit(1)
  }

  const { data: existingLyric } = await supabaseAdmin
    .from('studio_lyrics')
    .select('id, content')
    .eq('project_id', projectId)
    .eq('is_current', true)
    .maybeSingle()

  const force = process.argv.includes('--force')
  if (!force && existingLyric?.content && existingLyric.content.trim().length > 20) {
    console.log('Projeto já tem letra atual (use --force para sobrescrever):')
    console.log(existingLyric.content.slice(0, 400))
    process.exit(0)
  }

  const { data: generation, error: genError } = await supabaseAdmin
    .from('studio_generations')
    .select('id, request_payload')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (genError || !generation) {
    console.error('Geração não encontrada', genError)
    process.exit(1)
  }

  const original = generation.request_payload?.originalAudio
  if (!original?.path) {
    console.error('Áudio original não encontrado no request_payload')
    process.exit(1)
  }

  console.log('Projeto:', project.title)
  console.log('Áudio:', original.path, original.provider)

  const downloaded = await downloadStudioAudioBuffer(original.path, original.provider || 'r2')
  if (!downloaded) {
    console.error('Falha ao baixar áudio do storage')
    process.exit(1)
  }

  console.log('Transcrevendo com Whisper...')
  const text = await transcribeStudioAudioBuffer({
    buffer: downloaded.buffer,
    fileName: String(original.path).split('/').pop() || 'enhance.mp3',
    contentType: downloaded.contentType || original.contentType,
  })

  console.log('Letra (preview):', text.slice(0, 400))

  await supabaseAdmin
    .from('studio_lyrics')
    .update({ is_current: false })
    .eq('project_id', projectId)

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('studio_lyrics')
    .insert({
      project_id: projectId,
      composer_id: project.composer_id,
      content: text,
      is_current: true,
    })
    .select('id')
    .maybeSingle()

  if (insertError) {
    console.error('Erro ao salvar letra', insertError)
    process.exit(1)
  }

  console.log('OK — letra salva. lyricId=', inserted?.id)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
