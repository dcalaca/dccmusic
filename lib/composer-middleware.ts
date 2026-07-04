import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface ComposerToken {
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

export function requireComposerAuth(request: NextRequest | Request): ComposerToken {
  const composer = getComposerFromRequest(request)
  if (!composer) {
    throw new Error('Não autorizado')
  }
  return composer
}
