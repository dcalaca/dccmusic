import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { startStudioVideoGeneration } from '@/lib/studio-video'
import { creditStudioTopupOnce, revokeStudioTopupCreditOnce } from '@/lib/studio'
import { paymentClient, verifyMercadoPagoWebhookSignature } from '@/lib/mercadopago'
import {
  mergeMetaBrowserContext,
  readMetaBrowserContextFromMetadata,
  sendMetaPurchaseEvent,
} from '@/lib/meta-conversions'
import { sendTikTokPurchaseEvent } from '@/lib/tiktok-events'
import { sendStudioTopupPurchaseEvents } from '@/lib/studio-topup-meta'
import { recordPartnerPurchase } from '@/lib/partners'
import {
  getComposerEmailIdentity,
  sendAdminPaymentNotificationEmail,
  sendPaymentConfirmationEmail,
} from '@/lib/dcc-emails'
import { activateComposerPlanAccess, revokeComposerPlanAccess } from '@/lib/composer-plan-access'

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

        if (status === 'approved') {
          const composer = await getComposerEmailIdentity(creditedTopup.composer_id)

          // Purchase Meta/TikTok mesmo se outro fluxo já tiver creditado (evita perder CAPI na corrida webhook vs página de sucesso).
          if (composer) {
            await sendStudioTopupPurchaseEvents({
              request,
              topup: creditedTopup,
              paymentId: String(paymentId),
              email: composer.email,
              paymentMetadata: paymentData?.metadata,
            })
          } else {
            console.error('[WEBHOOK] Recarga aprovada sem e-mail do compositor; Purchase Meta não enviado:', {
              topupId: creditedTopup.id,
              paymentId,
              composerId: creditedTopup.composer_id,
            })
          }

          if (credited && composer) {
            await recordPartnerPurchase({
              composerId: creditedTopup.composer_id,
              purchaseId: String(paymentId),
              amount: Number(creditedTopup.amount) || 0,
              productType: 'studio_topup',
            })

            await Promise.allSettled([
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
        'refunded': 'refunded',
        'charged_back': 'refunded',
      }

      const paymentStatus = paymentStatusMap[status] || 'pending'
      const isPlanRefundOrCancel =
        status === 'refunded' || status === 'charged_back' || status === 'cancelled'

      // Verificar se já existe pagamento com este ID (idempotência)
      const { data: existingPayment } = await supabaseAdmin
        .from('dccmusic_payments')
        .select('id, status, paid_at')
        .eq('gateway_payment_id', paymentId)
        .maybeSingle()

      let paymentJustConfirmed = false
      const wasPaidBefore =
        existingPayment?.status === 'paid' || subscription.status === 'active'

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
              // Mantém paid_at no estorno para histórico no extrato
              paid_at:
                paymentStatus === 'paid'
                  ? new Date().toISOString()
                  : paymentStatus === 'refunded'
                    ? existingPayment.paid_at || null
                    : null,
            })
            .eq('id', existingPayment.id)

          if (paymentUpdateError) {
            console.error('[WEBHOOK] Erro ao atualizar pagamento existente:', paymentUpdateError)
          } else {
            console.log('[WEBHOOK] Pagamento atualizado:', paymentId, paymentStatus)
          }
        }
      }

      const { data: planForAccess } = await supabaseAdmin
        .from('dccmusic_plans')
        .select('id, name, duration_months')
        .eq('id', subscription.plan_id)
        .maybeSingle()

      if (status === 'approved') {
        await activateComposerPlanAccess({
          subscription,
          plan: planForAccess,
          paymentId,
        })
      } else if (
        isPlanRefundOrCancel &&
        (wasPaidBefore || paymentStatus === 'refunded' || subscription.status === 'active')
      ) {
        try {
          await revokeComposerPlanAccess({
            subscription,
            paymentId,
          })
          console.log(
            '[WEBHOOK] Plano revogado por estorno/cancelamento:',
            subscription.id,
            status
          )
        } catch (revokeError) {
          console.error('[WEBHOOK] Erro ao revogar plano após estorno/cancelamento:', revokeError)
          return NextResponse.json({ error: 'Erro ao revogar plano' }, { status: 500 })
        }
      } else if (status === 'rejected' || status === 'cancelled') {
        if (subscription.status !== 'cancelled') {
          const { error: updateError } = await supabaseAdmin
            .from('dccmusic_subscriptions')
            .update({
              status: 'cancelled',
              payment_id: paymentId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', subscription.id)

          if (updateError) {
            console.error('[WEBHOOK] Erro ao cancelar assinatura:', updateError)
          } else {
            console.log('[WEBHOOK] Assinatura cancelada:', subscription.id)
          }
        }
      } else if (
        (status === 'pending' || status === 'in_process') &&
        subscription.status !== 'pending' &&
        subscription.status !== 'active'
      ) {
        const { error: updateError } = await supabaseAdmin
          .from('dccmusic_subscriptions')
          .update({
            status: 'pending',
            payment_id: paymentId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id)

        if (updateError) {
          console.error('[WEBHOOK] Erro ao atualizar assinatura pendente:', updateError)
        }
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
          const browserContext = mergeMetaBrowserContext(
            readMetaBrowserContextFromMetadata(subscription?.metadata),
            readMetaBrowserContextFromMetadata(paymentData?.metadata)
          )
          await Promise.allSettled([
            sendMetaPurchaseEvent({
              request,
              browserContext,
              eventId: String(paymentId),
              eventSourceUrl:
                browserContext.event_source_url ||
                process.env.NEXTAUTH_URL ||
                'https://www.dccmusic.online',
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
