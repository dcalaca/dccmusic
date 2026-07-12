import { NextRequest, NextResponse } from 'next/server'
import * as composerAuth from '@/lib/composer-auth'
import { sendComposerVerificationEmail } from '@/lib/composer-email-verification'
import { hasComposerAccountDeletionBlock } from '@/lib/dcc-emails'
import { validateSignupEmail } from '@/lib/email-validation'
import { PARTNER_SESSION_COOKIE, applyComposerPartnerAttribution } from '@/lib/partners'
import { sendMetaCompleteRegistrationEvent } from '@/lib/meta-conversions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, composerName, accountName, forceCreate, partnerAttribution } = body

    if (!email || !password || !composerName) {
      return NextResponse.json(
        { error: 'Email, senha e pseudônimo são obrigatórios' },
        { status: 400 }
      )
    }

    const emailValidation = validateSignupEmail(email)
    if (!emailValidation.valid) {
      return NextResponse.json(
        { error: emailValidation.error, suggestion: emailValidation.suggestion },
        { status: 400 }
      )
    }
    const normalizedEmail = emailValidation.email

    const emailWasDeleted = await hasComposerAccountDeletionBlock(normalizedEmail)
    if (emailWasDeleted) {
      return NextResponse.json(
        {
          error: 'Este e-mail já teve uma conta excluída anteriormente. Por segurança, não é possível criar uma nova conta grátis com o mesmo e-mail. Entre em contato com a DCC Music se precisar reativar o acesso.',
        },
        { status: 403 }
      )
    }

    // Validar senha (mínimo 6 caracteres)
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      )
    }

    const result = await composerAuth.createComposerAccount(normalizedEmail, password, composerName, forceCreate === true, accountName)

    // Se precisa de escolha do usuário, retornar lista de compositores similares
    if ('requiresChoice' in result && result.requiresChoice) {
      return NextResponse.json({
        requiresChoice: true,
        similarComposers: result.similarComposers,
      })
    }

    // Garantir que temos um composer válido
    if (!('composer' in result) || !result.composer) {
      return NextResponse.json(
        { error: 'Erro ao criar compositor' },
        { status: 500 }
      )
    }

    const partnerCode = partnerAttribution?.code ? String(partnerAttribution.code) : null
    if (partnerCode) {
      await applyComposerPartnerAttribution({
        composerId: result.composer.id,
        partnerCode,
        sessionId: request.cookies.get(PARTNER_SESSION_COOKIE)?.value || null,
      }).catch((partnerError) => {
        console.error('[CADASTRO] Erro ao atribuir parceiro:', partnerError)
      })
    }

    let message = 'Cadastro realizado com sucesso! Enviamos um link para confirmar seu e-mail.'
    
    if (result.wasExisting && 'previousName' in result) {
      if (result.previousName && result.previousName !== result.composer.name) {
        message = `Conta associada ao compositor existente "${result.previousName}" com sucesso! O nome foi atualizado para "${result.composer.name}". Enviamos um link para confirmar seu e-mail.`
      } else {
        message = 'Conta associada ao compositor existente com sucesso! Enviamos um link para confirmar seu e-mail.'
      }
    }

    try {
      await sendComposerVerificationEmail({
        composerId: result.composer.id,
        email: normalizedEmail,
        name: result.composer.name,
      })
    } catch (emailError) {
      console.error('[CADASTRO] Erro ao enviar confirmação de e-mail:', emailError)
      message = 'Cadastro realizado, mas não conseguimos enviar o e-mail de confirmação agora. Faça login e solicite o reenvio.'
    }

    const metaRegistrationEventId = `composer_registration:${result.composer.id}`
    await sendMetaCompleteRegistrationEvent({
      request,
      eventId: metaRegistrationEventId,
      eventSourceUrl: request.headers.get('referer') || request.url,
      email: normalizedEmail,
      externalId: result.composer.id,
      contentName: 'Cadastro de compositor',
    }).catch((metaError) => {
      console.error('[CADASTRO] Erro ao enviar cadastro para Meta:', metaError)
    })

    return NextResponse.json({
      success: true,
      metaRegistrationEventId,
      composer: {
        id: result.composer.id,
        name: result.composer.name,
        slug: result.composer.slug,
        email: normalizedEmail,
      },
      message,
    })
  } catch (error: any) {
    console.error('Erro ao cadastrar compositor:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao cadastrar compositor' },
      { status: 500 }
    )
  }
}
