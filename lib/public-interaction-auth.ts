import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import * as db from './db'
import { verifyComposerToken } from './composer-middleware'
import { verifySiteUserToken } from './site-user-auth'
import { supabaseAdmin } from './supabase'

export type PublicInteractionUser = {
  userId: string
  email: string
  name: string
  firstName: string
  source: 'site_user' | 'composer'
}

function getBearerToken(request: NextRequest | Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.substring(7)
}

async function getOrCreateSiteUserForComposer(composerId: string): Promise<PublicInteractionUser | null> {
  const { data: composer, error } = await supabaseAdmin
    .from('dccmusic_composers')
    .select('id, name, email')
    .eq('id', composerId)
    .maybeSingle()

  if (error || !composer?.email) {
    if (error) console.error('[PUBLIC_AUTH] Erro ao buscar compositor:', error)
    return null
  }

  const existing = await db.getSiteUserByEmail(composer.email)
  if (existing) {
    return {
      userId: existing.id,
      email: existing.email,
      name: existing.name,
      firstName: existing.firstName,
      source: 'composer',
    }
  }

  const passwordHash = await bcrypt.hash(randomUUID(), 10)
  const { data: siteUser, error: createError } = await supabaseAdmin
    .from('dccmusic_site_users')
    .insert({
      name: composer.name,
      email: composer.email.toLowerCase().trim(),
      password_hash: passwordHash,
      is_active: true,
    })
    .select('*')
    .single()

  if (createError) {
    if (createError.code === '23505') {
      const duplicated = await db.getSiteUserByEmail(composer.email)
      if (duplicated) {
        return {
          userId: duplicated.id,
          email: duplicated.email,
          name: duplicated.name,
          firstName: duplicated.firstName,
          source: 'composer',
        }
      }
    }
    console.error('[PUBLIC_AUTH] Erro ao criar usuário público para compositor:', createError)
    return null
  }

  return {
    userId: siteUser.id,
    email: siteUser.email,
    name: siteUser.name,
    firstName: siteUser.first_name || siteUser.name?.split(' ')[0] || 'Compositor',
    source: 'composer',
  }
}

export async function getPublicInteractionUserFromRequest(
  request: NextRequest | Request
): Promise<PublicInteractionUser | null> {
  const token = getBearerToken(request)
  if (!token) return null

  const siteUserToken = verifySiteUserToken(token)
  if (siteUserToken?.userId) {
    return {
      userId: siteUserToken.userId,
      email: siteUserToken.email,
      name: siteUserToken.name,
      firstName: siteUserToken.firstName || siteUserToken.name?.split(' ')[0] || 'Usuário',
      source: 'site_user',
    }
  }

  const composerToken = verifyComposerToken(token)
  if (composerToken?.composerId) {
    return getOrCreateSiteUserForComposer(composerToken.composerId)
  }

  return null
}
