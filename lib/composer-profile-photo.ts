import { supabaseAdmin } from './supabase'

const BUCKET = 'studio-assets'
const PROFILE_PHOTO_ROOT = 'composer-profile-photos'
const PROFILE_PHOTO_MAX_AGE_SECONDS = 60 * 60 * 24 * 7
const PROFILE_PHOTO_REFRESH_MARGIN_MS = 60 * 60 * 1000
export const PROFILE_PHOTO_MISSING = 'none'

export const PROFILE_PHOTO_MAX_BYTES = 3 * 1024 * 1024

type PhotoCacheRow = {
  profile_photo_path?: string | null
  profile_photo_url?: string | null
  profile_photo_url_expires_at?: string | null
}

function isMissingColumnError(error: any) {
  const message = String(error?.message || error?.details || error?.hint || '')
  return (
    error?.code === 'PGRST204' ||
    error?.code === '42703' ||
    message.includes('profile_photo_path') ||
    message.includes('profile_photo_url') ||
    message.includes('Could not find the') ||
    message.includes('schema cache')
  )
}

export function getComposerProfilePhotoFolder(composerId: string) {
  return `${PROFILE_PHOTO_ROOT}/${composerId}`
}

export function getComposerAvatarApiPath(composerId: string) {
  return `/api/compositores/avatar/${composerId}`
}

export function getComposerProfilePhotoExtension(contentType: string) {
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/webp') return 'webp'
  if (contentType === 'image/jpeg' || contentType === 'image/jpg') return 'jpg'
  return null
}

async function saveComposerPhotoCache(
  composerId: string,
  updates: {
    path?: string | null
    url?: string | null
    expiresAt?: string | null
  }
) {
  const payload: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  }

  if (updates.path !== undefined) payload.profile_photo_path = updates.path
  if (updates.url !== undefined) payload.profile_photo_url = updates.url
  if (updates.expiresAt !== undefined) payload.profile_photo_url_expires_at = updates.expiresAt

  const { error } = await supabaseAdmin
    .from('dccmusic_composers')
    .update(payload)
    .eq('id', composerId)

  if (error && !isMissingColumnError(error)) {
    console.warn('[PROFILE PHOTO] Falha ao salvar cache da foto:', error.message || error)
  }
}

async function getComposerPhotoCache(composerId: string): Promise<PhotoCacheRow | null> {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('profile_photo_path, profile_photo_url, profile_photo_url_expires_at')
    .eq('id', composerId)
    .maybeSingle()

  if (error) {
    if (isMissingColumnError(error)) return null
    console.warn('[PROFILE PHOTO] Falha ao ler cache da foto:', error.message || error)
    return null
  }

  return data
}

async function listComposerPhotoPath(composerId: string) {
  const folder = getComposerProfilePhotoFolder(composerId)
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(folder, {
    limit: 10,
    search: 'profile.',
    sortBy: { column: 'updated_at', order: 'desc' },
  })

  if (error || !data?.length) return null

  const file = data.find((item) => item.name.startsWith('profile.'))
  if (!file) return null
  return `${folder}/${file.name}`
}

async function createSignedPhotoUrl(path: string) {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, PROFILE_PHOTO_MAX_AGE_SECONDS)

  if (error || !data?.signedUrl) return null

  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + PROFILE_PHOTO_MAX_AGE_SECONDS * 1000).toISOString(),
  }
}

function cachedUrlStillValid(expiresAt?: string | null) {
  if (!expiresAt) return false
  const expiresMs = new Date(expiresAt).getTime()
  if (!Number.isFinite(expiresMs)) return false
  return expiresMs - Date.now() > PROFILE_PHOTO_REFRESH_MARGIN_MS
}

export async function resolveComposerProfilePhotoPath(composerId: string) {
  const cache = await getComposerPhotoCache(composerId)
  if (cache?.profile_photo_path === PROFILE_PHOTO_MISSING) return null
  if (cache?.profile_photo_path) return cache.profile_photo_path

  const path = await listComposerPhotoPath(composerId)
  await saveComposerPhotoCache(composerId, {
    path: path || PROFILE_PHOTO_MISSING,
    url: path ? undefined : null,
    expiresAt: path ? undefined : null,
  })
  return path
}

export async function getComposerProfilePhotoUrl(composerId: string) {
  const cache = await getComposerPhotoCache(composerId)

  if (cache?.profile_photo_path === PROFILE_PHOTO_MISSING) return null

  if (
    cache?.profile_photo_path &&
    cache.profile_photo_url &&
    cachedUrlStillValid(cache.profile_photo_url_expires_at)
  ) {
    return cache.profile_photo_url
  }

  const path = cache?.profile_photo_path || (await listComposerPhotoPath(composerId))
  if (!path) {
    await saveComposerPhotoCache(composerId, {
      path: PROFILE_PHOTO_MISSING,
      url: null,
      expiresAt: null,
    })
    return null
  }

  const signed = await createSignedPhotoUrl(path)
  if (!signed) return null

  await saveComposerPhotoCache(composerId, {
    path,
    url: signed.url,
    expiresAt: signed.expiresAt,
  })

  return signed.url
}

export async function getComposerProfilePhotoUrls(composerIds: string[]) {
  const uniqueIds = Array.from(new Set(composerIds.filter(Boolean)))
  const result = new Map<string, string | null>()
  if (uniqueIds.length === 0) return result

  const { data, error } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id, profile_photo_path, profile_photo_url, profile_photo_url_expires_at')
    .in('id', uniqueIds)

  if (error && !isMissingColumnError(error)) {
    console.warn('[PROFILE PHOTO] Falha ao ler fotos em lote:', error.message || error)
  }

  const rows = new Map((data || []).map((row: any) => [row.id as string, row as PhotoCacheRow]))
  const needsSign: Array<{ id: string; path: string }> = []
  const needsDiscover: string[] = []

  for (const id of uniqueIds) {
    const row = rows.get(id)
    if (row?.profile_photo_path === PROFILE_PHOTO_MISSING) {
      result.set(id, null)
      continue
    }

    if (
      row?.profile_photo_path &&
      row.profile_photo_url &&
      cachedUrlStillValid(row.profile_photo_url_expires_at)
    ) {
      result.set(id, row.profile_photo_url)
      continue
    }

    if (row?.profile_photo_path) {
      needsSign.push({ id, path: row.profile_photo_path })
      continue
    }

    needsDiscover.push(id)
  }

  if (needsDiscover.length > 0) {
    await Promise.all(
      needsDiscover.map(async (id) => {
        const path = await listComposerPhotoPath(id)
        if (!path) {
          result.set(id, null)
          await saveComposerPhotoCache(id, {
            path: PROFILE_PHOTO_MISSING,
            url: null,
            expiresAt: null,
          })
          return
        }
        needsSign.push({ id, path })
      })
    )
  }

  if (needsSign.length > 0) {
    const { data: signedList, error: signedError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrls(
        needsSign.map((item) => item.path),
        PROFILE_PHOTO_MAX_AGE_SECONDS
      )

    if (signedError) {
      console.warn('[PROFILE PHOTO] Falha ao assinar URLs em lote:', signedError.message || signedError)
    }

    const expiresAt = new Date(Date.now() + PROFILE_PHOTO_MAX_AGE_SECONDS * 1000).toISOString()

    await Promise.all(
      needsSign.map(async (item, index) => {
        const signedUrl = signedList?.[index]?.signedUrl || null
        result.set(item.id, signedUrl)
        await saveComposerPhotoCache(item.id, {
          path: item.path,
          url: signedUrl,
          expiresAt: signedUrl ? expiresAt : null,
        })
      })
    )
  }

  for (const id of uniqueIds) {
    if (!result.has(id)) result.set(id, null)
  }

  return result
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

  const { data: existingFiles } = await supabaseAdmin.storage.from(BUCKET).list(folder, {
    limit: 10,
    search: 'profile.',
  })

  const filesToRemove = (existingFiles || [])
    .filter((file) => file.name.startsWith('profile.'))
    .map((file) => `${folder}/${file.name}`)
    .filter((existingPath) => existingPath !== path)

  if (filesToRemove.length > 0) {
    await supabaseAdmin.storage.from(BUCKET).remove(filesToRemove)
  }

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
    contentType: input.file.type,
    upsert: true,
  })

  if (error) throw error

  const signed = await createSignedPhotoUrl(path)
  await saveComposerPhotoCache(input.composerId, {
    path,
    url: signed?.url || null,
    expiresAt: signed?.expiresAt || null,
  })

  return signed?.url || getComposerAvatarApiPath(input.composerId)
}

export async function downloadComposerProfilePhoto(composerId: string) {
  const path = await resolveComposerProfilePhotoPath(composerId)
  if (!path) return null

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path)
  if (error || !data) return null

  const contentType =
    data.type ||
    (path.endsWith('.png')
      ? 'image/png'
      : path.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg')

  return {
    blob: data,
    contentType,
    path,
  }
}
