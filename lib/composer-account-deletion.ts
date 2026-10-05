import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from './supabase'

function hashDeletionIdentifier(kind: 'email' | 'google', value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return null
  return createHash('sha256').update(`dccmusic:deleted-account:${kind}:${normalized}`).digest('hex')
}

function stripKeys(row: any, keys: string[]) {
  if (!row) return null
  const copy = { ...row }
  for (const key of keys) delete copy[key]
  return copy
}

export async function hasDeletedComposerIdentity(input: { email?: string | null; googleSub?: string | null }) {
  const emailHash = hashDeletionIdentifier('email', input.email)
  const googleHash = hashDeletionIdentifier('google', input.googleSub)
  if (!emailHash && !googleHash) return false

  let query = supabaseAdmin
    .from('composer_account_deletion_blocks')
    .select('id')
    .limit(1)

  if (emailHash && googleHash) {
    query = query.or(`email_hash.eq.${emailHash},google_sub_hash.eq.${googleHash}`)
  } else if (emailHash) {
    query = query.eq('email_hash', emailHash)
  } else {
    query = query.eq('google_sub_hash', googleHash!)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return Boolean(data)
}

async function archiveComposerStudioMusic(composerId: string) {
  const deletionKey = randomUUID()
  const [{ data: projects, error: projectsError }, { data: versions, error: versionsError }, { data: generations, error: generationsError }, { data: lyrics, error: lyricsError }] = await Promise.all([
    supabaseAdmin.from('studio_projects').select('*').eq('composer_id', composerId),
    supabaseAdmin.from('studio_versions').select('*').eq('composer_id', composerId),
    supabaseAdmin.from('studio_generations').select('*').eq('composer_id', composerId),
    supabaseAdmin.from('studio_lyrics').select('*').eq('composer_id', composerId),
  ])

  if (projectsError) throw projectsError
  if (versionsError) throw versionsError
  if (generationsError) throw generationsError
  if (lyricsError) throw lyricsError

  const projectMap = new Map((projects || []).map((row: any) => [row.id, row]))
  const generationMap = new Map((generations || []).map((row: any) => [row.id, row]))
  const lyricsByProject = new Map<string, any[]>()
  for (const lyric of lyrics || []) {
    const list = lyricsByProject.get(lyric.project_id) || []
    list.push(stripKeys(lyric, ['composer_id', 'project_id']))
    lyricsByProject.set(lyric.project_id, list)
  }

  const rows = (versions || []).map((version: any) => {
    const project = projectMap.get(version.project_id)
    const generation = version.generation_id ? generationMap.get(version.generation_id) : null
    return {
      deletion_key: deletionKey,
      original_project_id: version.project_id || null,
      original_version_id: version.id,
      training_eligible: false,
      retention_reason: 'account_deletion_archive',
      project_snapshot: stripKeys(project, ['composer_id']) || {},
      version_snapshot: stripKeys(version, ['composer_id', 'project_id']) || {},
      generation_snapshot: stripKeys(generation, ['composer_id', 'project_id']),
      lyrics_snapshot: lyricsByProject.get(version.project_id) || [],
      audio_path: version.audio_path || null,
      stream_audio_path: version.stream_audio_path || null,
      audio_storage_provider: version.audio_storage_provider || null,
      stream_audio_storage_provider: version.stream_audio_storage_provider || null,
      audio_url: version.audio_url || null,
      stream_audio_url: version.stream_audio_url || null,
    }
  })

  if (rows.length) {
    const { error } = await supabaseAdmin
      .from('deleted_studio_music_archive')
      .upsert(rows, { onConflict: 'original_version_id', ignoreDuplicates: true })
    if (error) throw error
  }

  return { deletionKey, archivedVersions: rows.length }
}

export async function prepareComposerAccountDeletion(composerId: string, source = 'self_service') {
  const { data: composer, error } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id, name, email, google_sub')
    .eq('id', composerId)
    .maybeSingle()

  if (error) throw error
  if (!composer) throw new Error('Compositor não encontrado')

  const emailHash = hashDeletionIdentifier('email', composer.email)
  if (!emailHash) throw new Error('Conta sem identificador de bloqueio')

  const googleSubHash = hashDeletionIdentifier('google', composer.google_sub)

  const [{ error: blockError }, archive] = await Promise.all([
    supabaseAdmin.from('composer_account_deletion_blocks').upsert({
      email_hash: emailHash,
      google_sub_hash: googleSubHash,
      source,
      blocked_at: new Date().toISOString(),
    }, { onConflict: 'email_hash' }),
    archiveComposerStudioMusic(composerId),
  ])

  if (blockError) throw blockError

  return {
    composer: {
      id: composer.id,
      name: composer.name,
      email: composer.email,
    },
    ...archive,
  }
}
