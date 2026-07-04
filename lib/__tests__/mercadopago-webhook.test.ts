import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import { verifyMercadoPagoWebhookSignature } from '../mercadopago'

const SECRET = 'test-webhook-secret-abc123'

function buildSignedRequest(options: {
  dataId: string
  requestId: string
  ts: string
  secret?: string
  tamperV1?: boolean
}) {
  const secretToSign = options.secret ?? SECRET
  const manifest = `id:${options.dataId};request-id:${options.requestId};ts:${options.ts};`
  let v1 = crypto.createHmac('sha256', secretToSign).update(manifest).digest('hex')
  if (options.tamperV1) v1 = v1.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))

  return new Request(`https://www.dccmusic.online/api/compositores/pagamento/webhook?data.id=${options.dataId}&type=payment`, {
    method: 'POST',
    headers: {
      'x-signature': `ts=${options.ts},v1=${v1}`,
      'x-request-id': options.requestId,
    },
  })
}

describe('verifyMercadoPagoWebhookSignature', () => {
  const originalSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET

  beforeEach(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET
  })

  afterEach(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = originalSecret
  })

  it('aceita uma assinatura válida', () => {
    const request = buildSignedRequest({ dataId: '123456789', requestId: 'req-1', ts: '1700000000' })
    const result = verifyMercadoPagoWebhookSignature(request, '123456789')
    expect(result.configured).toBe(true)
    expect(result.ok).toBe(true)
  })

  it('recusa uma assinatura adulterada', () => {
    const request = buildSignedRequest({ dataId: '123456789', requestId: 'req-1', ts: '1700000000', tamperV1: true })
    const result = verifyMercadoPagoWebhookSignature(request, '123456789')
    expect(result.configured).toBe(true)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('signature_mismatch')
  })

  it('recusa quando não há header de assinatura', () => {
    const request = new Request('https://www.dccmusic.online/api/compositores/pagamento/webhook?data.id=1&type=payment', {
      method: 'POST',
    })
    const result = verifyMercadoPagoWebhookSignature(request, '1')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('missing_signature_header')
  })

  it('recusa assinatura gerada com segredo diferente', () => {
    const request = buildSignedRequest({ dataId: '999', requestId: 'req-x', ts: '1700000000', secret: 'segredo-errado' })
    const result = verifyMercadoPagoWebhookSignature(request, '999')
    expect(result.ok).toBe(false)
  })

  it('não bloqueia quando o segredo não está configurado (compatibilidade)', () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET
    const request = new Request('https://www.dccmusic.online/api/compositores/pagamento/webhook?data.id=1&type=payment', {
      method: 'POST',
    })
    const result = verifyMercadoPagoWebhookSignature(request, '1')
    expect(result.configured).toBe(false)
    expect(result.ok).toBe(true)
  })
})
