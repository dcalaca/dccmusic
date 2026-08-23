import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  isValidStudioCallback: vi.fn(() => true),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/studio', () => ({
  isValidStudioCallback: mocks.isValidStudioCallback,
}))

import { POST } from '@/app/api/studio/suno/voice-validation-callback/route'

describe('callback da validação de voz', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isValidStudioCallback.mockReturnValue(true)
  })

  it('preserva a reativação gratuita ao receber a nova frase', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        provider_payload: {
          consentConfirmed: true,
          reactivationFree: true,
        },
      },
      error: null,
    })
    const selectEq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq: selectEq }))
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq: updateEq }))

    mocks.from
      .mockReturnValueOnce({ select })
      .mockReturnValueOnce({ update })

    const providerPayload = {
      code: 200,
      data: {
        taskId: 'voice-validation-task',
        validateInfo: 'Esta é minha voz autorizada.',
      },
    }

    const response = await POST(new Request('https://www.dccmusic.online/api/studio/suno/voice-validation-callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(providerPayload),
    }))

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'awaiting_verification',
      validate_info: 'Esta é minha voz autorizada.',
      provider_payload: {
        consentConfirmed: true,
        reactivationFree: true,
        validationCallback: providerPayload,
      },
    }))
    expect(updateEq).toHaveBeenCalledWith('validation_task_id', 'voice-validation-task')
  })
})
