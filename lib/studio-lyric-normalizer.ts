const MAX_LINE_CHARS = 55
const MIN_LINE_CHARS = 12

/** Conectivos longos primeiro para não casar "e" dentro de "enquanto". */
const CONNECTIVES = [
  'porque',
  'porém',
  'embora',
  'enquanto',
  'quando',
  'então',
  'mas',
  'ou',
  'e',
]

/** Quebra mesmo abaixo do limite (exceto "e", que só quebra se a linha estiver longa). */
const FORCE_BREAK_CONNECTIVES = [
  'porque',
  'porém',
  'embora',
  'enquanto',
  'quando',
  'então',
  'mas',
  'ou',
]

export type NormalizeStudioLyricResult = {
  lyric: string
  changed: boolean
  usedOriginal: boolean
  linesBefore: number
  linesAfter: number
}

function extractWords(text: string): string[] {
  return text.normalize('NFC').toLocaleLowerCase('pt-BR').match(/[\p{L}\p{N}]+/gu) || []
}

export function studioLyricWordsMatch(a: string, b: string): boolean {
  const left = extractWords(a)
  const right = extractWords(b)
  if (left.length !== right.length) return false
  return left.every((word, index) => word === right[index])
}

function countNonEmptyLines(text: string): number {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length
}

function isSectionTag(line: string): boolean {
  return /^\[[^\]]+\]$/.test(line.trim())
}

function normalizeSpaces(value: string): string {
  return value.replace(/[ \t]+/g, ' ').trim()
}

function splitByPunctuation(line: string): string[] {
  const parts = line.split(/(?<=[,.;:!?…])\s+/)
  return parts.map(normalizeSpaces).filter(Boolean)
}

function findConnectiveBreak(text: string, options?: { force?: boolean }): number {
  const lower = text.toLocaleLowerCase('pt-BR')
  const list = options?.force ? FORCE_BREAK_CONNECTIVES : CONNECTIVES
  let bestIndex = -1
  let bestLength = 0

  for (const connective of list) {
    const pattern = new RegExp(`(^|\\s)(${connective})(\\s|$)`, 'gi')
    let match: RegExpExecArray | null
    while ((match = pattern.exec(lower)) !== null) {
      const start = match.index + (match[1] ? match[1].length : 0)
      if (start <= 0) continue
      const leftLen = normalizeSpaces(text.slice(0, start)).length
      const rightLen = normalizeSpaces(text.slice(start)).length
      if (leftLen < 8 || rightLen < 8) continue

      if (options?.force) {
        // Na quebra forçada, pega a primeira ocorrência válida da esquerda para a direita.
        if (bestIndex < 0 || start < bestIndex) {
          bestIndex = start
          bestLength = connective.length
        }
        continue
      }

      if (start >= Math.floor(text.length * 0.35) && connective.length >= bestLength) {
        bestIndex = start
        bestLength = connective.length
      } else if (bestIndex < 0) {
        bestIndex = start
        bestLength = connective.length
      }
    }
  }

  return bestIndex
}

function splitByConnectives(segment: string): string[] {
  const text = normalizeSpaces(segment)
  if (!text) return []

  const needsHardSplit = text.length > MAX_LINE_CHARS
  const forceIndex = findConnectiveBreak(text, { force: true })
  const hardIndex = needsHardSplit ? findConnectiveBreak(text) : -1
  const bestIndex = needsHardSplit ? (hardIndex >= 0 ? hardIndex : forceIndex) : forceIndex

  if (bestIndex <= 0) {
    return needsHardSplit ? softWrapByWords(text) : [text]
  }

  const left = normalizeSpaces(text.slice(0, bestIndex))
  const right = normalizeSpaces(text.slice(bestIndex))
  if (!left || !right) {
    return needsHardSplit ? softWrapByWords(text) : [text]
  }

  return [...splitByConnectives(left), ...splitByConnectives(right)]
}

function softWrapByWords(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= 1) return [text]

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (current && next.length > MAX_LINE_CHARS) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }

  if (current) lines.push(current)
  return lines
}

function splitLongLine(line: string): string[] {
  const trimmed = normalizeSpaces(line)
  if (!trimmed) return []
  if (isSectionTag(trimmed)) return [trimmed]

  const byPunctuation = trimmed.length > MAX_LINE_CHARS || /[,.;:!?…]/.test(trimmed)
    ? splitByPunctuation(trimmed)
    : [trimmed]

  const expanded = byPunctuation.flatMap((part) => splitByConnectives(part))

  return expanded.flatMap((part) => {
    if (part.length <= MAX_LINE_CHARS) return [part]
    return softWrapByWords(part)
  })
}

function endsWithSentencePunct(line: string): boolean {
  return /[.!?…]"?$/.test(line.trim())
}

function isConnectiveOnlyLine(line: string): boolean {
  const normalized = normalizeSpaces(line).replace(/[,.;:!?…]+$/g, '').toLocaleLowerCase('pt-BR')
  return FORCE_BREAK_CONNECTIVES.includes(normalized) || normalized === 'e'
}

function mergeTinyLines(lines: string[]): string[] {
  const result: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line) {
      if (result.length > 0 && result[result.length - 1] !== '') result.push('')
      continue
    }

    const previous = result[result.length - 1]
    const next = lines[index + 1]
    const preferMergeNext =
      isConnectiveOnlyLine(line) &&
      typeof next === 'string' &&
      next &&
      !isSectionTag(next) &&
      `${line} ${next}`.length <= MAX_LINE_CHARS + 10

    if (preferMergeNext) {
      lines[index + 1] = `${line} ${next}`
      continue
    }

    const canMerge =
      result.length > 0 &&
      previous !== '' &&
      !isSectionTag(line) &&
      !isSectionTag(previous) &&
      !endsWithSentencePunct(previous) &&
      !isConnectiveOnlyLine(line) &&
      line.length < MIN_LINE_CHARS &&
      `${previous} ${line}`.length <= MAX_LINE_CHARS + 10

    if (canMerge) {
      result[result.length - 1] = `${previous} ${line}`
      continue
    }

    result.push(line)
  }

  // Remove linhas em branco duplicadas no fim/meio.
  return result
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '')
    .split('\n')
}

function normalizeParagraph(paragraph: string): string[] {
  const rawLines = paragraph
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (rawLines.length === 0) return []

  const splitLines = rawLines.flatMap((line) => splitLongLine(line))
  return mergeTinyLines(splitLines)
}

/**
 * Reorganiza só a estrutura (quebras de linha / espaçamento).
 * Não altera palavras do compositor. Se a validação falhar, devolve o original.
 */
export function normalizeStudioLyricStructure(input: string): NormalizeStudioLyricResult {
  const original = String(input || '').replace(/\r\n/g, '\n').trim()
  const linesBefore = countNonEmptyLines(original)

  if (!original) {
    return {
      lyric: original,
      changed: false,
      usedOriginal: true,
      linesBefore,
      linesAfter: 0,
    }
  }

  const paragraphs = original
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)

  const normalizedParagraphs = paragraphs.map((paragraph) => normalizeParagraph(paragraph).join('\n'))
  const normalized = normalizedParagraphs.join('\n\n').trim()

  if (!studioLyricWordsMatch(original, normalized)) {
    return {
      lyric: original,
      changed: false,
      usedOriginal: true,
      linesBefore,
      linesAfter: linesBefore,
    }
  }

  const changed = normalized !== original
  return {
    lyric: changed ? normalized : original,
    changed,
    usedOriginal: !changed,
    linesBefore,
    linesAfter: countNonEmptyLines(changed ? normalized : original),
  }
}
