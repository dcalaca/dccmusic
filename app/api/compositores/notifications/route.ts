import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function mapNotification(row: any) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    actorName: row.actor_name,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const limitParam = Number(new URL(request.url).searchParams.get('limit') || 30)
    const limit = Number.isFinite(limitParam) ? Math.min(50, Math.max(1, limitParam)) : 30

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      supabaseAdmin
        .from('dccmusic_notifications')
        .select('id, type, title, body, href, actor_name, read_at, created_at')
        .eq('composer_id', composer.composerId)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from('dccmusic_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('composer_id', composer.composerId)
        .is('read_at', null),
    ])

    if (error) throw error
    if (countError) throw countError

    return NextResponse.json({
      unreadCount: count || 0,
      notifications: (data || []).map(mapNotification),
    })
  } catch (error: any) {
    console.error('[NOTIFICATIONS] Erro ao listar:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar notificações' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const now = new Date().toISOString()
    let query = supabaseAdmin
      .from('dccmusic_notifications')
      .update({ read_at: now })
      .eq('composer_id', composer.composerId)
      .is('read_at', null)

    if (typeof body.id === 'string' && body.id) {
      query = query.eq('id', body.id)
    }

    const { error } = await query
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[NOTIFICATIONS] Erro ao marcar como lida:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar notificações' },
      { status: 500 }
    )
  }
}
