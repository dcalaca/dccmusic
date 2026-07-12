import { levenshteinDistance } from '@/lib/normalize'

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const DOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,24}$/

const COMMON_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'outlook.com.br',
  'live.com',
  'live.com.br',
  'yahoo.com',
  'yahoo.com.br',
  'icloud.com',
  'bol.com.br',
  'uol.com.br',
  'terra.com.br',
  'ig.com.br',
  'globo.com',
  'globomail.com',
  'proton.me',
  'protonmail.com',
  'msn.com',
  'me.com',
]

const TYPO_DOMAIN_FIXES: Record<string, string> = {
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmail.comcom': 'gmail.com',
  'hotmsil.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotamil.com': 'hotmail.com',
  'hotnail.com': 'hotmail.com',
  'oitlook.com': 'outlook.com',
  'oitlook.com.br': 'outlook.com.br',
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.combr': 'outlook.com.br',
  'outllook.com': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahho.com': 'yahoo.com',
  'iclod.com': 'icloud.com',
  'icloud.con': 'icloud.com',
  'live.con': 'live.com',
  'live.combr': 'live.com.br',
}

export type SignupEmailValidationResult =
  | { valid: true; email: string }
  | { valid: false; error: string; suggestion?: string }

function splitEmail(email: string) {
  const atIndex = email.lastIndexOf('@')
  if (atIndex <= 0 || atIndex === email.length - 1) return null
  return {
    local: email.slice(0, atIndex),
    domain: email.slice(atIndex + 1).toLowerCase(),
  }
}

function stripTrailingDigitsFromDomain(domain: string) {
  const match = domain.match(/^(.+?\.(?:com|net|org|br|me|io|co|online))(\d+)$/i)
  return match ? match[1].toLowerCase() : null
}

function findSimilarDomain(domain: string) {
  if (TYPO_DOMAIN_FIXES[domain]) {
    return TYPO_DOMAIN_FIXES[domain]
  }

  const withoutTrailingDigits = stripTrailingDigitsFromDomain(domain)
  if (withoutTrailingDigits && COMMON_DOMAINS.includes(withoutTrailingDigits)) {
    return withoutTrailingDigits
  }

  let bestMatch: string | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of COMMON_DOMAINS) {
    const distance = levenshteinDistance(domain, candidate)
    const maxDistance = candidate.length <= 8 ? 1 : 2
    if (distance > 0 && distance <= maxDistance && distance < bestDistance) {
      bestDistance = distance
      bestMatch = candidate
    }
  }

  return bestMatch
}

function buildSuggestion(local: string, domain: string) {
  return `${local}@${domain}`
}

export function validateSignupEmail(rawEmail: string): SignupEmailValidationResult {
  const email = String(rawEmail || '').trim().toLowerCase()

  if (!email) {
    return { valid: false, error: 'Informe seu e-mail.' }
  }

  if (/\s/.test(email)) {
    return { valid: false, error: 'O e-mail não pode conter espaços.' }
  }

  if (!BASIC_EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'E-mail inválido. Use o formato nome@provedor.com' }
  }

  const parts = splitEmail(email)
  if (!parts) {
    return { valid: false, error: 'E-mail inválido.' }
  }

  const { local, domain } = parts

  if (local.length > 64 || domain.length > 253) {
    return { valid: false, error: 'E-mail inválido.' }
  }

  if (!DOMAIN_REGEX.test(domain)) {
    const strippedDomain = stripTrailingDigitsFromDomain(domain)
    if (strippedDomain && COMMON_DOMAINS.includes(strippedDomain)) {
      const suggestion = buildSuggestion(local, strippedDomain)
      return {
        valid: false,
        error: `O domínio do e-mail parece incorreto. Você quis dizer ${suggestion}?`,
        suggestion,
      }
    }

    const similarDomain = findSimilarDomain(domain)
    if (similarDomain) {
      const suggestion = buildSuggestion(local, similarDomain)
      return {
        valid: false,
        error: `O domínio do e-mail parece incorreto. Você quis dizer ${suggestion}?`,
        suggestion,
      }
    }

    return {
      valid: false,
      error: 'Domínio de e-mail inválido. Verifique se digitou corretamente (ex: gmail.com, outlook.com).',
    }
  }

  const similarDomain = findSimilarDomain(domain)
  if (similarDomain && similarDomain !== domain) {
    const suggestion = buildSuggestion(local, similarDomain)
    return {
      valid: false,
      error: `Esse domínio parece ter sido digitado errado. Você quis dizer ${suggestion}?`,
      suggestion,
    }
  }

  return { valid: true, email }
}
