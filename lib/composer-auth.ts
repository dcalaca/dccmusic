import { supabaseAdmin } from './supabase'
import bcrypt from 'bcryptjs'
import * as db from './db'
import { 
  formatDisplayName,
  normalizeName, 
  namesAreSimilar, 
  namesShareKeywords, 
  findBestNameMatch,
  normalizeDuplicates,
  extractKeywords,
  wordsAreSimilar
} from './normalize'

export interface ComposerAuth {
  email: string
  password: string
  name?: string
  composerId?: string
}

// Buscar compositores similares (sem email) para o usuário escolher
export async function findSimilarComposers(composerName: string) {
  try {
    const { data: allComposers } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name, email')
    
    // Buscar compositores sem email que são similares
    const composersWithoutEmail = allComposers?.filter(c => !c.email) || []
    
    // Buscar por nome exato (normalizado)
    const exactMatches = composersWithoutEmail.filter(c => 
      namesAreSimilar(c.name, composerName)
    )
    
    // Buscar por palavras-chave similares (agora com melhor detecção de variações)
    const similarMatches = composersWithoutEmail.filter(c => {
      // Verificar se compartilham palavras-chave (incluindo variações como Matos/Mattos)
      if (namesShareKeywords(c.name, composerName)) {
        return true
      }
      
      // Verificar similaridade geral do nome completo (para casos como "Levi Matos" vs "Levi Mattos")
      const normalized1 = normalizeName(c.name)
      const normalized2 = normalizeName(composerName)
      const dedup1 = normalizeDuplicates(normalized1)
      const dedup2 = normalizeDuplicates(normalized2)
      
      // Se após normalizar duplicatas são idênticos, considerar similar
      if (dedup1 === dedup2 && dedup1.length > 0) {
        return true
      }
      
      // Verificar similaridade palavra por palavra
      const words1 = extractKeywords(c.name)
      const words2 = extractKeywords(composerName)
      
      if (words1.length === words2.length && words1.length >= 2) {
        // Se têm o mesmo número de palavras e todas são similares
        const allSimilar = words1.every((w1, i) => 
          words2.some(w2 => wordsAreSimilar(w1, w2, 0.75))
        )
        if (allSimilar) return true
      }
      
      return false
    })
    
    // Combinar e remover duplicatas
    const allMatches = [...exactMatches, ...similarMatches]
    const uniqueMatches = allMatches.filter((c, index, self) => 
      index === self.findIndex(comp => comp.id === c.id)
    )
    
    // Ordenar por relevância (exatos primeiro, depois por score)
    const scoredMatches = uniqueMatches.map(c => {
      const isExact = namesAreSimilar(c.name, composerName)
      const bestMatch = findBestNameMatch(composerName, [c])
      return {
        id: c.id,
        name: c.name,
        isExactMatch: isExact,
        similarityScore: bestMatch?.score || 0,
      }
    }).sort((a, b) => {
      // Exatos primeiro
      if (a.isExactMatch && !b.isExactMatch) return -1
      if (!a.isExactMatch && b.isExactMatch) return 1
      // Depois por score
      return b.similarityScore - a.similarityScore
    })
    
    return scoredMatches
  } catch (error: any) {
    console.error('[COMPOSER-AUTH] Erro ao buscar compositores similares:', error)
    return []
  }
}

// Associar conta a um compositor existente
export async function associateAccountToComposer(
  composerId: string,
  email: string,
  password: string,
  composerName: string
) {
  try {
    const normalizedEmail = email.toLowerCase().trim()
    const formattedComposerName = formatDisplayName(composerName)
    
    // Verificar se email já existe
    const { data: existingByEmail } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingByEmail) {
      throw new Error('Email já cadastrado. Use outro email ou faça login.')
    }
    
    // Verificar se o compositor existe e não tem email
    const { data: composer } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name, email')
      .eq('id', composerId)
      .maybeSingle()
    
    if (!composer) {
      throw new Error('Compositor não encontrado.')
    }
    
    if (composer.email) {
      throw new Error('Este compositor já possui uma conta cadastrada.')
    }
    
    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10)
    
    // Atualizar compositor
    const { data: updatedComposer, error: updateError } = await supabaseAdmin
      .from('dccmusic_composers')
      .update({
        email: normalizedEmail,
        password_hash: passwordHash,
        name: formattedComposerName,
      })
      .eq('id', composerId)
      .select()
      .single()

    if (updateError) {
      console.error('[COMPOSER-AUTH] Erro ao associar conta:', updateError)
      throw new Error('Erro ao associar conta ao compositor. Tente novamente.')
    }

    return {
      composer: db.mapComposer(updatedComposer),
      success: true,
      wasExisting: true,
      previousName: composer.name,
    }
  } catch (error: any) {
    console.error('[COMPOSER-AUTH] Erro ao associar conta:', error)
    throw error
  }
}

// Criar conta de compositor
export async function createComposerAccount(
  email: string, 
  password: string, 
  composerName: string,
  forceCreate: boolean = false,
  accountName?: string
) {
  try {
    const normalizedEmail = email.toLowerCase().trim()
    const formattedComposerName = formatDisplayName(composerName)
    const formattedAccountName = accountName?.trim() ? formatDisplayName(accountName) : ''
    const normalizedComposerName = normalizeName(formattedComposerName)
    
    console.log('[COMPOSER-AUTH] Criando conta:', { email: normalizedEmail, name: composerName, forceCreate })

    // 1. Verificar se email já existe (se sim, erro - email deve ser único)
    const { data: existingByEmail } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingByEmail) {
      throw new Error('Email já cadastrado. Use outro email ou faça login.')
    }
    
    // Se forceCreate, pular verificação de similares
    if (forceCreate) {
      console.log('[COMPOSER-AUTH] Forçando criação de novo compositor (ignorando similares)')
      // Continuar para criar novo compositor
    } else {

    // 2. Verificar se já existe compositor com nome similar (normalizado ou por palavras-chave)
    const { data: allComposers } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('id, name, email')
    
    // Verificar se existe compositor com nome exato que já tem email
    const existingWithEmail = allComposers?.find(composer => 
      namesAreSimilar(composer.name, formattedComposerName) && composer.email
    )
    
    if (existingWithEmail) {
      throw new Error(`Nome de compositor já cadastrado: "${existingWithEmail.name}". Use o mesmo nome exato ou entre em contato com o suporte.`)
    }
    
      // Buscar compositores similares sem email
      const similarComposers = await findSimilarComposers(formattedComposerName)
      
      // Se encontrou compositores similares, retornar para o usuário escolher
      if (similarComposers.length > 0) {
        return {
          requiresChoice: true,
          similarComposers: similarComposers,
        }
      }
    }

    // 4. Se não existe, criar novo compositor
    console.log('[COMPOSER-AUTH] Criando novo compositor...')
    
    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10)

    // Criar slug
    const slug = normalizedComposerName.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    // Criar compositor com email e senha
    const insertPayload: any = {
      name: formattedComposerName,
      slug: slug,
      email: normalizedEmail,
      password_hash: passwordHash,
    }

    if (formattedAccountName) {
      insertPayload.account_name = formattedAccountName
    }

    const { data, error } = await supabaseAdmin
      .from('dccmusic_composers')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      // Se já existe por slug, tentar adicionar número
      if (error.code === '23505') {
        const { data: existingSlug } = await supabaseAdmin
          .from('dccmusic_composers')
          .select('slug')
          .eq('slug', slug)
          .maybeSingle()

        if (existingSlug) {
          const newSlug = `${slug}-${Date.now()}`
          const retryPayload: any = {
            name: formattedComposerName,
            slug: newSlug,
            email: normalizedEmail,
            password_hash: passwordHash,
          }

          if (formattedAccountName) {
            retryPayload.account_name = formattedAccountName
          }

          const { data: retryData, error: retryError } = await supabaseAdmin
            .from('dccmusic_composers')
            .insert(retryPayload)
            .select()
            .single()

          if (retryError) throw retryError
          return {
            composer: db.mapComposer(retryData),
            success: true,
            wasExisting: false,
          }
        }
      }
      throw error
    }

    console.log('[COMPOSER-AUTH] Novo compositor criado com sucesso:', data.id)
    return {
      composer: db.mapComposer(data),
      success: true,
      wasExisting: false,
    }
  } catch (error: any) {
    console.error('[COMPOSER-AUTH] Erro ao criar conta de compositor:', error)
    throw error
  }
}

// Login de compositor
export async function loginComposer(email: string, password: string) {
  try {
    const normalizedEmail = email.toLowerCase().trim()
    console.log('[COMPOSER-AUTH] Tentando login para:', normalizedEmail)
    
    const { data, error } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (error) {
      console.error('[COMPOSER-AUTH] Erro ao buscar compositor:', error)
      throw new Error('Erro ao buscar compositor. Tente novamente.')
    }

    if (!data) {
      console.log('[COMPOSER-AUTH] Compositor não encontrado:', normalizedEmail)
      throw new Error('Email ou senha incorretos')
    }

    if (!data.password_hash) {
      console.error('[COMPOSER-AUTH] Compositor sem senha cadastrada:', normalizedEmail)
      throw new Error('Conta sem senha cadastrada. Entre em contato com o suporte.')
    }

    // Verificar senha
    const isValid = await bcrypt.compare(password, data.password_hash)

    if (!isValid) {
      console.log('[COMPOSER-AUTH] Senha incorreta para:', normalizedEmail)
      throw new Error('Email ou senha incorretos')
    }

    if (data.email_verified === false) {
      const error: any = new Error('Confirme seu e-mail antes de entrar. Enviamos um link de confirmação para seu endereço.')
      error.code = 'EMAIL_NOT_VERIFIED'
      error.composerId = data.id
      error.email = data.email
      error.name = data.name
      throw error
    }

    // Verificar se a senha digitada é "123" (senha temporária)
    // Como cada hash bcrypt é único, verificamos diretamente a senha digitada
    const isTempPassword = password === '123'

    console.log('[COMPOSER-AUTH] Login bem-sucedido para:', normalizedEmail)
    return {
      composer: db.mapComposer(data),
      success: true,
      requiresPasswordChange: isTempPassword,
    }
  } catch (error: any) {
    console.error('[COMPOSER-AUTH] Erro ao fazer login:', error)
    throw error
  }
}

// Resetar senha do compositor para "123"
export async function resetComposerPassword(composerId: string): Promise<void> {
  // Gerar hash da senha "123" (cada hash é único, mas todos são válidos para "123")
  const TEMP_PASSWORD_HASH = await bcrypt.hash('123', 10)
  
  const { error } = await supabaseAdmin
    .from('dccmusic_composers')
    .update({ password_hash: TEMP_PASSWORD_HASH })
    .eq('id', composerId)

  if (error) {
    throw new Error('Erro ao resetar senha')
  }
}

// Atualizar senha do compositor
export async function updateComposerPassword(
  composerId: string,
  newPassword: string
): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Senha deve ter pelo menos 6 caracteres')
  }

  // Hash da nova senha
  const passwordHash = await bcrypt.hash(newPassword, 10)

  const { error } = await supabaseAdmin
    .from('dccmusic_composers')
    .update({ password_hash: passwordHash })
    .eq('id', composerId)

  if (error) {
    throw new Error('Erro ao atualizar senha')
  }
}

// Verificar se compositor tem assinatura ativa
export async function checkComposerSubscription(composerId: string) {
  return await db.checkComposerHasActiveSubscription(composerId)
}
