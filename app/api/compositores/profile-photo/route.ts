import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { uploadComposerProfilePhoto } from '@/lib/composer-profile-photo'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('photo')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Selecione uma foto para enviar.' }, { status: 400 })
    }

    const profilePhotoUrl = await uploadComposerProfilePhoto({
      composerId: composer.composerId,
      file,
    })

    return NextResponse.json({
      success: true,
      profilePhotoUrl,
    })
  } catch (error: any) {
    console.error('[COMPOSER PROFILE PHOTO] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar foto de perfil' },
      { status: 500 }
    )
  }
}
