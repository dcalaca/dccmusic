import { supabaseAdmin } from './supabase'

const BUCKET = 'studio-assets'
const PROFILE_PHOTO_ROOT = 'composer-profile-photos'
const PROFILE_PHOTO_MAX_AGE_SECONDS = 60 * 60 * 24

export const PROFILE_PHOTO_MAX_BYTES = 3 * 1024 * 1024

export function getComposerProfilePhotoFolder(composerId: string) {
  return `${PROFILE_PHOTO_ROOT}/${composerId}`
}

export function getComposerProfilePhotoExtension(contentType: string) {
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/webp') return 'webp'
  if (contentType === 'image/jpeg' || contentType === 'image/jpg') return 'jpg'
  return null
}

export async function getComposerProfilePhotoUrl(composerId: string) {
  const folder = getComposerProfilePhotoFolder(composerId)
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .list(folder, {
      limit: 10,
      search: 'profile.',
      sortBy: { column: 'updated_at', order: 'desc' },
    })

  if (error || !data?.length) return null

  const file = data.find((item) => item.name.startsWith('profile.'))
  if (!file) return null

  const { data: signed } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(`${folder}/${file.name}`, PROFILE_PHOTO_MAX_AGE_SECONDS)

  return signed?.signedUrl || null
}

export async function uploadComposerProfilePhoto(input: {
  composerId: string
  file: File
}) {
  const extension = getComposerProfilePhotoExtension(input.file.type)
  if (!extension) {
    throw new Error('Envie uma imagem JPG, PNG ou WebP.')
  }

  if (input.file.size > PROFILE_PHOTO_MAX_BYTES) {
    throw new Error('A foto precisa ter no máximo 3 MB.')
  }

  const folder = getComposerProfilePhotoFolder(input.composerId)
  const path = `${folder}/profile.${extension}`
  const buffer = Buffer.from(await input.file.arrayBuffer())

  const { data: existingFiles } = await supabaseAdmin.storage
    .from(BUCKET)
    .list(folder, { limit: 10, search: 'profile.' })

  const filesToRemove = (existingFiles || [])
    .filter((file) => file.name.startsWith('profile.'))
    .map((file) => `${folder}/${file.name}`)
    .filter((existingPath) => existingPath !== path)

  if (filesToRemove.length > 0) {
    await supabaseAdmin.storage.from(BUCKET).remove(filesToRemove)
  }

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: input.file.type,
      upsert: true,
    })

  if (error) throw error

  return getComposerProfilePhotoUrl(input.composerId)
}
