import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { paymentClient } from '@/lib/mercadopago'
import { supabaseAdmin } from '@/lib/supabase'
import { reportPaymentFailure } from '@/lib/payment-failure-alert'
import {
  buildMetaCapiMetadata,
  mergeMetaBrowserContext,
  readMetaBrowserContextFromMetadata,
  sendMetaPurchaseEvent,
  toMercadoPagoMetaCapiFields,
} from '@/lib/meta-conversions'
import { sendTikTokPurchaseEvent } from '@/lib/tiktok-events'
import { recordPartnerPurchase } from '@/lib/partners'
import {
  sendAdminPaymentNotificationEmail,
  sendPaymentConfirmationEmail,
} from '@/lib/dcc-emails'
import {
  activateComposerPlanAccess,
  upsertPlanPaymentRecord,
} from '@/lib/composer-plan-access'

export const dynamic = 'force-dynamic'

function compactObject<T extends Record<string, any>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== '')
  )
}

async function sendApprovedPlanSideEffects(request: NextRequest, subscription: any, payment: any, paymentId: string) {
  const [{ data: composer }, { data: plan }] = await Promise.all([
    supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name, email')
      .eq('id', subscription.composer_id)
      .maybeSingle(),
    supabaseAdmin
      .from('dccmusic_plans')
      .select('id, name')
      .eq('id', subscription.plan_id)
      .maybeSingle(),
  ])

  if (!composer?.email) return

  const description = plan?.name || 'Plano DCC Music'
  const amount = parseFloat(payment.transaction_amount || '0')
  await recordPartnerPurchase({
    composerId: composer.id,
    purchaseId: paymentId,
    amount,
    productType: 'composer_plan',
  })

  const browserContext = mergeMetaBrowserContext(
    readMetaBrowserContextFromMetadata(subscription?.metadata),
    readMetaBrowserContextFromMetadata(payment?.metadata)
  )

  await Promise.allSettled([
    sendMetaPurchaseEvent({
      request,
      browserContext,
      eventId: paymentId,
      eventSourceUrl:
        browserContext.event_source_url ||
        process.env.NEXTAUTH_URL ||
        'https://www.dccmusic.online',
      email: composer.email,
      externalId: composer.id,
      value: amount,
      currency: payment.currency_id || 'BRL',
      contentName: description,
      contentId: 'composer_plan',
      quantity: 1,
    }),
    sendTikTokPurchaseEvent({
      request,
      eventId: paymentId,
      eventSourceUrl: process.env.NEXTAUTH_URL || 'https://www.dccmusic.online',
      email: composer.email,
      externalId: composer.id,
      value: amount,
      currency: payment.currency_id || 'BRL',
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

export async function POST(request: NextRequest) {
  try {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      await reportPaymentFailure({
        provider: 'mercadopago',
        stage: 'configuracao_plano',
        error: 'MERCADOPAGO_ACCESS_TOKEN não configurado',
        requestUrl: request.url,
      })
      return NextResponse.json({ error: 'Mercado Pago não configurado no servidor' }, { status: 500 })
    }

    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const subscriptionId = String(body.subscriptionId || '').trim()
    const formData = body.formData || {}

    if (!subscriptionId) {
      return NextResponse.json({ error: 'subscriptionId obrigatório' }, { status: 400 })
    }

    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from('dccmusic_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('composer_id', composer.composerId)
      .maybeSingle()

    if (subscriptionError) throw subscriptionError
    if (!subscription) return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })

    if (subscription.status === 'active') {
      return NextResponse.json({
        success: true,
        status: 'paid',
        alreadyPaid: true,
        paymentId: subscription.payment_id,
        subscriptionId: subscription.id,
      })
    }

    const { data: plan } = await supabaseAdmin
      .from('dccmusic_plans')
      .select('id, name, price, duration_months')
      .eq('id', subscription.plan_id)
      .maybeSingle()

    const expectedAmount = Number(plan?.price) || 0
    if (expectedAmount <= 0) {
      return NextResponse.json({ error: 'Valor do plano não confere. Recarregue a página e tente novamente.' }, { status: 400 })
    }

    const { data: composerData } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('email, name')
      .eq('id', composer.composerId)
      .maybeSingle()

    const payer = compactObject({
      email: formData.payer?.email || composerData?.email,
      identification: formData.payer?.identification,
    })

    const paymentBody = compactObject({
      transaction_amount: expectedAmount,
      token: formData.token,
      description: plan?.name || 'Plano DCC Music',
      installments: formData.installments ? Number(formData.installments) : undefined,
      payment_method_id: formData.payment_method_id,
      issuer_id: formData.issuer_id,
      payer,
      external_reference: subscription.id,
      metadata: {
        type: 'composer_plan',
        subscription_id: subscription.id,
        composer_id: composer.composerId,
        plan_id: subscription.plan_id,
        ...toMercadoPagoMetaCapiFields(
          mergeMetaBrowserContext(
            readMetaBrowserContextFromMetadata(subscription.metadata),
            buildMetaCapiMetadata(request, {
              email: composerData?.email || null,
              externalId: composer.composerId,
              eventSourceUrl: request.headers.get('referer') || request.url,
            })
          )
        ),
      },
      statement_descriptor: 'DCC Music',
    })

    const payment = await paymentClient.create({
      body: paymentBody,
      requestOptions: {
        idempotencyKey: `composer-plan-${subscription.id}-${randomUUID()}`,
      },
    })

    const paymentId = String(payment.id || '')
    const paymentStatus = String(payment.status || 'pending')
    const paymentStatusMap: Record<string, string> = {
      approved: 'paid',
      pending: 'pending',
      in_process: 'pending',
      rejected: 'failed',
      cancelled: 'failed',
      refunded: 'refunded',
      charged_back: 'refunded',
    }
    const mappedStatus = paymentStatusMap[paymentStatus] || 'pending'

    await upsertPlanPaymentRecord({
      subscription,
      paymentId,
      paymentData: payment,
      status: mappedStatus,
    })

    if (paymentStatus === 'approved') {
      await activateComposerPlanAccess({
        subscription,
        plan,
        paymentId,
      })
      await sendApprovedPlanSideEffects(request, subscription, payment, paymentId)
      return NextResponse.json({
        success: true,
        status: 'paid',
        paymentId,
        subscriptionId: subscription.id,
        amount: expectedAmount,
      })
    }

    await supabaseAdmin
      .from('dccmusic_subscriptions')
      .update({
        status: mappedStatus === 'failed' ? 'cancelled' : 'pending',
        payment_id: paymentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)

    return NextResponse.json({
      success: true,
      status: paymentStatus,
      pending: mappedStatus === 'pending',
      paymentId,
      subscriptionId: subscription.id,
      amount: expectedAmount,
      payment,
    })
  } catch (error: any) {
    console.error('[PLAN PAYMENT] Erro ao processar pagamento embutido:', error)
    await reportPaymentFailure({
      provider: 'mercadopago',
      stage: 'processamento_pagamento_plano',
      error,
      requestUrl: request.url,
      composerId: getComposerFromRequest(request)?.composerId,
    })
    return NextResponse.json(
      { error: error.message || 'Erro ao processar pagamento' },
      { status: 500 }
    )
  }
}
