import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verificar se é admin autenticado
    const session = await getServerSession(authOptions)
    const isAdmin = !!session

    const { searchParams } = new URL(request.url)
    const createdBy = searchParams.get('createdBy')
    const all = searchParams.get('all') === 'true' // Parâmetro para buscar todos

    let links: db.TrackedLink[]

    // Se for admin e pedir todos, ou se não tiver createdBy, buscar todos
    if ((isAdmin && all) || (!createdBy && isAdmin)) {
      links = await db.getAllTrackedLinks()
    } else if (createdBy) {
      links = await db.getTrackedLinksByCreator(createdBy)
    } else {
      return NextResponse.json(
        { error: 'Parâmetro createdBy é obrigatório ou você precisa ser admin' },
        { status: 400 }
      )
    }

    // Adicionar URL completa para cada link
    // Tentar usar a URL do request primeiro (mais confiável)
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL
    
    if (!baseUrl) {
      // Construir a partir do request
      const protocol = request.headers.get('x-forwarded-proto') || 
                      (request.url.startsWith('https') ? 'https' : 'http')
      const host = request.headers.get('host') || 
                   request.headers.get('x-forwarded-host')
      
      if (host && !host.includes('localhost')) {
        // Usar host do request se não for localhost
        baseUrl = `${protocol}://${host}`
      } else {
        // Fallback para produção conhecida
        baseUrl = 'https://www.dccmusic.online'
      }
    }
    
    // Remover barra final se houver e garantir que não seja URL de preview
    baseUrl = baseUrl.replace(/\/$/, '')
    
    // Se for URL de preview do Vercel, usar a URL de produção oficial
    if (baseUrl.includes('vercel.app')) {
      // Sempre usar o domínio oficial em produção
      baseUrl = 'https://www.dccmusic.online'
    }

    const linksWithUrls = links.map(link => ({
      ...link,
      trackedUrl: `${baseUrl}/l/${link.shortCode}`,
    }))

    return NextResponse.json(linksWithUrls)
  } catch (error: any) {
    console.error('Erro ao listar links:', error)
    return NextResponse.json(
      { error: 'Erro ao listar links', details: error.message },
      { status: 500 }
    )
  }
}
