import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getSiteUserFromRequest } from '@/lib/site-user-auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const userType = body?.userType === 'site_user' ? 'site_user' : 'composer'
    const path = String(body?.path || '').slice(0, 300)
    const now = new Date().toISOString()

    const loggedUser = userType === 'site_user'
      ? getSiteUserFromRequest(request)
      : getComposerFromRequest(request)

    if (!loggedUser) {
      return NextResponse.json({ success: false }, { status: 401 })
    }

    const payload = userType === 'site_user'
      ? {
          user_type: 'site_user',
          user_id: (loggedUser as any).userId,
          name: loggedUser.name,
          email: loggedUser.email,
          path,
          user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
          last_seen: now,
          updated_at: now,
        }
      : {
          user_type: 'composer',
          user_id: (loggedUser as any).composerId,
          name: loggedUser.name,
          email: loggedUser.email,
          path,
          user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
          last_seen: now,
          updated_at: now,
        }

    const { error } = await supabaseAdmin
      .from('dccmusic_user_presence')
      .upsert(payload, { onConflict: 'user_type,user_id' })

    if (error) {
      if (isMissingPresenceTable(error)) {
        return NextResponse.json({ success: false, setupRequired: true })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Activity Ping] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro ao registrar atividade' }, { status: 500 })
  }
}
