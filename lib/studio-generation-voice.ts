import { supabaseAdmin } from '@/lib/supabase'

type StudioVersionWithGeneration = {
  id: string
  generation_id?: string | null
}

export type StudioGenerationVoice = {
  profileId: string | null
  name: string
}

function getVoiceSnapshot(payload: any) {
  const snapshot = payload?.studioVoice
  const personaId = typeof payload?.personaId === 'string' ? payload.personaId : null

  return {
    profileId: typeof snapshot?.profileId === 'string' ? snapshot.profileId : null,
    name: typeof snapshot?.displayName === 'string' ? snapshot.displayName.trim() : '',
    personaId,
  }
}

export async function getStudioVersionVoices(composerId: string, versions: StudioVersionWithGeneration[]) {
  const generationIds = versions.map((version) => version.generation_id).filter((id): id is string => Boolean(id))
  if (generationIds.length === 0) return new Map<string, StudioGenerationVoice>()

  const { data: generations, error: generationsError } = await supabaseAdmin
    .from('studio_generations').select('id, request_payload').eq('composer_id', composerId).in('id', generationIds)
  if (generationsError) throw generationsError

  const snapshotsByGenerationId = new Map(
    (generations || []).map((generation: any) => [generation.id, getVoiceSnapshot(generation.request_payload)])
  )
  const personaIds = [...new Set([...snapshotsByGenerationId.values()].map((voice) => voice.personaId).filter((id): id is string => Boolean(id)))]
  const profileNamesByPersonaId = new Map<string, string>()

  if (personaIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('studio_voice_profiles').select('voice_id, display_name').eq('composer_id', composerId).in('voice_id', personaIds)
    if (profilesError) throw profilesError
    for (const profile of profiles || []) {
      if (profile.voice_id && profile.display_name) profileNamesByPersonaId.set(profile.voice_id, profile.display_name)
    }
  }

  const voiceByVersionId = new Map<string, StudioGenerationVoice>()
  for (const version of versions) {
    if (!version.generation_id) continue
    const snapshot = snapshotsByGenerationId.get(version.generation_id)
    if (!snapshot || (!snapshot.personaId && !snapshot.name)) continue
    voiceByVersionId.set(version.id, {
      profileId: snapshot.profileId,
      name: snapshot.name || (snapshot.personaId ? profileNamesByPersonaId.get(snapshot.personaId) || 'Voz cadastrada' : 'Voz cadastrada'),
    })
  }
  return voiceByVersionId
}
