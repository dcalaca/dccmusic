import { NextRequest, NextResponse } from 'next/server'
import * as db from '@/lib/db'
import { getBaseUrl } from '@/lib/link-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, destinationUrl, createdBy, notes, expiresAt } = body

    if (!title || !destinationUrl) {
      return NextResponse.json(
        { error: 'Título e URL de destino são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar URL
    try {
      new URL(destinationUrl)
    } catch {
      return NextResponse.json(
        { error: 'URL de destino inválida' },
        { status: 400 }
      )
    }

    const link = await db.createTrackedLink({
      title,
      destinationUrl,
      createdBy: createdBy || null,
      notes: notes || null,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    })

    // Retornar URL completa do link rastreável
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
    
    const trackedUrl = `${baseUrl}/l/${link.shortCode}`

    return NextResponse.json({
      ...link,
      trackedUrl,
    })
  } catch (error: any) {
    console.error('Erro ao criar link rastreável:', error)
    return NextResponse.json(
      { error: 'Erro ao criar link rastreável', details: error.message },
      { status: 500 }
    )
  }
}
