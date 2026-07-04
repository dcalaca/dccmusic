import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import * as db from '@/lib/db'
import { verifyMercadoPagoWebhookSignature } from '@/lib/mercadopago'
import {
  getComposerEmailIdentity,
  sendAdminPaymentNotificationEmail,
  sendPaymentConfirmationEmail,
} from '@/lib/dcc-emails'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, data, action } = body

    console.log('[FEATURED WEBHOOK] Notificação recebida:', { type, action, paymentId: data?.id })

    // 1ª trava: validar a assinatura secreta do Mercado Pago.
    // Só mensagens genuínas do Mercado Pago passam — impede liberar destaque com mensagem falsa.
    const signature = verifyMercadoPagoWebhookSignature(request, data?.id)
    if (!signature.configured) {
      console.warn('[FEATURED WEBHOOK] MERCADOPAGO_WEBHOOK_SECRET não configurado — assinatura não verificada.')
    } else if (!signature.ok) {
      console.error('[FEATURED WEBHOOK] Assinatura inválida. Notificação recusada:', signature.reason)
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }

    // Mercado Pago envia diferentes tipos de notificações
    if (type === 'payment') {
      const paymentId = data.id
      
      if (!paymentId) {
        console.error('[FEATURED WEBHOOK] Payment ID não encontrado')
        return NextResponse.json({ error: 'Payment ID não encontrado' }, { status: 400 })
      }

      // Buscar preferência para obter metadata
      const preferenceId = data.preference_id
      if (!preferenceId) {
        console.error('[FEATURED WEBHOOK] Preference ID não encontrado')
        return NextResponse.json({ error: 'Preference ID não encontrado' }, { status: 400 })
      }

      // Buscar destaque pago pela preferência
      const { data: featuredPayment, error: featuredError } = await supabaseAdmin
        .from('dccmusic_featured_payments')
        .select('*')
        .eq('mercado_pago_preference_id', preferenceId)
        .maybeSingle()

      if (featuredError || !featuredPayment) {
        console.error('[FEATURED WEBHOOK] Destaque não encontrado:', preferenceId, featuredError)
        return NextResponse.json({ error: 'Destaque não encontrado' }, { status: 404 })
      }

      console.log('[FEATURED WEBHOOK] Destaque encontrado:', featuredPayment.id, 'Status atual:', featuredPayment.payment_status)

      const status = data.status // approved, pending, rejected, cancelled, etc.

      // Mapear status do Mercado Pago
      let paymentStatus: 'approved' | 'rejected' | 'cancelled' = 'rejected'
      if (status === 'approved') {
        paymentStatus = 'approved'
      } else if (status === 'rejected' || status === 'cancelled') {
        paymentStatus = 'rejected'
      } else if (status === 'pending' || status === 'in_process') {
        // Manter como pending
        return NextResponse.json({ received: true, processed: false, message: 'Pagamento pendente' })
      }

      // Atualizar status do destaque
      if (paymentStatus === 'approved') {
        await db.updateFeaturedPaymentStatus(preferenceId, paymentId, 'approved')
        console.log('[FEATURED WEBHOOK] Destaque ativado:', featuredPayment.id)

        const composer = await getComposerEmailIdentity(featuredPayment.composer_id)
        if (composer) {
          const description = `Destaque de ${featuredPayment.content_type === 'video' ? 'vídeo' : 'música'}`
          await Promise.allSettled([
            sendPaymentConfirmationEmail({
              ...composer,
              paymentId,
              productType: 'featured',
              description,
              amount: 9.90,
              paidAt: new Date(),
            }),
            sendAdminPaymentNotificationEmail({
              composerName: composer.name,
              composerEmail: composer.email,
              paymentId,
              productType: 'featured',
              description,
              amount: 9.90,
            }),
          ])
        }
      } else {
        await db.updateFeaturedPaymentStatus(preferenceId, paymentId, paymentStatus)
        console.log('[FEATURED WEBHOOK] Destaque rejeitado:', featuredPayment.id)
      }
    }

    return NextResponse.json({ 
      received: true,
      processed: true,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('[FEATURED WEBHOOK] Erro ao processar webhook:', error)
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
  return NextResponse.json({ 
    status: 'ok',
    message: 'Webhook de destaque está funcionando',
    endpoint: '/api/compositores/featured/webhook',
    timestamp: new Date().toISOString()
  })
}
