import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as db from '@/lib/db'
import { formatDisplayName } from '@/lib/normalize'
import { registerComposerAccountDeletionBlock, sendAdminComposerMessageEmail, sendManualStudioCreditEmail } from '@/lib/dcc-emails'
import { addStudioCreditTransaction, STUDIO_MUSIC_CREDITS } from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import { sendComposerActivationReminderEmail } from '@/lib/composer-email-verification'

async function getComposerIdentityForAdmin(composerId: string) {
  const { data, error } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id, name, email, email_verified')
    .eq('id', composerId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id as string,
    name: formatDisplayName(data.name || 'Compositor'),
    email: data.email as string | null,
    emailVerified: Boolean(data.email_verified),
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const composer = await db.getComposerById(params.id)
    if (!composer) {
      return NextResponse.json({ error: 'Compositor não encontrado' }, { status: 404 })
    }

    // Buscar estatísticas
    const [videoCount, musicCount, totalViews, studioLyrics, studioGenerations] = await Promise.all([
      db.getComposerVideoCount(params.id),
      db.getComposerMusicCount(params.id),
      db.getComposerTotalViews(params.id),
      supabaseAdmin.from('studio_lyrics').select('id', { count: 'exact', head: true }).eq('composer_id', params.id),
      supabaseAdmin.from('studio_generations').select('id', { count: 'exact', head: true }).eq('composer_id', params.id).neq('status', 'failed'),
    ])

    return NextResponse.json({
      ...composer,
      videoCount,
      musicCount,
      totalViews,
      studioLyricCount: studioLyrics.count || 0,
      studioMusicCount: studioGenerations.count || 0,
    })
  } catch (error: any) {
    console.error('Erro ao buscar compositor:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar compositor', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, slug, email } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      )
    }

    const composer = await db.updateComposer(params.id, {
      name: formatDisplayName(name),
      slug: slug?.trim(),
      email: email?.trim() || null,
    })

    return NextResponse.json(composer)
  } catch (error: any) {
    console.error('Erro ao atualizar compositor:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar compositor', details: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    if (body?.action === 'activate_account') {
      const composer = await getComposerIdentityForAdmin(params.id)
      if (!composer) {
        return NextResponse.json({ error: 'Compositor não encontrado' }, { status: 404 })
      }

      const now = new Date().toISOString()
      const passwordHash = await bcrypt.hash('123', 10)
      const { error: updateError } = await supabaseAdmin
        .from('dccmusic_composers')
        .update({
          email_verified: true,
          email_verified_at: now,
          password_hash: passwordHash,
          updated_at: now,
        })
        .eq('id', composer.id)

      if (updateError) throw updateError

      await supabaseAdmin
        .from('composer_email_verifications')
        .update({ used_at: now })
        .eq('composer_id', composer.id)
        .is('used_at', null)

      return NextResponse.json({
        success: true,
        message: 'Conta ativada e senha definida como 123.',
        composer: {
          id: composer.id,
          name: composer.name,
          email: composer.email || null,
          emailVerified: true,
        },
      })
    }

    if (body?.action === 'send_activation_reminder') {
      const composer = await getComposerIdentityForAdmin(params.id)
      if (!composer) {
        return NextResponse.json({ error: 'Compositor não encontrado' }, { status: 404 })
      }
      if (!composer.email) {
        return NextResponse.json({ error: 'Este compositor não tem e-mail cadastrado.' }, { status: 400 })
      }
      if (composer.emailVerified) {
        return NextResponse.json({ error: 'Esta conta já está ativada.' }, { status: 400 })
      }

      const result = await sendComposerActivationReminderEmail({
        composerId: composer.id,
        email: composer.email,
        name: composer.name,
      })

      return NextResponse.json({
        success: true,
        emailSent: Boolean(result.sent),
        recipientEmail: composer.email,
      })
    }

    if (body?.action === 'send_admin_email') {
      const composer = await db.getComposerById(params.id)
      if (!composer) {
        return NextResponse.json({ error: 'Compositor não encontrado' }, { status: 404 })
      }

      const recipientEmail = String(body.email || composer.email || '').trim()
      const subject = String(body.subject || '').trim()
      const message = String(body.message || '').trim()

      if (!recipientEmail) {
        return NextResponse.json({ error: 'Informe o e-mail do destinatário.' }, { status: 400 })
      }
      if (!subject) {
        return NextResponse.json({ error: 'Informe o assunto do e-mail.' }, { status: 400 })
      }
      if (!message || message.length < 5) {
        return NextResponse.json({ error: 'Escreva uma mensagem com pelo menos 5 caracteres.' }, { status: 400 })
      }

      const result = await sendAdminComposerMessageEmail({
        composerId: composer.id,
        name: composer.name,
        email: recipientEmail,
        subject,
        message,
        adminEmail: session.user?.email || null,
      })

      return NextResponse.json({
        success: true,
        emailSent: Boolean(result.sent),
        recipientEmail,
      })
    }

    if (body?.action !== 'grant_studio_credits') {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    const musicQuantity = Math.floor(Number(body.musicQuantity) || 0)
    const reason = String(body.reason || '').trim()
    const message = String(body.message || '').trim()
    const shouldSendEmail = body.sendEmail !== false

    if (musicQuantity <= 0) {
      return NextResponse.json({ error: 'Informe pelo menos 1 música para creditar.' }, { status: 400 })
    }
    if (musicQuantity > 100) {
      return NextResponse.json({ error: 'O crédito manual permite no máximo 100 músicas por lançamento.' }, { status: 400 })
    }
    if (!reason) {
      return NextResponse.json({ error: 'Informe o motivo do crédito manual.' }, { status: 400 })
    }

    const composer = await db.getComposerById(params.id)
    if (!composer) {
      return NextResponse.json({ error: 'Compositor não encontrado' }, { status: 404 })
    }
    if (shouldSendEmail && !composer.email) {
      return NextResponse.json({ error: 'Este compositor não tem e-mail cadastrado para aviso.' }, { status: 400 })
    }

    const credits = musicQuantity * STUDIO_MUSIC_CREDITS
    await addStudioCreditTransaction({
      composerId: composer.id,
      action: 'manual_credit',
      amount: credits,
      description: `Crédito manual administrativo: ${musicQuantity} música(s)`,
      metadata: {
        source: 'admin_manual_credit',
        musicQuantity,
        credits,
        reason,
        adminEmail: session.user?.email || null,
      },
    })

    let emailSent = false
    if (shouldSendEmail && composer.email) {
      const result = await sendManualStudioCreditEmail({
        composerId: composer.id,
        name: composer.name,
        email: composer.email,
        musicQuantity,
        credits,
        reason,
        message,
      })
      emailSent = Boolean(result.sent)
    }

    const { data: latestManualCredit } = await supabaseAdmin
      .from('studio_credit_transactions')
      .select('id, created_at')
      .eq('composer_id', composer.id)
      .eq('action', 'manual_credit')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      composer: {
        id: composer.id,
        name: composer.name,
        email: composer.email || null,
      },
      transaction: latestManualCredit || null,
      musicQuantity,
      credits,
      emailSent,
    })
  } catch (error: any) {
    console.error('Erro ao creditar Studio IA manualmente:', error)
    return NextResponse.json(
      { error: 'Erro ao creditar Studio IA manualmente', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const composer = await db.getComposerById(params.id)
    if (!composer) {
      return NextResponse.json({ error: 'Compositor não encontrado' }, { status: 404 })
    }

    await db.deleteComposer(params.id)

    if (composer.email) {
      await registerComposerAccountDeletionBlock({
        composerId: composer.id,
        name: composer.name,
        email: composer.email,
        source: 'admin',
      })
    }

    return NextResponse.json({
      success: true,
      deletedComposer: {
        id: composer.id,
        name: composer.name,
        email: composer.email || null,
      },
    })
  } catch (error: any) {
    console.error('Erro ao excluir compositor:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir compositor', details: error.message },
      { status: 500 }
    )
  }
}
