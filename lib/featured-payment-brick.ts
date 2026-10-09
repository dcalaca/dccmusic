import { supabaseAdmin } from '@/lib/supabase'
import { paymentClient } from '@/lib/mercadopago'
import { getComposerEmailIdentity, sendAdminPaymentNotificationEmail, sendPaymentConfirmationEmail } from '@/lib/dcc-emails'

export async function reconcileFeaturedPayment(featuredId: string, paymentId: string) {
  const { data: featured, error } = await supabaseAdmin.from('dccmusic_featured_payments')
    .select('*').eq('id', featuredId).maybeSingle()
  if (error) throw error
  if (!featured) throw new Error('Destaque não encontrado')
  const payment: any = await paymentClient.get({ id: paymentId })
  const meta = payment?.metadata || {}
  const matches = String(meta.featured_id || '') === featured.id &&
    String(meta.composer_id || '') === featured.composer_id &&
    String(meta.content_id || '') === featured.content_id &&
    String(meta.content_type || '') === featured.content_type &&
    payment.currency_id === 'BRL' &&
    Math.abs(Number(payment.transaction_amount) - Number(featured.amount)) < 0.001 &&
    payment.live_mode === true
  if (!matches) throw new Error('Pagamento não corresponde ao destaque')
  if (featured.mercado_pago_payment_id && String(featured.mercado_pago_payment_id) !== String(payment.id)) {
    throw new Error('Destaque vinculado a outra transação')
  }
  if (featured.payment_status === 'approved') {
    return { status: 'paid', featured, payment }
  }
  if (payment.status === 'approved') {
    const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    const { data: updated, error: updateError } = await supabaseAdmin.from('dccmusic_featured_payments')
      .update({ payment_status: 'approved', mercado_pago_payment_id: String(payment.id),
        expires_at: expiresAt, is_active: true, updated_at: new Date().toISOString() })
      .eq('id', featured.id).eq('payment_status', 'pending').select('*').maybeSingle()
    if (updateError) throw updateError
    if (updated) {
      try {
        const composer = await getComposerEmailIdentity(updated.composer_id)
        if (composer) {
          const description = `Destaque de ${updated.content_type === 'video' ? 'vídeo' : 'música'}`
          await Promise.allSettled([
            sendPaymentConfirmationEmail({ ...composer, paymentId: String(payment.id), productType: 'featured', description, amount: Number(updated.amount), paidAt: new Date() }),
            sendAdminPaymentNotificationEmail({ composerName: composer.name, composerEmail: composer.email, paymentId: String(payment.id), productType: 'featured', description, amount: Number(updated.amount) }),
          ])
        }
      } catch (mailError) {
        console.error('[FEATURED] Falha não bloqueante no email:', mailError)
      }
    }
    return { status: 'paid', featured: updated || featured, payment }
  }
  if (['rejected', 'cancelled'].includes(String(payment.status))) {
    await supabaseAdmin.from('dccmusic_featured_payments').update({
      payment_status: payment.status === 'cancelled' ? 'cancelled' : 'rejected',
      mercado_pago_payment_id: String(payment.id), updated_at: new Date().toISOString()
    }).eq('id', featured.id).eq('payment_status', 'pending')
  } else {
    await supabaseAdmin.from('dccmusic_featured_payments')
      .update({ mercado_pago_payment_id: String(payment.id), updated_at: new Date().toISOString() })
      .eq('id', featured.id).eq('payment_status', 'pending')
  }
  return { status: payment.status, featured, payment }
}
