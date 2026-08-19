import crypto from 'crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { sanitizeStripeObject, verifyStripeWebhookSignature } from '../stripe'

describe('Stripe webhook', () => {
  const original = process.env.STRIPE_WEBHOOK_SECRET
  afterEach(() => { process.env.STRIPE_WEBHOOK_SECRET = original })

  it('valida uma assinatura oficial', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    const body = '{"id":"evt_1"}'
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = crypto.createHmac('sha256', 'whsec_test').update(`${timestamp}.${body}`).digest('hex')
    expect(verifyStripeWebhookSignature(body, `t=${timestamp},v1=${signature}`).ok).toBe(true)
  })

  it('recusa assinatura adulterada', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    const timestamp = Math.floor(Date.now() / 1000)
    expect(verifyStripeWebhookSignature('{}', `t=${timestamp},v1=bad`).ok).toBe(false)
  })

  it('não guarda dados sensíveis', () => {
    expect(sanitizeStripeObject({ id: 'cs_1', payment_intent: 'pi_1', card: { number: '4242' } })).toEqual(expect.objectContaining({ id: 'cs_1', payment_intent: 'pi_1' }))
    expect(sanitizeStripeObject({ id: 'cs_1', card: { number: '4242' } })).not.toHaveProperty('card')
  })
})
