import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'

// PUT - Atualizar usuário
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const { id } = params
    const body = await request.json()

    const updateData: any = {}
    if (body.isActive !== undefined) {
      updateData.is_active = body.isActive
    }
    if (body.name !== undefined) {
      updateData.name = body.name
    }
    if (body.firstName !== undefined) {
      updateData.first_name = body.firstName
    }

    const { data, error } = await supabaseAdmin
      .from('dccmusic_site_users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar usuário:', error)
      return NextResponse.json(
        { error: 'Erro ao atualizar usuário', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      email: data.email,
      firstName: data.first_name || data.name.split(' ')[0],
      isActive: data.is_active !== false,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error: any) {
    console.error('Erro ao atualizar usuário:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar usuário', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Deletar usuário
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const { id } = params

    // Deletar avaliações e comentários do usuário primeiro (cascade)
    const { error: deleteError } = await supabaseAdmin
      .from('dccmusic_site_users')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Erro ao deletar usuário:', deleteError)
      return NextResponse.json(
        { error: 'Erro ao deletar usuário', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Usuário deletado com sucesso' })
  } catch (error: any) {
    console.error('Erro ao deletar usuário:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar usuário', details: error.message },
      { status: 500 }
    )
  }
}
