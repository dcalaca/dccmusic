import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendAdminStudioAlertEmail } from '@/lib/dcc-emails'
import { reportPaymentFailure } from '../payment-failure-alert'

vi.mock('@/lib/dcc-emails', () => ({
  sendAdminStudioAlertEmail: vi.fn().mockResolvedValue({ sent: true }),
}))

describe('alertas administrativos de falhas de pagamento', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('agrupa falhas equivalentes em janelas de dez minutos', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-22T12:03:00.000Z'))

    await reportPaymentFailure({
      provider: 'mercadopago',
      stage: 'criacao_checkout_recarga',
      error: new Error('Pagamento 123456789 não autorizado'),
      requestUrl: 'https://www.dccmusic.online/api/pagamento?token=segredo',
    })
    await reportPaymentFailure({
      provider: 'mercadopago',
      stage: 'criacao_checkout_recarga',
      error: new Error('Pagamento 987654321 não autorizado'),
    })

    const calls = vi.mocked(sendAdminStudioAlertEmail).mock.calls
    expect(calls[0][0].eventKey).toEqual(calls[1][0].eventKey)
    expect(calls[0][0].metadata?.route).toBe('/api/pagamento')
    expect(calls[0][0].detailsHtml).not.toContain('token=segredo')

    vi.setSystemTime(new Date('2026-08-22T12:13:00.000Z'))
    await reportPaymentFailure({
      provider: 'mercadopago',
      stage: 'criacao_checkout_recarga',
      error: new Error('Pagamento 123456789 não autorizado'),
    })

    expect(calls[2][0].eventKey).not.toEqual(calls[0][0].eventKey)
  })

  it('oculta credenciais e não notifica o mesmo erro duas vezes', async () => {
    const error = new Error('Falha com Bearer supersecreto e sk_live_abc123')

    await reportPaymentFailure({ provider: 'stripe', stage: 'webhook', error })
    const secondAttempt = await reportPaymentFailure({ provider: 'stripe', stage: 'webhook', error })

    expect(sendAdminStudioAlertEmail).toHaveBeenCalledOnce()
    expect(secondAttempt).toEqual({ sent: false, reason: 'already_reported_for_request' })
    expect(vi.mocked(sendAdminStudioAlertEmail).mock.calls[0][0].message).not.toContain('supersecreto')
    expect(vi.mocked(sendAdminStudioAlertEmail).mock.calls[0][0].message).not.toContain('sk_live_abc123')
  })

  it('não interrompe o pagamento quando o envio do alerta falha', async () => {
    vi.mocked(sendAdminStudioAlertEmail).mockRejectedValueOnce(new Error('Brevo indisponível'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(reportPaymentFailure({
      provider: 'stripe',
      stage: 'criacao_checkout',
      error: new Error('Gateway indisponível'),
    })).resolves.toEqual({ sent: false, reason: 'alert_delivery_failed' })

    consoleError.mockRestore()
  })
})
