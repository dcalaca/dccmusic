import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  topup: null as any,
  creditResult: null as any,
  sendSideEffects: vi.fn(),
  paymentGet: vi.fn(),
  creditOnce: vi.fn(),
}))

vi.mock('@/lib/composer-middleware', () => ({
  getComposerFromRequest: () => ({ composerId: 'composer-1' }),
}))

vi.mock('@/lib/mercadopago', () => ({
  paymentClient: { get: state.paymentGet },
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.topup, error: null }),
          }),
        }),
      }),
    }),
  },
}))

vi.mock('@/lib/studio', () => ({
  creditStudioTopupOnce: state.creditOnce,
  revokeStudioTopupCreditOnce: vi.fn(),
}))

vi.mock('@/lib/stripe', () => ({
  getStripeSettlement: vi.fn(),
  sanitizeStripeObject: (value: unknown) => value,
  stripeRequest: vi.fn(),
}))

vi.mock('@/lib/studio-topup-side-effects', () => ({
  sendApprovedStudioTopupSideEffects: state.sendSideEffects,
}))

import { POST } from '@/app/api/compositores/studio/topup/sync/route'

function request() {
  return new NextRequest('https://www.dccmusic.online/api/compositores/studio/topup/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ topupId: 'topup-1', paymentId: 'payment-1' }),
  })
}

describe('sincronização de recarga do Studio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'test-token'
    state.topup = {
      id: 'topup-1',
      composer_id: 'composer-1',
      status: 'pending',
      payment_id: 'payment-1',
      payment_gateway: 'mercadopago',
      external_reference: 'reference-1',
      amount: 2.99,
      currency: 'BRL',
      credits: 10,
      music_quantity: 1,
    }
    state.paymentGet.mockResolvedValue({
      id: 'payment-1',
      status: 'approved',
      external_reference: 'reference-1',
    })
  })

  it('não reenvia Purchase quando a recarga já estava paga', async () => {
    state.topup.status = 'paid'

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'paid', alreadyPaid: true })
    expect(state.sendSideEffects).not.toHaveBeenCalled()
    expect(state.paymentGet).not.toHaveBeenCalled()
  })

  it('não envia Purchase quando outro processo já conquistou a trava', async () => {
    state.creditOnce.mockResolvedValue({
      credited: false,
      topup: { ...state.topup, status: 'paid' },
      reason: 'already_paid_or_claimed',
    })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(state.sendSideEffects).not.toHaveBeenCalled()
  })

  it('envia Purchase uma vez para o processo que confirmou a recarga', async () => {
    const paidTopup = { ...state.topup, status: 'paid' }
    state.creditOnce.mockResolvedValue({ credited: true, topup: paidTopup, reason: 'credited' })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(state.sendSideEffects).toHaveBeenCalledTimes(1)
    expect(state.sendSideEffects).toHaveBeenCalledWith(expect.any(NextRequest), paidTopup, 'payment-1')
  })
})
