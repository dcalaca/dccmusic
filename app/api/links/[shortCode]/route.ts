import { NextRequest, NextResponse } from 'next/server'
import * as db from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'

// GET - Buscar estatísticas de um link
export async function GET(
  request: NextRequest,
  { params }: { params: { shortCode: string } }
) {
  try {
    const { shortCode } = params

    if (!shortCode) {
      return NextResponse.json(
        { error: 'Código do link não fornecido' },
        { status: 400 }
      )
    }

    const stats = await db.getTrackedLinkStats(shortCode)

    if (!stats) {
      return NextResponse.json(
        { error: 'Link não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(stats)
  } catch (error: any) {
    console.error('Erro ao buscar estatísticas do link:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas', details: error.message },
      { status: 500 }
    )
  }
}

// PUT - Atualizar link
export async function PUT(
  request: NextRequest,
  { params }: { params: { shortCode: string } }
) {
  try {
    const { shortCode } = params
    const body = await request.json()

    // Buscar o link primeiro
    const link = await db.getTrackedLinkByShortCode(shortCode)
    if (!link) {
      return NextResponse.json(
        { error: 'Link não encontrado' },
        { status: 404 }
      )
    }

    // Validar URL se fornecida
    if (body.destinationUrl) {
      try {
        new URL(body.destinationUrl)
      } catch {
        return NextResponse.json(
          { error: 'URL de destino inválida' },
          { status: 400 }
        )
      }
    }

    // Preparar dados de atualização - só incluir campos que foram enviados
    const updateData: any = {}
    
    if (body.title !== undefined) updateData.title = body.title
    if (body.destinationUrl !== undefined) updateData.destinationUrl = body.destinationUrl
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    
    // Tratar expiresAt - se for string vazia, definir como null, senão converter para Date
    if (body.expiresAt !== undefined) {
      if (body.expiresAt === '' || body.expiresAt === null) {
        updateData.expiresAt = null
      } else {
        try {
          const dateObj = new Date(body.expiresAt)
          // Validar se a data é válida
          if (isNaN(dateObj.getTime())) {
            return NextResponse.json(
              { error: 'Data de expiração inválida' },
              { status: 400 }
            )
          }
          updateData.expiresAt = dateObj
        } catch (error) {
          return NextResponse.json(
            { error: 'Data de expiração inválida', details: String(error) },
            { status: 400 }
          )
        }
      }
    }

    const updatedLink = await db.updateTrackedLink(link.id, updateData)

    return NextResponse.json(updatedLink)
  } catch (error: any) {
    console.error('Erro ao atualizar link:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar link', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Deletar link
export async function DELETE(
  request: NextRequest,
  { params }: { params: { shortCode: string } }
) {
  try {
    const { shortCode } = params

    // Buscar o link diretamente sem filtro de ativo (para poder deletar qualquer link)
    const { data: linkData, error: findError } = await supabaseAdmin
      .from('dccmusic_tracked_links')
      .select('id')
      .eq('short_code', shortCode)
      .single()
    
    if (findError) {
      console.error('Erro ao buscar link:', findError)
      return NextResponse.json(
        { error: 'Link não encontrado', details: findError.message },
        { status: 404 }
      )
    }

    if (!linkData || !linkData.id) {
      return NextResponse.json(
        { error: 'Link não encontrado' },
        { status: 404 }
      )
    }

    console.log(`Deletando link com ID: ${linkData.id}`)
    await db.deleteTrackedLink(linkData.id)
    console.log(`Link ${linkData.id} deletado com sucesso`)

    return NextResponse.json({ message: 'Link deletado com sucesso' })
  } catch (error: any) {
    console.error('Erro ao deletar link:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar link', details: error.message },
      { status: 500 }
    )
  }
}
