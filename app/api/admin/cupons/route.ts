import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function normalizeCode(value: unknown) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('studio_coupons')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ coupons: data || [] })
  } catch (error: any) {
    console.error('[ADMIN CUPONS] Erro ao listar:', error)
    return NextResponse.json({ error: error.message || 'Erro ao listar cupons' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const code = normalizeCode(body.code)
    const musicQuantity = Math.floor(Number(body.musicQuantity) || 0)
    const price = Number(body.price)
    const maxUses = Math.floor(Number(body.maxUses) || 0)
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    const expiresAtRaw = body.expiresAt ? String(body.expiresAt).trim() : ''

    if (code.length < 3) {
      return NextResponse.json({ error: 'O código precisa ter pelo menos 3 caracteres.' }, { status: 400 })
    }
    if (musicQuantity <= 0) {
      return NextResponse.json({ error: 'Informe quantas músicas o cupom dá (maior que zero).' }, { status: 400 })
    }
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'Informe um preço válido (0 para cupom grátis).' }, { status: 400 })
    }
    if (maxUses <= 0) {
      return NextResponse.json({ error: 'Informe quantas vezes o cupom pode ser usado (maior que zero).' }, { status: 400 })
    }

    let expiresAt: string | null = null
    if (expiresAtRaw) {
      const parsed = new Date(expiresAtRaw)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Data de validade inválida.' }, { status: 400 })
      }
      expiresAt = parsed.toISOString()
    }

    const { data: existing } = await supabaseAdmin
      .from('studio_coupons')
      .select('id')
      .eq('code', code)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Já existe um cupom com esse código.' }, { status: 409 })
    }

    const { data, error } = await supabaseAdmin
      .from('studio_coupons')
      .insert({
        code,
        music_quantity: musicQuantity,
        price: Number(price.toFixed(2)),
        max_uses: maxUses,
        used_count: 0,
        expires_at: expiresAt,
        active: true,
        note: note || null,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ coupon: data })
  } catch (error: any) {
    console.error('[ADMIN CUPONS] Erro ao criar:', error)
    return NextResponse.json({ error: error.message || 'Erro ao criar cupom' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const id = String(body.id || '')
    if (!id) {
      return NextResponse.json({ error: 'Cupom não informado.' }, { status: 400 })
    }

    const update: Record<string, any> = { updated_at: new Date().toISOString() }
    if (typeof body.active === 'boolean') {
      update.active = body.active
    }

    const { data, error } = await supabaseAdmin
      .from('studio_coupons')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ coupon: data })
  } catch (error: any) {
    console.error('[ADMIN CUPONS] Erro ao atualizar:', error)
    return NextResponse.json({ error: error.message || 'Erro ao atualizar cupom' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Cupom não informado.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('studio_coupons').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[ADMIN CUPONS] Erro ao excluir:', error)
    return NextResponse.json({ error: error.message || 'Erro ao excluir cupom' }, { status: 500 })
  }
}
