import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = ['ad', 'campaign'] as const
const ALLOWED_STATUS = ['ACTIVE', 'PAUSED'] as const

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const accessToken = process.env.META_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json(
        { error: 'META_ACCESS_TOKEN não configurado.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const id = String(body.id || '').trim()
    const type = String(body.type || '').trim() as typeof ALLOWED_TYPES[number]
    const status = String(body.status || '').trim().toUpperCase() as typeof ALLOWED_STATUS[number]

    if (!id || !ALLOWED_TYPES.includes(type) || !ALLOWED_STATUS.includes(status)) {
      return NextResponse.json(
        { error: 'Informe id, type ad/campaign e status ACTIVE/PAUSED.' },
        { status: 400 }
      )
    }

    const apiVersion = process.env.META_GRAPH_API_VERSION || 'v20.0'
    const params = new URLSearchParams({
      access_token: accessToken,
      status,
    })

    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok || payload?.error || payload?.success === false) {
      return NextResponse.json(
        {
          error: payload?.error?.message || 'Não foi possível alterar o status no Meta Ads.',
          details: payload?.error,
          hint: 'Para pausar/ativar campanhas, o token precisa ter permissão ads_management e acesso à conta de anúncios.',
        },
        { status: response.status || 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      id,
      type,
      status,
      response: payload,
    })
  } catch (error: any) {
    console.error('[ADMIN ADS STATUS] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao alterar status do anúncio/campanha', details: error.message },
      { status: 500 }
    )
  }
}
