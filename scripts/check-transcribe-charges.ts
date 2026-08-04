import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const { supabaseAdmin } = await import('../lib/supabase')

  const { data: txs, error } = await supabaseAdmin
    .from('studio_credit_transactions')
    .select('id, composer_id, action, amount, description, created_at')
    .eq('action', 'audio_lyric_transcription')
    .order('created_at', { ascending: false })
    .limit(10)

  console.log('audio_lyric_transcription:', error || txs)

  const { data: recent } = await supabaseAdmin
    .from('studio_credit_transactions')
    .select('id, action, amount, description, created_at, composer_id')
    .order('created_at', { ascending: false })
    .limit(15)

  console.log('recent txs:', recent)

  const { data: douglas } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id, email, name')
    .or('email.ilike.%dcalaca%,name.ilike.%Douglas%')
    .limit(5)

  console.log('douglas candidates:', douglas)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
