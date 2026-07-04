import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

function jsonNoStore(payload: any) {
  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
    },
  })
}

function isMissingNoticeTable(error: any) {
  const message = String(error?.message || error?.details || '')
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    message.includes('site_notices') ||
    message.includes('Could not find the table') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  )
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_notices')
      .select('id, title, message, updated_at, is_active')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      if (isMissingNoticeTable(error)) {
        return jsonNoStore({ notice: null })
      }
      throw error
    }

    return jsonNoStore({
      notice: data ? {
        id: data.id,
        title: data.title,
        message: data.message,
        updatedAt: data.updated_at,
      } : null,
    })
  } catch (error: any) {
    console.error('[Notices] Erro ao carregar aviso ativo:', error)
    return jsonNoStore({ notice: null })
  }
}
