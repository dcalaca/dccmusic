import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getComposerSavedPlaybackAssets } from '@/lib/studio-playback-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const assets = await getComposerSavedPlaybackAssets(composer.composerId)
    return NextResponse.json({ assets })
  } catch (error: any) {
    console.error('[Studio Playbacks] Erro ao listar arquivos salvos:', error)
    return NextResponse.json({ error: error?.message || 'Erro ao carregar playbacks salvos.' }, { status: 500 })
  }
}
