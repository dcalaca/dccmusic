import { supabaseAdmin } from '@/lib/supabase'

export type AppSettingType = 'number' | 'text' | 'boolean'

export type AppSettingDefinition = {
  key: string
  label: string
  description: string
  group: string
  type: AppSettingType
  defaultValue: string
  min?: number
  max?: number
}

export const APP_SETTING_DEFINITIONS: AppSettingDefinition[] = [
  {
    key: 'studio.long_lyric_prefer_mureka_chars',
    label: 'Limiar de letra longa (preferir Mureka)',
    description:
      'Quando a letra tiver pelo menos este número de caracteres (e no máximo 3000), o Studio IA tenta o Mureka antes do Suno. Isso reduz músicas longas/duplicadas. Ex.: Quem sou eu tem ~1688 caracteres.',
    group: 'Studio IA',
    type: 'number',
    defaultValue: '1500',
    min: 500,
    max: 3000,
  },
]

const definitionByKey = new Map(APP_SETTING_DEFINITIONS.map((item) => [item.key, item]))

type CacheEntry = {
  value: string | null
  expiresAt: number
}

const settingsCache = new Map<string, CacheEntry>()
const SETTINGS_CACHE_TTL_MS = 30_000

function getEnvFallback(key: string): string | null {
  if (key === 'studio.long_lyric_prefer_mureka_chars') {
    const raw = process.env.STUDIO_LONG_LYRIC_PREFER_MUREKA_CHARS?.trim()
    return raw || null
  }
  return null
}

function invalidateSettingCache(key?: string) {
  if (key) {
    settingsCache.delete(key)
    return
  }
  settingsCache.clear()
}

export function getAppSettingDefinition(key: string) {
  return definitionByKey.get(key) || null
}

export async function getAppSettingValue(key: string): Promise<string | null> {
  const cached = settingsCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (error) throw error

    const value = typeof data?.value === 'string' ? data.value : null
    settingsCache.set(key, { value, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS })
    return value
  } catch (error) {
    console.error('[app-settings] Erro ao ler configuração:', key, error)
    settingsCache.set(key, { value: null, expiresAt: Date.now() + 5_000 })
    return null
  }
}

export async function getAppNumberSetting(key: string, fallback: number): Promise<number> {
  const definition = getAppSettingDefinition(key)
  const dbValue = await getAppSettingValue(key)
  const envValue = getEnvFallback(key)
  const raw = dbValue ?? envValue ?? definition?.defaultValue ?? String(fallback)
  const parsed = Number(raw)

  if (!Number.isFinite(parsed)) return fallback

  let value = parsed
  if (typeof definition?.min === 'number') value = Math.max(definition.min, value)
  if (typeof definition?.max === 'number') value = Math.min(definition.max, value)
  return value
}

export function validateAppSettingValue(key: string, rawValue: unknown) {
  const definition = getAppSettingDefinition(key)
  if (!definition) {
    return { ok: false as const, error: 'Configuração desconhecida.' }
  }

  const value = String(rawValue ?? '').trim()
  if (!value) {
    return { ok: false as const, error: 'Informe um valor.' }
  }

  if (definition.type === 'number') {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      return { ok: false as const, error: 'Informe um número inteiro válido.' }
    }
    if (typeof definition.min === 'number' && parsed < definition.min) {
      return { ok: false as const, error: `O valor mínimo é ${definition.min}.` }
    }
    if (typeof definition.max === 'number' && parsed > definition.max) {
      return { ok: false as const, error: `O valor máximo é ${definition.max}.` }
    }
    return { ok: true as const, value: String(parsed), definition }
  }

  if (definition.type === 'boolean') {
    if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
      return { ok: false as const, error: 'Informe true ou false.' }
    }
    const normalized = ['true', '1'].includes(value.toLowerCase()) ? 'true' : 'false'
    return { ok: true as const, value: normalized, definition }
  }

  return { ok: true as const, value, definition }
}

export async function listAppSettingsForAdmin() {
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('key, value, description, updated_at, updated_by')

  if (error && error.code !== '42P01' && !String(error.message || '').includes('app_settings')) {
    throw error
  }

  const rows = data || []
  const byKey = new Map(rows.map((row) => [row.key, row]))

  return APP_SETTING_DEFINITIONS.map((definition) => {
    const row = byKey.get(definition.key)
    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      group: definition.group,
      type: definition.type,
      min: definition.min ?? null,
      max: definition.max ?? null,
      defaultValue: definition.defaultValue,
      value: row?.value ?? definition.defaultValue,
      stored: Boolean(row),
      updatedAt: row?.updated_at || null,
      updatedBy: row?.updated_by || null,
    }
  })
}

export async function upsertAppSetting(input: {
  key: string
  value: string
  updatedBy?: string | null
}) {
  const validation = validateAppSettingValue(input.key, input.value)
  if (!validation.ok) {
    throw new Error(validation.error)
  }

  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .upsert(
      {
        key: input.key,
        value: validation.value,
        description: validation.definition.description,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy || null,
      },
      { onConflict: 'key' }
    )
    .select('key, value, description, updated_at, updated_by')
    .single()

  if (error) throw error
  invalidateSettingCache(input.key)
  return data
}
