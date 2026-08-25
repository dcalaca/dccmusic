import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import { formatDisplayName, normalizeName } from '@/lib/normalize'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  try {
    const composerToken = getComposerFromRequest(request)
    if (!composerToken) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const rawName = typeof body?.name === 'string' ? body.name.trim() : ''

    if (!rawName) {
      return NextResponse.json({ error: 'Informe o nome público.' }, { status: 400 })
    }

    if (rawName.length > 100) {
      return NextResponse.json({ error: 'O nome público deve ter no máximo 100 caracteres.' }, { status: 400 })
    }

    const formattedName = formatDisplayName(rawName)
    const normalizedName = normalizeName(formattedName)

    if (!normalizedName) {
      return NextResponse.json({ error: 'Informe um nome público válido.' }, { status: 400 })
    }

    const { data: composers, error: lookupError } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name')

    if (lookupError) throw lookupError

    const duplicate = (composers || []).find((composer: any) =>
      composer.id !== composerToken.composerId && normalizeName(composer.name || '') === normalizedName
    )

    if (duplicate) {
      return NextResponse.json(
        { error: 'Esse nome público já está em uso. Escolha outro.' },
        { status: 409 }
      )
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('dccmusic_composers')
      .update({ name: formattedName })
      .eq('id', composerToken.composerId)
      .select('id, name, slug, account_name, email')
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      composer: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        accountName: updated.account_name || null,
        email: updated.email,
      },
    })
  } catch (error: any) {
    console.error('[COMPOSER PUBLIC NAME] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar nome público' },
      { status: 500 }
    )
  }
}
