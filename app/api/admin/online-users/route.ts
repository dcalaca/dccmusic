import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { formatDisplayName } from '@/lib/normalize'

export const dynamic = 'force-dynamic'

const ACTIVE_WINDOW_MINUTES = 10

function isMissingPresenceTable(error: any) {
  const message = String(error?.message || error?.details || '')
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    message.includes('dccmusic_user_presence') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  )
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const since = new Date(Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000).toISOString()
    const { data, error } = await supabaseAdmin
      .from('dccmusic_user_presence')
      .select('user_type, user_id, name, email, path, last_seen')
      .gte('last_seen', since)
      .order('last_seen', { ascending: false })
      .limit(100)

    if (error) {
      if (isMissingPresenceTable(error)) {
        return NextResponse.json({
          setupRequired: true,
          total: 0,
          composers: 0,
          users: 0,
          activeWindowMinutes: ACTIVE_WINDOW_MINUTES,
          rows: [],
          onlineComposers: [],
          updatedAt: new Date().toISOString(),
        })
      }
      throw error
    }

    const rows = data || []
    const composerRows = rows.filter((row: any) => row.user_type === 'composer')
    const composers = composerRows.length
    const users = rows.filter((row: any) => row.user_type === 'site_user').length

    return NextResponse.json({
      setupRequired: false,
      total: rows.length,
      composers,
      users,
      activeWindowMinutes: ACTIVE_WINDOW_MINUTES,
      rows: rows.slice(0, 8).map((row: any) => ({
        type: row.user_type,
        name: row.name ? formatDisplayName(row.name) : row.email || 'Usuário',
        email: row.email || null,
        path: row.path || null,
        lastSeen: row.last_seen,
      })),
      onlineComposers: composerRows.map((row: any) => ({
        name: row.name ? formatDisplayName(row.name) : row.email || 'Compositor',
        lastSeen: row.last_seen,
      })),
      updatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Admin Online Users] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao carregar usuários online' }, { status: 500 })
  }
}
