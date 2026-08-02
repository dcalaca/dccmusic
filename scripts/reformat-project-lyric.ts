/**
 * Reformatar letra atual de um projeto em estrofes.
 * Uso: npx tsx scripts/reformat-project-lyric.ts <projectId>
 */
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const projectId = process.argv[2]
  if (!projectId) {
    console.error('Uso: npx tsx scripts/reformat-project-lyric.ts <projectId>')
    process.exit(1)
  }

  const { formatTranscribedLyric } = await import('../lib/studio-transcribe')
  const { supabaseAdmin } = await import('../lib/supabase')

  const { data: lyric, error } = await supabaseAdmin
    .from('studio_lyrics')
    .select('id, content')
    .eq('project_id', projectId)
    .eq('is_current', true)
    .maybeSingle()

  if (error || !lyric?.content) {
    console.error('Letra atual não encontrada', error)
    process.exit(1)
  }

  console.log('Antes (preview):', lyric.content.slice(0, 180))
  const formatted = await formatTranscribedLyric(lyric.content)
  console.log('Depois:\n', formatted)

  const { error: updateError } = await supabaseAdmin
    .from('studio_lyrics')
    .update({ content: formatted, updated_at: new Date().toISOString() })
    .eq('id', lyric.id)

  if (updateError) {
    console.error('Erro ao salvar', updateError)
    process.exit(1)
  }

  console.log('OK — letra reformatada.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
