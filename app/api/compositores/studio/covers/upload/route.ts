import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { getProjectForComposer } from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 5 * 1024 * 1024
const allowed = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']])

function matchesSignature(buffer: Buffer, mime: string) {
  if (mime === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (mime === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (mime === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
  return false
}

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const form = await request.formData()
    const projectId = String(form.get('projectId') || '')
    const file = form.get('image')
    if (!projectId || !(file instanceof File)) return NextResponse.json({ error: 'Informe projeto e imagem.' }, { status: 400 })

    const project = await getProjectForComposer(projectId, composer.composerId)
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

    if (!allowed.has(file.type) || file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Envie JPG, PNG ou WEBP de até 5 MB.' }, { status: 400 })
    }
    const bytes = Buffer.from(await file.arrayBuffer())
    if (!matchesSignature(bytes, file.type)) return NextResponse.json({ error: 'Imagem inválida.' }, { status: 400 })

    const imagePath = `${composer.composerId}/covers/user/${randomUUID()}.${allowed.get(file.type)}`
    const { error: uploadError } = await supabaseAdmin.storage.from('studio-assets').upload(imagePath, bytes, {
      contentType: file.type, upsert: false,
    })
    if (uploadError) throw uploadError

    const { data: signed, error: signError } = await supabaseAdmin.storage.from('studio-assets').createSignedUrl(imagePath, 60 * 60 * 24 * 7)
    if (signError || !signed?.signedUrl) {
      await supabaseAdmin.storage.from('studio-assets').remove([imagePath])
      throw signError || new Error('Não foi possível criar URL da capa.')
    }

    const { data: cover, error: insertError } = await supabaseAdmin.from('studio_covers').insert({
      project_id: project.id,
      composer_id: composer.composerId,
      provider: 'user_upload',
      image_url: signed.signedUrl,
      image_path: imagePath,
      prompt: null,
      is_premium: false,
      is_current: false,
    }).select('id').single()
    if (insertError) {
      await supabaseAdmin.storage.from('studio-assets').remove([imagePath])
      throw insertError
    }

    // Use the established cover-selection workflow; no AI calls and no credit transaction.
    const { error: deselectError } = await supabaseAdmin.from('studio_covers').update({ is_current: false })
      .eq('project_id', project.id).eq('composer_id', composer.composerId)
    if (deselectError) throw deselectError
    const { error: selectError } = await supabaseAdmin.from('studio_covers').update({ is_current: true })
      .eq('id', cover.id).eq('project_id', project.id).eq('composer_id', composer.composerId)
    if (selectError) throw selectError

    return NextResponse.json({ success: true, coverId: cover.id, creditsCharged: 0 })
  } catch (error) {
    console.error('[Studio IA] Erro ao enviar capa própria:', error)
    return NextResponse.json({ error: 'Não foi possível enviar a capa.' }, { status: 500 })
  }
}
