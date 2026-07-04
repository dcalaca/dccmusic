import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import * as db from './db'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface SiteUserToken {
  userId: string
  email: string
  name: string
  firstName: string
  requiresPasswordChange?: boolean
}

export async function registerSiteUser(
  name: string,
  email: string,
  password: string
): Promise<{ user: db.SiteUser; token: string }> {
  // Validar dados
  if (!name || !name.trim()) {
    throw new Error('Nome é obrigatório')
  }
  if (!email || !email.trim()) {
    throw new Error('Email é obrigatório')
  }
  if (!password || password.length < 6) {
    throw new Error('Senha deve ter pelo menos 6 caracteres')
  }

  // Verificar se email já existe
  const existing = await db.getSiteUserByEmail(email)
  if (existing) {
    throw new Error('Email já cadastrado')
  }

  // Hash da senha
  const passwordHash = await bcrypt.hash(password, 10)

  // Criar usuário
  const user = await db.createSiteUser(name.trim(), email.toLowerCase().trim(), passwordHash)

  // Gerar token JWT
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  )

  return { user, token }
}

export async function loginSiteUser(
  email: string,
  password: string
): Promise<{ user: db.SiteUser; token: string; requiresPasswordChange?: boolean }> {
  if (!email || !password) {
    throw new Error('Email e senha são obrigatórios')
  }

  // Buscar usuário
  const user = await db.getSiteUserByEmail(email)
  if (!user) {
    throw new Error('Email ou senha incorretos')
  }

  // Buscar hash da senha do banco
  const { data: userData, error } = await (await import('./supabase')).supabaseAdmin
    .from('dccmusic_site_users')
    .select('password_hash')
    .eq('id', user.id)
    .single()

  if (error || !userData) {
    throw new Error('Erro ao buscar dados do usuário')
  }

  // Verificar senha
  const isValid = await bcrypt.compare(password, userData.password_hash)
  if (!isValid) {
    throw new Error('Email ou senha incorretos')
  }

  // Verificar se a senha digitada é "123" (senha temporária)
  // Como cada hash bcrypt é único, verificamos diretamente a senha digitada
  const isTempPassword = password === '123'

  // Gerar token JWT
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      requiresPasswordChange: isTempPassword,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  )

  return { user, token, requiresPasswordChange: isTempPassword }
}

// Resetar senha do usuário para "123"
export async function resetUserPassword(userId: string): Promise<void> {
  // Gerar hash da senha "123" (cada hash é único, mas todos são válidos para "123")
  const TEMP_PASSWORD_HASH = await bcrypt.hash('123', 10)
  
  const { error } = await (await import('./supabase')).supabaseAdmin
    .from('dccmusic_site_users')
    .update({ password_hash: TEMP_PASSWORD_HASH })
    .eq('id', userId)

  if (error) {
    throw new Error('Erro ao resetar senha')
  }
}

// Atualizar senha do usuário
export async function updateUserPassword(
  userId: string,
  newPassword: string
): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Senha deve ter pelo menos 6 caracteres')
  }

  // Hash da nova senha
  const passwordHash = await bcrypt.hash(newPassword, 10)

  const { error } = await (await import('./supabase')).supabaseAdmin
    .from('dccmusic_site_users')
    .update({ password_hash: passwordHash })
    .eq('id', userId)

  if (error) {
    throw new Error('Erro ao atualizar senha')
  }
}

export function verifySiteUserToken(token: string): SiteUserToken | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SiteUserToken
    return decoded
  } catch (error) {
    return null
  }
}

export function getSiteUserFromRequest(request: Request): SiteUserToken | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  return verifySiteUserToken(token)
}
