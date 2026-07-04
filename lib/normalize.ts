/**
 * Funções para normalizar texto e evitar duplicatas
 */

/**
 * Remove acentos e caracteres especiais de uma string
 * Exemplo: "Douglas Calaça" -> "douglas calaca"
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD') // Decompõe caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos (acentos)
    .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, ' ') // Normaliza espaços múltiplos
    .trim()
}

/**
 * Formata nomes para exibição pública.
 * Exemplo: "val" -> "Val", "leandro borges pereira" -> "Leandro Borges Pereira".
 */
export function formatDisplayName(name: string): string {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      if (!word) return word
      const lowerWord = word.toLocaleLowerCase('pt-BR')
      if (['da', 'de', 'do', 'das', 'dos', 'e'].includes(lowerWord)) return lowerWord
      return lowerWord.charAt(0).toLocaleUpperCase('pt-BR') + lowerWord.slice(1)
    })
    .join(' ')
}

/**
 * Formata títulos de músicas para manter padrão visual premium.
 * Exemplo: "cela fria" -> "Cela Fria", "UM JARDIM PARA DEUS" -> "Um Jardim Para Deus".
 */
export function formatMusicTitle(title: string): string {
  return String(title || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[^\p{L}\p{N}])([\p{L}\p{N}])/gu, (_match, prefix: string, char: string) => {
      return `${prefix}${char.toLocaleUpperCase('pt-BR')}`
    })
}

/**
 * Normaliza duplicação de letras para comparação mais flexível
 * Exemplo: "mattos" -> "matos", "silva" -> "silva"
 */
export function normalizeDuplicates(text: string): string {
  return text.replace(/(.)\1+/g, '$1')
}

/**
 * Calcula a distância de Levenshtein entre duas strings
 * Quanto menor o número, mais similares são as strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  const matrix: number[][] = []

  // Inicializar matriz
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  // Preencher matriz
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // Deletar
          matrix[i][j - 1] + 1,     // Inserir
          matrix[i - 1][j - 1] + 1 // Substituir
        )
      }
    }
  }

  return matrix[len1][len2]
}

/**
 * Calcula similaridade entre duas palavras (0 a 1)
 * Considera distância de Levenshtein e normalização de duplicatas
 */
export function wordSimilarity(word1: string, word2: string): number {
  const normalized1 = normalizeName(word1)
  const normalized2 = normalizeName(word2)
  
  // Se são idênticas após normalização
  if (normalized1 === normalized2) {
    return 1.0
  }
  
  // Normalizar duplicatas e comparar novamente
  const dedup1 = normalizeDuplicates(normalized1)
  const dedup2 = normalizeDuplicates(normalized2)
  
  if (dedup1 === dedup2) {
    return 0.95 // Muito similar (só diferença de duplicação)
  }
  
  // Calcular distância de Levenshtein
  const maxLen = Math.max(normalized1.length, normalized2.length)
  if (maxLen === 0) return 1.0
  
  const distance = levenshteinDistance(normalized1, normalized2)
  const similarity = 1 - (distance / maxLen)
  
  // Se a distância é pequena (1-2 caracteres), considerar similar
  if (distance <= 2 && similarity >= 0.7) {
    return similarity
  }
  
  return similarity
}

/**
 * Verifica se duas palavras são similares (threshold de 0.75)
 */
export function wordsAreSimilar(word1: string, word2: string, threshold: number = 0.75): boolean {
  return wordSimilarity(word1, word2) >= threshold
}

/**
 * Compara dois nomes ignorando acentos e diferenças de capitalização
 */
export function namesAreSimilar(name1: string, name2: string): boolean {
  return normalizeName(name1) === normalizeName(name2)
}

/**
 * Extrai palavras-chave de um nome (remove palavras muito comuns)
 */
export function extractKeywords(name: string): string[] {
  const commonWords = ['da', 'de', 'do', 'das', 'dos', 'e', 'o', 'a', 'os', 'as']
  const normalized = normalizeName(name)
  const words = normalized.split(/\s+/).filter(w => w.length > 0)
  return words.filter(w => !commonWords.includes(w))
}

/**
 * Verifica se dois nomes compartilham palavras-chave significativas
 * Exemplo: "João Silva" e "João da Silva" compartilham "joão" e "silva"
 * Agora também detecta variações como "Matos" vs "Mattos"
 */
export function namesShareKeywords(name1: string, name2: string): boolean {
  const keywords1 = extractKeywords(name1)
  const keywords2 = extractKeywords(name2)
  
  if (keywords1.length === 0 || keywords2.length === 0) {
    return false
  }
  
  // Verificar matches exatos
  const exactMatches = keywords1.filter(k => keywords2.includes(k))
  
  // Verificar matches similares (com tolerância a variações)
  const similarMatches = keywords1.filter(k1 => 
    keywords2.some(k2 => wordsAreSimilar(k1, k2, 0.75))
  )
  
  // Combinar matches exatos e similares (sem duplicatas)
  const allMatches = [...new Set([...exactMatches, ...similarMatches])]
  const minKeywords = Math.min(keywords1.length, keywords2.length)
  
  // Compartilham pelo menos 2 palavras OU todas as palavras do nome menor estão no maior
  return allMatches.length >= 2 || (allMatches.length === minKeywords && minKeywords >= 1)
}

/**
 * Encontra o melhor match de nome similar baseado em palavras-chave
 * Agora usa similaridade de palavras, não apenas match exato
 */
export function findBestNameMatch(targetName: string, candidates: Array<{ name: string }>): { name: string; score: number } | null {
  const targetKeywords = extractKeywords(targetName)
  
  if (targetKeywords.length === 0) {
    return null
  }
  
  let bestMatch: { name: string; score: number } | null = null
  
  for (const candidate of candidates) {
    const candidateKeywords = extractKeywords(candidate.name)
    
    // Calcular score considerando similaridade de palavras
    let totalSimilarity = 0
    let matchedKeywords = 0
    
    for (const targetKeyword of targetKeywords) {
      // Procurar match exato primeiro
      if (candidateKeywords.includes(targetKeyword)) {
        totalSimilarity += 1.0
        matchedKeywords++
      } else {
        // Procurar match similar
        const bestWordMatch = candidateKeywords.reduce((best, candidateKeyword) => {
          const similarity = wordSimilarity(targetKeyword, candidateKeyword)
          return similarity > best ? similarity : best
        }, 0)
        
        if (bestWordMatch >= 0.75) {
          totalSimilarity += bestWordMatch
          matchedKeywords++
        }
      }
    }
    
    // Score médio de similaridade
    const score = matchedKeywords > 0 
      ? totalSimilarity / Math.max(targetKeywords.length, candidateKeywords.length)
      : 0
    
    // Se compartilham pelo menos 50% das palavras-chave (exatas ou similares), considerar match
    if (score >= 0.5 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { name: candidate.name, score }
    }
  }
  
  return bestMatch
}
