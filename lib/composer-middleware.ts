import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface ComposerToken {
  composerId: string
  email: string
  name: string
}

export type ResolvedComposer = {
  composerId: string
  email: string
  name: string
}

export function verifyComposerToken(token: string): ComposerToken | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as ComposerToken
    return decoded
  } catch (error) {
    return null
  }
}

export function getComposerFromRequest(request: NextRequest | Request): ComposerToken | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  return verifyComposerToken(token)
}

export async function resolveComposerToken(composer: ComposerToken): Promise<ResolvedComposer | null> {
  const { data: byId, error: byIdError } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id,email,name')
    .eq('id', composer.composerId)
    .maybeSingle()

  if (byIdError) throw byIdError
  if (byId) {
    return {
      composerId: String(byId.id),
      email: String(byId.email || composer.email || ''),
      name: String(byId.name || composer.name || ''),
    }
  }

  const email = String(composer.email || '').trim()
  if (!email) return null

  const { data: byEmail, error: byEmailError } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id,email,name')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  if (byEmailError) throw byEmailError
  if (!byEmail) return null

  console.warn('[COMPOSER AUTH] Token com composerId antigo; identidade resolvida por email', {
    tokenComposerId: composer.composerId,
    resolvedComposerId: byEmail.id,
  })

  return {
    composerId: String(byEmail.id),
    email: String(byEmail.email || email),
    name: String(byEmail.name || composer.name || ''),
  }
}

export function requireComposerAuth(request: NextRequest | Request): ComposerToken {
  const composer = getComposerFromRequest(request)
  if (!composer) {
    throw new Error('Não autorizado')
  }
  return composer
}
