import { XMLParser } from 'fast-xml-parser'

type XmlNode = Record<string, any>

type TimedChord = {
  time: number
  measure: string
  chord: string
}

type LyricWord = {
  time: number
  measure: string
  text: string
  chords: string[]
}

export type MusicXmlChordPreview = {
  title: string
  key: string | null
  bpm: string | null
  preview: string
  stats: {
    words: number
    chords: number
    vocalPart: string
    chordsPart: string
    introChords: number
  }
  warnings: string[]
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '#text',
  preserveOrder: true,
  trimValues: true,
})

function nodeName(node: XmlNode) {
  return Object.keys(node).find((key) => key !== ':@') || ''
}

function nodeAttrs(node: XmlNode) {
  return node[':@'] || {}
}

function nodeChildren(node: XmlNode) {
  const name = nodeName(node)
  const children = node[name]
  return Array.isArray(children) ? children : []
}

function childNodes(node: XmlNode, name: string) {
  return nodeChildren(node).filter((child: XmlNode) => nodeName(child) === name)
}

function firstChild(node: XmlNode, name: string) {
  return childNodes(node, name)[0] || null
}

function textContent(input: any): string {
  if (input == null) return ''
  if (typeof input === 'string' || typeof input === 'number') return String(input)
  if (Array.isArray(input)) return input.map(textContent).join('')
  if (typeof input === 'object') {
    if (input['#text'] != null) return String(input['#text'])
    return nodeChildren(input).map(textContent).join('')
  }
  return ''
}

function childText(node: XmlNode, name: string) {
  const child = firstChild(node, name)
  return child ? textContent(child).trim() : ''
}

function numberText(node: XmlNode, name: string, fallback = 0) {
  const value = Number(childText(node, name))
  return Number.isFinite(value) ? value : fallback
}

function descendants(node: XmlNode, name: string): XmlNode[] {
  const found: XmlNode[] = []
  for (const child of nodeChildren(node)) {
    if (nodeName(child) === name) found.push(child)
    found.push(...descendants(child, name))
  }
  return found
}

function getScoreRoot(parsed: any) {
  const nodes = Array.isArray(parsed) ? parsed : [parsed]
  return nodes.find((node: XmlNode) => nodeName(node) === 'score-partwise' || nodeName(node) === 'score-timewise') || null
}

function extractPartInfo(root: XmlNode) {
  const partList = firstChild(root, 'part-list')
  const scoreParts = partList ? descendants(partList, 'score-part') : []
  const names = new Map<string, string>()

  for (const scorePart of scoreParts) {
    const id = nodeAttrs(scorePart).id
    if (!id) continue
    names.set(id, childText(scorePart, 'part-name'))
  }

  return childNodes(root, 'part').map((part) => ({
    id: nodeAttrs(part).id || '',
    name: names.get(nodeAttrs(part).id || '') || '',
    node: part,
  }))
}

function hasDescendant(node: XmlNode, name: string) {
  return descendants(node, name).length > 0
}

function isChordSymbol(value: string) {
  const clean = value.trim()
  if (!clean || clean.length > 20) return false
  return /^[A-G](?:#|b)?(?:(?:m|maj|min|dim|aug|sus|add)?\d*(?:\([^)]{1,8}\))?|ø|°)?(?:\/[A-G](?:#|b)?)?$/i.test(clean)
}

function pickPart(parts: ReturnType<typeof extractPartInfo>, kind: 'vocal' | 'chords') {
  if (kind === 'vocal') {
    return parts.find((part) => /vocal|voice|melody|lead/i.test(part.name)) ||
      parts.find((part) => hasDescendant(part.node, 'lyric')) ||
      parts[0] ||
      null
  }

  return parts.find((part) => /chord|harmony|cifra/i.test(part.name)) ||
    parts.find((part) => hasDescendant(part.node, 'harmony')) ||
    parts.find((part) => descendants(part.node, 'words').some((word) => isChordSymbol(textContent(word).trim()))) ||
    null
}

function alterSuffix(value: string) {
  if (value === '1') return '#'
  if (value === '-1') return 'b'
  return ''
}

function chordKindLabel(kind: string) {
  const normalized = kind.toLowerCase()
  const map: Record<string, string> = {
    major: '',
    minor: 'm',
    diminished: 'dim',
    augmented: 'aug',
    dominant: '7',
    'major-seventh': 'maj7',
    'minor-seventh': 'm7',
    'half-diminished': 'm7(b5)',
    suspended: 'sus',
  }
  return map[normalized] ?? kind.replace(/\s+/g, '')
}

function harmonyToChord(harmony: XmlNode) {
  const root = firstChild(harmony, 'root')
  if (!root) return null
  const rootStep = childText(root, 'root-step')
  if (!rootStep) return null

  const kind = childText(harmony, 'kind')
  const bass = firstChild(harmony, 'bass')
  const bassStep = bass ? childText(bass, 'bass-step') : ''
  const bassSuffix = bassStep ? `/${bassStep}${alterSuffix(bass ? childText(bass, 'bass-alter') : '')}` : ''

  return `${rootStep}${alterSuffix(childText(root, 'root-alter'))}${chordKindLabel(kind)}${bassSuffix}`
}

function getDivisions(attributes: XmlNode, current: number) {
  const value = numberText(attributes, 'divisions', current)
  return value > 0 ? value : current
}

function durationQuarters(node: XmlNode, divisions: number) {
  const duration = numberText(node, 'duration', 0)
  return divisions > 0 ? duration / divisions : duration
}

function offsetQuarters(node: XmlNode, divisions: number) {
  const offset = numberText(node, 'offset', 0)
  return divisions > 0 ? offset / divisions : offset
}

function extractTempo(root: XmlNode) {
  for (const sound of descendants(root, 'sound')) {
    const tempo = nodeAttrs(sound).tempo
    if (tempo) return String(Math.round(Number(tempo) || Number(tempo)))
  }
  return null
}

function keyFromFifths(fifthsText: string, mode: string) {
  const fifths = Number(fifthsText)
  if (!Number.isFinite(fifths)) return null
  const major: Record<number, string> = {
    '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F',
    0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#',
  }
  const minor: Record<number, string> = {
    '-7': 'Abm', '-6': 'Ebm', '-5': 'Bbm', '-4': 'Fm', '-3': 'Cm', '-2': 'Gm', '-1': 'Dm',
    0: 'Am', 1: 'Em', 2: 'Bm', 3: 'F#m', 4: 'C#m', 5: 'G#m', 6: 'D#m', 7: 'A#m',
  }
  return mode.toLowerCase() === 'minor' ? minor[fifths] || null : major[fifths] || null
}

function extractKey(root: XmlNode) {
  for (const key of descendants(root, 'key')) {
    const fifths = childText(key, 'fifths')
    if (!fifths) continue
    return keyFromFifths(fifths, childText(key, 'mode'))
  }
  return null
}

function extractMeasureEvents(part: XmlNode, mode: 'lyrics' | 'chords') {
  const events: { lyrics: Array<{ time: number; measure: string; text: string; syllabic: string }>; chords: TimedChord[] } = {
    lyrics: [],
    chords: [],
  }
  let divisions = 1
  let measureStart = 0

  for (const measure of childNodes(part, 'measure')) {
    const measureNumber = String(nodeAttrs(measure).number || '')
    let cursor = measureStart
    let measureEnd = measureStart
    let lastNoteStart = cursor

    for (const child of nodeChildren(measure)) {
      const name = nodeName(child)

      if (name === 'attributes') {
        divisions = getDivisions(child, divisions)
        continue
      }

      if (name === 'backup') {
        cursor -= durationQuarters(child, divisions)
        continue
      }

      if (name === 'forward') {
        cursor += durationQuarters(child, divisions)
        measureEnd = Math.max(measureEnd, cursor)
        continue
      }

      if (name === 'harmony' && mode === 'chords') {
        const chord = harmonyToChord(child)
        if (chord) events.chords.push({ time: cursor + offsetQuarters(child, divisions), measure: measureNumber, chord })
        continue
      }

      if (name === 'direction' && mode === 'chords') {
        const directionTime = cursor + offsetQuarters(child, divisions)
        for (const word of descendants(child, 'words')) {
          const chord = textContent(word).trim()
          if (isChordSymbol(chord)) events.chords.push({ time: directionTime, measure: measureNumber, chord })
        }
        continue
      }

      if (name === 'note') {
        const isChordNote = childNodes(child, 'chord').length > 0
        const noteStart = isChordNote ? lastNoteStart : cursor

        if (mode === 'lyrics') {
          for (const lyric of childNodes(child, 'lyric')) {
            const text = childText(lyric, 'text')
            if (text) {
              events.lyrics.push({
                time: noteStart,
                measure: measureNumber,
                text,
                syllabic: childText(lyric, 'syllabic') || 'single',
              })
            }
          }
        }

        if (!isChordNote) {
          lastNoteStart = noteStart
          cursor += durationQuarters(child, divisions)
          measureEnd = Math.max(measureEnd, cursor)
        }
      }
    }

    measureStart = measureEnd > measureStart ? measureEnd : cursor
  }

  return events
}

function combineLyricWords(syllables: Array<{ time: number; measure: string; text: string; syllabic: string }>) {
  const words: LyricWord[] = []
  let pending: LyricWord | null = null

  for (const syllable of syllables.sort((a, b) => a.time - b.time)) {
    const text = syllable.text.trim()
    if (!text) continue
    const syllabic = syllable.syllabic.toLowerCase()

    if (syllabic === 'begin') {
      if (pending) words.push(pending)
      pending = { time: syllable.time, measure: syllable.measure, text, chords: [] }
    } else if (syllabic === 'middle') {
      if (pending) pending.text += text
      else pending = { time: syllable.time, measure: syllable.measure, text, chords: [] }
    } else if (syllabic === 'end') {
      if (pending) {
        pending.text += text
        words.push(pending)
        pending = null
      } else {
        words.push({ time: syllable.time, measure: syllable.measure, text, chords: [] })
      }
    } else {
      if (pending) {
        words.push(pending)
        pending = null
      }
      words.push({ time: syllable.time, measure: syllable.measure, text, chords: [] })
    }
  }

  if (pending) words.push(pending)
  return words
}

function dedupeConsecutiveChords(chords: TimedChord[]) {
  const sorted = chords.sort((a, b) => a.time - b.time)
  const deduped: TimedChord[] = []
  for (const chord of sorted) {
    const previous = deduped[deduped.length - 1]
    if (previous?.chord === chord.chord) continue
    deduped.push(chord)
  }
  return deduped
}

function attachChordsToWords(chords: TimedChord[], words: LyricWord[]) {
  const introChords: string[] = []
  if (words.length === 0) return { words, introChords }

  const firstWordTime = words[0].time
  for (const chord of chords) {
    if (chord.time < firstWordTime - 0.0001) {
      if (introChords[introChords.length - 1] !== chord.chord) introChords.push(chord.chord)
      continue
    }

    const index = words.findIndex((word) => word.time >= chord.time - 0.0001)
    const target = words[index >= 0 ? index : words.length - 1]
    if (target.chords[target.chords.length - 1] !== chord.chord) target.chords.push(chord.chord)
  }

  return { words, introChords }
}

function splitWordLines(words: LyricWord[]) {
  const lines: LyricWord[][] = []
  let current: LyricWord[] = []
  let length = 0

  for (const word of words) {
    const nextLength = length + word.text.length + 1
    current.push(word)
    length = nextLength
    if (/[,.!?;:]$/.test(word.text) || length >= 58) {
      lines.push(current)
      current = []
      length = 0
    }
  }

  if (current.length > 0) lines.push(current)
  return lines
}

function renderAlignedLines(words: LyricWord[]) {
  return splitWordLines(words).map((line) => {
    const chordCells = line.map((word) => word.chords.join('/'))
    const widths = line.map((word, index) => Math.max(word.text.length, chordCells[index].length, 1))
    const chordLine = line.map((_, index) => chordCells[index].padEnd(widths[index], ' ')).join(' ')
    const lyricLine = line.map((word, index) => word.text.padEnd(widths[index], ' ')).join(' ')
    return `${chordLine.trimEnd()}\n${lyricLine.trimEnd()}`
  }).join('\n\n')
}

export function buildMusicXmlChordPreview(musicXml: string, title: string): MusicXmlChordPreview {
  const parsed = parser.parse(musicXml)
  const root = getScoreRoot(parsed)
  if (!root) throw new Error('MusicXML inválido: raiz score-partwise não encontrada.')

  const parts = extractPartInfo(root)
  const vocalPart = pickPart(parts, 'vocal')
  const chordsPart = pickPart(parts, 'chords') || vocalPart

  if (!vocalPart) throw new Error('Não encontrei parte Vocal com letra no MusicXML.')
  if (!chordsPart) throw new Error('Não encontrei parte Chords no MusicXML.')

  const lyricEvents = extractMeasureEvents(vocalPart.node, 'lyrics').lyrics
  const chordEvents = extractMeasureEvents(chordsPart.node, 'chords').chords
  const words = combineLyricWords(lyricEvents)
  const chords = dedupeConsecutiveChords(chordEvents)
  const attached = attachChordsToWords(chords, words)
  const intro = attached.introChords.length > 0 ? `Intro:\n${attached.introChords.join('  ')}\n\n` : ''
  const body = `${intro}${renderAlignedLines(attached.words)}`
  const key = extractKey(root)
  const tempo = extractTempo(root)
  const warnings: string[] = []

  if (words.length === 0) warnings.push('Não encontrei letras na parte Vocal.')
  if (chords.length === 0) warnings.push('Não encontrei acordes na parte Chords.')

  return {
    title,
    key,
    bpm: tempo,
    preview: [
      `Título: ${title}`,
      key ? `Tom: ${key}` : null,
      tempo ? `BPM: ${tempo}` : null,
      '',
      body || 'Prévia não disponível.',
    ].filter((line) => line !== null).join('\n'),
    stats: {
      words: words.length,
      chords: chords.length,
      vocalPart: vocalPart.name || vocalPart.id,
      chordsPart: chordsPart.name || chordsPart.id,
      introChords: attached.introChords.length,
    },
    warnings,
  }
}
