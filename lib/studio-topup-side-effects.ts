import { NextRequest } from 'next/server'
import { sendStudioTopupPurchaseEvents } from '@/lib/studio-topup-meta'
import { recordPartnerPurchase } from '@/lib/partners'
import {
  getComposerEmailIdentity,
  sendAdminPaymentNotificationEmail,
  sendPaymentConfirmationEmail,
} from '@/lib/dcc-emails'

export async function sendApprovedStudioTopupSideEffects(
  request: NextRequest,
  topup: any,
  paymentId: string
) {
  const composerEmail = await getComposerEmailIdentity(topup.composer_id)
  if (!composerEmail) return

  await recordPartnerPurchase({
    composerId: topup.composer_id,
    purchaseId: paymentId,
    amount: Number(topup.amount) || 0,
    productType: 'studio_topup',
  })

  await Promise.allSettled([
    sendStudioTopupPurchaseEvents({
      request,
      topup,
      paymentId,
      email: composerEmail.email,
      eventSourceUrl: request.headers.get('referer') || request.url,
    }),
    sendPaymentConfirmationEmail({
      ...composerEmail,
      paymentId,
      productType: 'studio_topup',
      description: `Recarga avulsa Studio IA - ${topup.music_quantity} música(s)`,
      amount: topup.amount,
      paidAt: new Date(),
    }),
    sendAdminPaymentNotificationEmail({
      composerName: composerEmail.name,
      composerEmail: composerEmail.email,
      paymentId,
      productType: 'studio_topup',
      description: `Recarga avulsa Studio IA - ${topup.music_quantity} música(s)`,
      amount: topup.amount,
    }),
  ])
}

