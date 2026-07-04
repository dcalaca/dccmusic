import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { startStudioVideoGeneration } from '@/lib/studio-video'
import { creditStudioTopupOnce, revokeStudioTopupCreditOnce } from '@/lib/studio'
import { paymentClient, verifyMercadoPagoWebhookSignature } from '@/lib/mercadopago'
import { sendMetaPurchaseEvent } from '@/lib/meta-conversions'
import { sendTikTokPurchaseEvent } from '@/lib/tiktok-events'
import { recordPartnerPurchase } from '@/lib/partners'
import * as db from '@/lib/db'
import {
  getComposerEmailIdentity,
  sendAdminPaymentNotificationEmail,
  sendPaymentConfirmationEmail,
} from '@/lib/dcc-emails'

export const dynamic = 'force-dynamic'

function getPaymentIdFromNotification(body: any, requestUrl: string) {
  const url = new URL(requestUrl)
  return (
    body?.data?.id ||
    body?.id ||
    body?.resource ||
    url.searchParams.get('data.id') ||
    url.searchParams.get('id') ||
    url.searchParams.get('payment_id')
  )
}

function isPaymentNotification(body: any, requestUrl: string) {
  const url = new URL(requestUrl)
  const type = body?.type || url.searchParams.get('type') || url.searchParams.get('topic')
  const action = body?.action || ''
  return type === 'payment' || action.startsWith('payment.')
}

function isMercadoPagoPanelTest(body: any, requestUrl: string) {
  const url = new URL(requestUrl)
  const paymentId = getPaymentIdFromNotification(body, requestUrl)
  const topic = url.searchParams.get('topic') || url.searchParams.get('type')
  return topic === 'payment' && String(paymentId) === '123456' && !body?.data?.id
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function resolveSubscriptionEndDate(subscription: any, plan: any) {
  const existingEndDate = subscription?.end_date ? new Date(subscription.end_date) : null
  if (existingEndDate && existingEndDate > new Date()) return existingEndDate

  const durationMonths = Math.max(1, Number(plan?.duration_months) || 1)
  return addMonths(new Date(), durationMonths)
}

async function activateComposerPlanAccess(input: {
  subscription: any
  plan?: any
  paymentId: string | number
}) {
  const endDate = resolveSubscriptionEndDate(input.subscription, input.plan)

  const [{ error: subscriptionError }, { error: composerError }] = await Promise.all([
    supabaseAdmin
      .from('dccmusic_subscriptions')
      .update({
        status: 'active',
        payment_id: input.paymentId,
        end_date: endDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.subscription.id),
    supabaseAdmin
      .from('dccmusic_composers')
      .update({
        is_premium: true,
        has_active_subscription: true,
        subscription_expires_at: endDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.subscription.composer_id),
  ])

  if (subscriptionError) throw subscriptionError
  if (composerError) throw composerError
}

async function getMercadoPagoPaymentDetails(paymentId: string | number): Promise<any> {
  // Segurança: SEMPRE confirmar o pagamento consultando a API do Mercado Pago.
  // Nunca confiar em dados de status/external_reference enviados no corpo da notificação,
  // pois o corpo pode ser forjado por terceiros para liberar acesso sem pagamento.
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado para consultar pagamento')
  }

  return paymentClient.get({ id: paymentId })
}

export async function POST(request: Request) {
  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const { type, data, action } = body
    const notificationIsPayment = isPaymentNotification(body, request.url)
    const notificationPaymentId = getPaymentIdFromNotification(body, request.url)

    console.log('[WEBHOOK] Notificação recebida:', { type, action, paymentId: notificationPaymentId })

    if (isMercadoPagoPanelTest(body, request.url)) {
      return NextResponse.json({
        received: true,
        processed: true,
        test: true,
        message: 'Teste do painel Mercado Pago recebido',
        timestamp: new Date().toISOString(),
      })
    }

    // 1ª trava: validar a assinatura secreta do Mercado Pago.
    const signature = verifyMercadoPagoWebhookSignature(request, notificationPaymentId)
    if (!signature.configured) {
      console.warn('[WEBHOOK] MERCADOPAGO_WEBHOOK_SECRET não configurado — assinatura não verificada.')
    } else if (!signature.ok) {
      console.error('[WEBHOOK] Assinatura inválida. Notificação recusada:', signature.reason)
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }

    // Mercado Pago envia diferentes tipos de notificações
    if (notificationIsPayment) {
      const paymentId = notificationPaymentId
      
      if (!paymentId) {
        console.error('[WEBHOOK] Payment ID não encontrado')
        return NextResponse.json({ error: 'Payment ID não encontrado' }, { status: 400 })
      }

      const paymentData = await getMercadoPagoPaymentDetails(paymentId)

      // External reference é o ID da assinatura (subscription_id)
      const externalReference = paymentData.external_reference || paymentData.metadata?.subscription_id
      const status = paymentData.status // approved, pending, rejected, cancelled, etc.

      if (!externalReference) {
        console.error('[WEBHOOK] External reference não encontrada:', paymentData)
        return NextResponse.json({ error: 'External reference não encontrada' }, { status: 400 })
      }

      if (String(externalReference).startsWith('studio-video:')) {
        const videoStatusMap: Record<string, string> = {
          approved: 'requested',
          pending: 'payment_pending',
          in_process: 'payment_pending',
          rejected: 'failed',
          cancelled: 'cancelled',
          refunded: 'cancelled',
          charged_back: 'cancelled',
        }
        const videoStatus = videoStatusMap[status] || 'payment_pending'

        const { data: updatedVideoRequest, error: videoRequestError } = await supabaseAdmin
          .from('studio_video_requests')
          .update({
            status: videoStatus,
            payment_id: paymentId,
            updated_at: new Date().toISOString(),
            paid_at: status === 'approved' ? new Date().toISOString() : null,
            metadata: paymentData,
          })
          .eq('external_reference', externalReference)
          .select('*')
          .maybeSingle()

        if (videoRequestError) {
          console.error('[WEBHOOK] Erro ao atualizar vídeo com letra:', videoRequestError)
          return NextResponse.json({ error: 'Erro ao atualizar vídeo com letra' }, { status: 500 })
        }

        if (status === 'approved' && updatedVideoRequest?.id) {
          try {
            await startStudioVideoGeneration(updatedVideoRequest.id)
          } catch (videoStartError) {
            console.error('[WEBHOOK] Erro ao iniciar geração do vídeo com letra:', videoStartError)
          }
        }

        return NextResponse.json({
          received: true,
          processed: true,
          type: 'studio_video_clip',
          status: videoStatus,
          timestamp: new Date().toISOString(),
        })
      }

      if (String(externalReference).startsWith('studio-topup:')) {
        const topupStatusMap: Record<string, string> = {
          approved: 'paid',
          pending: 'pending',
          in_process: 'pending',
          rejected: 'failed',
          cancelled: 'cancelled',
          refunded: 'refunded',
          charged_back: 'refunded',
        }
        const topupStatus = topupStatusMap[status] || 'pending'

        const { data: currentTopup, error: currentTopupError } = await supabaseAdmin
          .from('studio_credit_topups')
          .select('*')
          .eq('external_reference', externalReference)
          .maybeSingle()

        if (currentTopupError || !currentTopup) {
          console.error('[WEBHOOK] Recarga Studio IA não encontrada:', externalReference, currentTopupError)
          return NextResponse.json({ error: 'Recarga Studio IA não encontrada' }, { status: 404 })
        }

        let creditedTopup = currentTopup
        let credited = false

        if (status === 'approved') {
          const creditResult = await creditStudioTopupOnce({
            topup: currentTopup,
            paymentId,
            paymentData,
          })
          creditedTopup = creditResult.topup
          credited = creditResult.credited
        } else {
          const { error: topupUpdateError } = await supabaseAdmin
            .from('studio_credit_topups')
            .update({
              status: topupStatus,
              payment_id: paymentId,
              metadata: {
                ...(currentTopup.metadata || {}),
                mercadopago_payment: paymentData,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentTopup.id)

          if (topupUpdateError) {
            console.error('[WEBHOOK] Erro ao atualizar recarga Studio IA:', topupUpdateError)
            return NextResponse.json({ error: 'Erro ao atualizar recarga Studio IA' }, { status: 500 })
          }

          if (
            currentTopup.status === 'paid' &&
            (status === 'refunded' || status === 'charged_back' || status === 'cancelled')
          ) {
            await revokeStudioTopupCreditOnce({
              topup: currentTopup,
              paymentId,
              paymentData,
              reason: status,
            })
          }
        }

        if (status === 'approved' && credited) {
          await recordPartnerPurchase({
            composerId: creditedTopup.composer_id,
            purchaseId: String(paymentId),
            amount: Number(creditedTopup.amount) || 0,
            productType: 'studio_topup',
          })

          const composer = await getComposerEmailIdentity(creditedTopup.composer_id)
          if (composer) {
            await Promise.allSettled([
              sendMetaPurchaseEvent({
                request,
                eventId: String(paymentId),
                eventSourceUrl: process.env.NEXTAUTH_URL || 'https://www.dccmusic.online',
                email: composer.email,
                externalId: creditedTopup.composer_id,
                value: Number(creditedTopup.amount) || 0,
                currency: creditedTopup.currency || 'BRL',
                contentName: 'Recarga Studio IA',
                contentId: 'studio_topup',
                quantity: Number(creditedTopup.music_quantity) || 1,
              }),
              sendTikTokPurchaseEvent({
                request,
                eventId: String(paymentId),
                eventSourceUrl: process.env.NEXTAUTH_URL || 'https://www.dccmusic.online',
                email: composer.email,
                externalId: creditedTopup.composer_id,
                value: Number(creditedTopup.amount) || 0,
                currency: creditedTopup.currency || 'BRL',
                contentName: 'Recarga Studio IA',
                contentId: 'studio_topup',
                quantity: Number(creditedTopup.music_quantity) || 1,
              }),
              sendPaymentConfirmationEmail({
                ...composer,
                paymentId,
                productType: 'studio_topup',
                description: `Recarga avulsa Studio IA - ${creditedTopup.music_quantity} música(s)`,
                amount: creditedTopup.amount,
                paidAt: new Date(),
              }),
              sendAdminPaymentNotificationEmail({
                composerName: composer.name,
                composerEmail: composer.email,
                paymentId,
                productType: 'studio_topup',
                description: `Recarga avulsa Studio IA - ${creditedTopup.music_quantity} música(s)`,
                amount: creditedTopup.amount,
              }),
            ])
          }
        }

        return NextResponse.json({
          received: true,
          processed: true,
          type: 'studio_topup',
          status: topupStatus,
          timestamp: new Date().toISOString(),
        })
      }

      // Buscar assinatura
      const { data: subscription, error: subError } = await supabaseAdmin
        .from('dccmusic_subscriptions')
        .select('*')
        .eq('id', externalReference)
        .single()

      if (subError || !subscription) {
        console.error('[WEBHOOK] Assinatura não encontrada:', externalReference, subError)
        return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })
      }

      console.log('[WEBHOOK] Assinatura encontrada:', subscription.id, 'Status atual:', subscription.status)

      // Mapear status do Mercado Pago para nosso sistema
      const paymentStatusMap: Record<string, string> = {
        'approved': 'paid',
        'pending': 'pending',
        'in_process': 'pending',
        'rejected': 'failed',
        'cancelled': 'failed',
        'refunded': 'failed',
        'charged_back': 'failed',
      }

      const paymentStatus = paymentStatusMap[status] || 'pending'

      // Verificar se já existe pagamento com este ID (idempotência)
      const { data: existingPayment } = await supabaseAdmin
        .from('dccmusic_payments')
        .select('id, status')
        .eq('gateway_payment_id', paymentId)
        .maybeSingle()

      let paymentJustConfirmed = false

      if (!existingPayment) {
        // Criar registro de pagamento apenas se não existir
        const { error: paymentError } = await supabaseAdmin
          .from('dccmusic_payments')
          .insert({
            subscription_id: subscription.id,
            composer_id: subscription.composer_id,
            amount: parseFloat(paymentData.transaction_amount || '0'),
            currency: paymentData.currency_id || 'BRL',
            status: paymentStatus,
            payment_method: paymentData.payment_method_id || null,
            payment_gateway: 'mercadopago',
            gateway_payment_id: paymentId,
            gateway_response: paymentData,
            paid_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
          })

        if (paymentError) {
          console.error('[WEBHOOK] Erro ao criar pagamento:', paymentError)
        } else {
          console.log('[WEBHOOK] Pagamento criado:', paymentId, paymentStatus)
          paymentJustConfirmed = paymentStatus === 'paid'
        }
      } else {
        console.log('[WEBHOOK] Pagamento já existe:', paymentId, 'Status atual:', existingPayment.status)

        if (paymentStatus === 'paid' && existingPayment.status !== 'paid') {
          const { error: paymentUpdateError } = await supabaseAdmin
            .from('dccmusic_payments')
            .update({
              status: paymentStatus,
              gateway_response: paymentData,
              paid_at: new Date().toISOString(),
            })
            .eq('id', existingPayment.id)

          if (paymentUpdateError) {
            console.error('[WEBHOOK] Erro ao confirmar pagamento existente:', paymentUpdateError)
          } else {
            paymentJustConfirmed = true
            console.log('[WEBHOOK] Pagamento existente confirmado:', paymentId)
          }
        } else if (existingPayment.status !== paymentStatus) {
          const { error: paymentUpdateError } = await supabaseAdmin
            .from('dccmusic_payments')
            .update({
              status: paymentStatus,
              gateway_response: paymentData,
              paid_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
            })
            .eq('id', existingPayment.id)

          if (paymentUpdateError) {
            console.error('[WEBHOOK] Erro ao atualizar pagamento existente:', paymentUpdateError)
          }
        }
      }

      const { data: planForAccess } = await supabaseAdmin
        .from('dccmusic_plans')
        .select('id, name, duration_months')
        .eq('id', subscription.plan_id)
        .maybeSingle()

      // Atualizar status da assinatura
      let subscriptionStatus = subscription.status // Manter status atual se não mudar
      
      if (status === 'approved') {
        subscriptionStatus = 'active'
      } else if (status === 'rejected' || status === 'cancelled') {
        subscriptionStatus = 'cancelled'
      } else if (status === 'pending' || status === 'in_process') {
        subscriptionStatus = 'pending'
      }

      // Atualizar apenas se o status mudou
      if (subscriptionStatus !== subscription.status) {
        const { error: updateError } = await supabaseAdmin
          .from('dccmusic_subscriptions')
          .update({
            status: subscriptionStatus,
            payment_id: paymentId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id)

        if (updateError) {
          console.error('[WEBHOOK] Erro ao atualizar assinatura:', updateError)
        } else {
          console.log('[WEBHOOK] Assinatura atualizada:', subscription.id, 'Status:', subscriptionStatus)
        }
      }

      if (status === 'approved') {
        await activateComposerPlanAccess({
          subscription,
          plan: planForAccess,
          paymentId,
        })
      }

      // O trigger no banco também pode atualizar o campo is_premium do compositor,
      // mas o código acima garante a ativação mesmo quando o trigger não existir.
      if (status === 'approved' && paymentJustConfirmed) {
        const [{ data: composer }, { data: plan }] = await Promise.all([
          supabaseAdmin
            .from('dccmusic_composers')
            .select('id, name, email')
            .eq('id', subscription.composer_id)
            .maybeSingle(),
          supabaseAdmin
            .from('dccmusic_plans')
            .select('name')
            .eq('id', subscription.plan_id)
            .maybeSingle(),
        ])

        if (composer?.email) {
          const description = plan?.name || 'Plano DCC Music'
          const amount = parseFloat(paymentData.transaction_amount || '0')
          await recordPartnerPurchase({
            composerId: composer.id,
            purchaseId: String(paymentId),
            amount,
            productType: 'composer_plan',
          })
          await Promise.allSettled([
            sendMetaPurchaseEvent({
              request,
              eventId: String(paymentId),
              eventSourceUrl: process.env.NEXTAUTH_URL || 'https://www.dccmusic.online',
              email: composer.email,
              externalId: composer.id,
              value: amount,
              currency: paymentData.currency_id || 'BRL',
              contentName: description,
              contentId: 'composer_plan',
              quantity: 1,
            }),
            sendTikTokPurchaseEvent({
              request,
              eventId: String(paymentId),
              eventSourceUrl: process.env.NEXTAUTH_URL || 'https://www.dccmusic.online',
              email: composer.email,
              externalId: composer.id,
              value: amount,
              currency: paymentData.currency_id || 'BRL',
              contentName: description,
              contentId: 'composer_plan',
              quantity: 1,
            }),
            sendPaymentConfirmationEmail({
              composerId: composer.id,
              name: composer.name || 'Compositor',
              email: composer.email,
              paymentId,
              productType: 'plan',
              description,
              amount,
              paidAt: new Date(),
            }),
            sendAdminPaymentNotificationEmail({
              composerName: composer.name || 'Compositor',
              composerEmail: composer.email,
              paymentId,
              productType: 'plan',
              description,
              amount,
            }),
          ])
        }
      }
    } else if (type === 'merchant_order') {
      // Processar notificações de pedido (opcional)
      console.log('[WEBHOOK] Notificação de merchant_order recebida:', data)
    }

    return NextResponse.json({ 
      received: true,
      processed: true,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('[WEBHOOK] Erro ao processar webhook:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Erro ao processar webhook',
        received: true,
        processed: false
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  // GET para verificação do webhook (Mercado Pago faz GET para verificar se a URL está acessível)
  return NextResponse.json({ 
    status: 'ok',
    message: 'Webhook está funcionando',
    endpoint: '/api/compositores/pagamento/webhook',
    timestamp: new Date().toISOString()
  })
}
