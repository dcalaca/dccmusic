import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { slugify } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const plans = await db.getAllPlans()
    return NextResponse.json(plans)
  } catch (error: any) {
    console.error('[API] Erro ao buscar planos:', error)
    return NextResponse.json({ error: 'Erro ao buscar planos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, slug, price, durationMonths, description, features, featuredMusicsPerMonth, hasPriorityFeatured, hasGoldBadge, hasPremiumLayout, isActive } = body

    if (!name || !slug || price === undefined || !durationMonths) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const plan = await db.createPlan({
      name,
      slug: slugify(slug),
      price: parseFloat(price),
      durationMonths: parseInt(durationMonths),
      description: description || null,
      features: features || [],
      featuredMusicsPerMonth: featuredMusicsPerMonth ? parseInt(featuredMusicsPerMonth) : null,
      hasPriorityFeatured: hasPriorityFeatured || false,
      hasGoldBadge: hasGoldBadge || false,
      hasPremiumLayout: hasPremiumLayout || false,
      isActive: isActive !== undefined ? isActive : true,
    })

    return NextResponse.json(plan)
  } catch (error: any) {
    console.error('[API] Erro ao criar plano:', error)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Plano com este slug já existe' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao criar plano' }, { status: 500 })
  }
}
