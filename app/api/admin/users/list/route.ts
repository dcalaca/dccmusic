import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'
import { formatDisplayName } from '@/lib/normalize'

export const dynamic = 'force-dynamic'

// GET - Listar todos os usuários do site
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { data: users, error } = await supabaseAdmin
      .from('dccmusic_site_users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar usuários:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar usuários', details: error.message },
        { status: 500 }
      )
    }

    // Buscar estatísticas de cada usuário (avaliações e comentários)
    const usersWithStats = await Promise.all(
      (users || []).map(async (user: any) => {
        // Contar avaliações
        const { count: ratingsCount } = await supabaseAdmin
          .from('dccmusic_ratings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        // Contar comentários
        const { count: commentsCount } = await supabaseAdmin
          .from('dccmusic_comments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        const formattedName = formatDisplayName(user.name)
        return {
          id: user.id,
          name: formattedName,
          email: user.email,
          firstName: formatDisplayName(user.first_name || formattedName.split(' ')[0]),
          isActive: user.is_active !== false,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
          ratingsCount: ratingsCount || 0,
          commentsCount: commentsCount || 0,
        }
      })
    )

    return NextResponse.json(usersWithStats)
  } catch (error: any) {
    console.error('Erro ao listar usuários:', error)
    return NextResponse.json(
      { error: 'Erro ao listar usuários', details: error.message },
      { status: 500 }
    )
  }
}
