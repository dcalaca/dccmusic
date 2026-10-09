import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import * as db from '@/lib/db'
import { getEligibleStudioFeaturedMusic } from '@/lib/featured-studio'

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const { contentType, contentId } = await request.json()
    if (!['music', 'video', 'studio_music'].includes(contentType) || !/^[a-f0-9-]{36}$/i.test(String(contentId))) {
      return NextResponse.json({ error: 'Conteúdo inválido' }, { status: 400 })
    }
    const content = contentType === 'studio_music'
      ? await getEligibleStudioFeaturedMusic(contentId, composer.composerId)
      : contentType === 'music' ? await db.getMusicById(contentId) : await db.getVideoById(contentId)
    if (!content) return NextResponse.json({ errorCode: 'studioNotEligible', error: 'Música não publicada ou sem letra e áudio.' }, { status: 422 })
    // Nunca cobrar destaque de música sem áudio reproduzível.
    const music = contentType === 'music' ? (content as Awaited<ReturnType<typeof db.getMusicById>>) : null
    if (music && !(music.spotifyUrl || music.spotifyEmbed || music.appleMusicUrl || music.appleMusicEmbed)) {
      return NextResponse.json({ errorCode: 'audioRequired' }, { status: 422 })
    }
    if (await db.hasActiveFeatured(contentType as 'music' | 'video' | 'studio_music', contentId)) {
      return NextResponse.json({ error: 'Conteúdo já destacado' }, { status: 409 })
    }
    const { data: composerRow } = await supabaseAdmin.from('dccmusic_composers')
      .select('email').eq('id', composer.composerId).maybeSingle()
    const { data: featured, error } = await supabaseAdmin.from('dccmusic_featured_payments')
      .insert({ content_type: contentType, content_id: contentId, composer_id: composer.composerId,
        payment_status: 'pending', amount: 9.90, is_active: false,
        expires_at: new Date(Date.now() + 10 * 86400000).toISOString() })
      .select('id, amount').single()
    if (error) throw error
    return NextResponse.json({ featuredId: featured.id, amount: Number(featured.amount), email: composerRow?.email || null })
  } catch (error) {
    console.error('[FEATURED INTENT]', error)
    return NextResponse.json({ error: 'Falha ao iniciar destaque' }, { status: 500 })
  }
}
