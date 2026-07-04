import { supabaseAdmin } from './supabase'

export async function getStudioCoverImageUrl(cover: any) {
  if (!cover) return null

  if (cover.image_path) {
    const { data, error } = await supabaseAdmin.storage
      .from('studio-assets')
      .createSignedUrl(cover.image_path, 60 * 60)

    if (!error && data?.signedUrl) return data.signedUrl
  }

  return cover.image_url || null
}
