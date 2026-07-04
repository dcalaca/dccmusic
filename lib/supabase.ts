import { createClient } from '@supabase/supabase-js'
import { Buffer } from 'node:buffer'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** Lê o claim `role` do JWT (anon | authenticated | service_role) sem validar assinatura */
function jwtRoleFromSupabaseKey(key: string): string | null {
  try {
    const part = key.split('.')[1]
    if (!part) return null
    const json = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
    return typeof json.role === 'string' ? json.role : null
  } catch {
    return null
  }
}

function normalizeEnvSecret(value: string | undefined): string | undefined {
  if (value == null) return undefined
  let v = value.trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim()
  }
  return v || undefined
}

// Cliente servidor: SOMENTE service role. Ela ignora RLS no Postgres do Supabase.
// Se colocar a chave ANON aqui, o Supabase trata como anon → RLS bloqueia → listagens vazias em produção.
const serviceRoleKey = normalizeEnvSecret(process.env.SUPABASE_SERVICE_ROLE_KEY)

if (!serviceRoleKey) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente. Copie a chave service_role em Supabase → Project Settings → API e coloque no .env.local (local) ou nas variáveis do Vercel. Sem ela o site não lê dados após ativar RLS.'
  )
}

const keyRole = jwtRoleFromSupabaseKey(serviceRoleKey)
if (keyRole === 'anon') {
  console.error(
    '[SUPABASE] SUPABASE_SERVICE_ROLE_KEY é a chave ANON. No Vercel use a chave secreta "service_role" (não "anon/public"). Com RLS ativo, isso deixa o site sem dados.'
  )
}
if (keyRole && keyRole !== 'service_role') {
  console.warn('[SUPABASE] Esperado role=service_role no JWT; obtido:', keyRole)
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
