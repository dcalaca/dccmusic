import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

export function getStudioCallbackFingerprint(body: any) {
  return createHash('sha256').update(stableStringify(body)).digest('hex')
}

export async function claimStudioCallbackEvent(input: {
  callbackKind: string
  taskId: string
  body: any
}) {
  const { data, error } = await supabaseAdmin.rpc('claim_studio_callback_event', {
    p_callback_kind: input.callbackKind,
    p_task_id: input.taskId,
    p_fingerprint: getStudioCallbackFingerprint(input.body),
  })

  if (error) throw error
  return data === true
}
