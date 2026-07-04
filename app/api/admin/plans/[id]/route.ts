import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { slugify } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Resolver params se for Promise (Next.js 15+)
    const resolvedParams = params instanceof Promise ? await params : params
    const planId = resolvedParams.id
    
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const plan = await db.getPlanById(planId)
    if (!plan) {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

    return NextResponse.json(plan)
  } catch (error: any) {
    console.error('[API] Erro ao buscar plano:', error)
    return NextResponse.json({ error: 'Erro ao buscar plano' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Resolver params se for Promise (Next.js 15+)
    const resolvedParams = params instanceof Promise ? await params : params
    const planId = resolvedParams.id
    
    console.log(`[API PUT /plans/${planId}] Iniciando atualização`)
    
    const session = await getServerSession(authOptions)
    if (!session) {
      console.log(`[API PUT /plans/${planId}] Não autorizado`)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    console.log(`[API PUT /plans/${planId}] Body recebido:`, body)
    const { name, slug, price, durationMonths, description, features, featuredMusicsPerMonth, hasPriorityFeatured, hasGoldBadge, hasPremiumLayout, isActive } = body

    const updates: any = {}
    if (name !== undefined) updates.name = name
    if (slug !== undefined) updates.slug = slugify(slug)
    if (price !== undefined) updates.price = parseFloat(price)
    if (durationMonths !== undefined) updates.durationMonths = parseInt(durationMonths)
    if (description !== undefined) updates.description = description
    if (features !== undefined) updates.features = features
    if (featuredMusicsPerMonth !== undefined) updates.featuredMusicsPerMonth = featuredMusicsPerMonth ? parseInt(featuredMusicsPerMonth) : null
    if (hasPriorityFeatured !== undefined) updates.hasPriorityFeatured = hasPriorityFeatured
    if (hasGoldBadge !== undefined) updates.hasGoldBadge = hasGoldBadge
    if (hasPremiumLayout !== undefined) updates.hasPremiumLayout = hasPremiumLayout
    if (isActive !== undefined) updates.isActive = isActive

    console.log(`[API PUT /plans/${planId}] Atualizações:`, updates)
    const plan = await db.updatePlan(planId, updates)
    console.log(`[API PUT /plans/${planId}] Plano atualizado com sucesso`)
    return NextResponse.json(plan)
  } catch (error: any) {
    console.error(`[API PUT /plans/${params instanceof Promise ? '?' : params.id}] Erro:`, error)
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Plano com este slug já existe' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar plano' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Resolver params se for Promise (Next.js 15+)
    const resolvedParams = params instanceof Promise ? await params : params
    const planId = resolvedParams.id
    
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    await db.deletePlan(planId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API] Erro ao deletar plano:', error)
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao deletar plano' }, { status: 500 })
  }
}
