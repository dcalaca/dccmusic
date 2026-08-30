type ScoreInput = {
  title: string
  composerName?: string | null
  lyrics: string
  bpm?: number | null
}

type ScoreResult = {
  bpm: number
  key: string
  musicXml: string
  preview: string
}

const PROGRESSION = [
  ['C', 'G', 'Am', 'F'],
  ['C', 'Am', 'F', 'G'],
  ['Am', 'F', 'C', 'G'],
]

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function cleanLines(lyrics: string) {
  return lyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\[[^\]]+\]$/.test(line))
    .slice(0, 96)
}

function stableProgression(title: string) {
  const seed = [...title].reduce((sum, char) => sum + char.codePointAt(0)!, 0)
  return PROGRESSION[seed % PROGRESSION.length]
}

function chordXml(chord: string) {
  const root = chord.replace('m', '')
  return `<harmony><root><root-step>${root}</root-step></root><kind>${chord.endsWith('m') ? 'minor' : 'major'}</kind></harmony>`
}

function noteXml(word: string, index: number) {
  const scale = ['C', 'D', 'E', 'G', 'A', 'G', 'E', 'D']
  const step = scale[index % scale.length]
  const octave = index % 8 === 4 ? 5 : 4
  return `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>1</duration><type>quarter</type><lyric><text>${escapeXml(word)}</text></lyric></note>`
}

/**
 * Primeira versão do arranjador DCC: cria uma guia cantável e uma cifra limpa
 * a partir da letra já estruturada. Ele não anuncia transcrição instrumental
 * completa; o áudio continua sendo a referência para a revisão posterior.
 */
export function buildDccSimplifiedScore(input: ScoreInput): ScoreResult {
  const bpm = Math.min(120, Math.max(90, Math.round(Number(input.bpm) || 100)))
  const lines = cleanLines(input.lyrics)
  if (!lines.length) throw new Error('Não encontrei letra suficiente para montar a cifra.')

  const progression = stableProgression(input.title)
  let measureNumber = 0
  const measures = lines.flatMap((line, lineIndex) => {
    const words = line.split(/\s+/).filter(Boolean).slice(0, 12)
    const chunks = Array.from({ length: Math.ceil(words.length / 4) }, (_, index) => words.slice(index * 4, index * 4 + 4))
    return chunks.map((wordsInMeasure, chunkIndex) => {
      measureNumber += 1
      const chord = progression[(lineIndex + chunkIndex) % progression.length]
      const notes = wordsInMeasure.map((word, wordIndex) => noteXml(word, lineIndex + chunkIndex + wordIndex)).join('')
      const padding = Array.from({ length: 4 - wordsInMeasure.length }, () => '<note><rest/><duration>1</duration><type>quarter</type></note>').join('')
      const attributes = measureNumber === 1
        ? `<attributes><divisions>1</divisions><key><fifths>0</fifths><mode>major</mode></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>`
        : ''
      return `<measure number="${measureNumber}">${attributes}${chordXml(chord)}${notes}${padding}</measure>`
    })
  }).join('')

  const musicXml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n<score-partwise version="4.0"><work><work-title>${escapeXml(input.title)}</work-title></work><identification><creator type="composer">${escapeXml(input.composerName?.trim() || 'DCC Music')}</creator></identification><part-list><score-part id="P1"><part-name>Cifra</part-name></score-part></part-list><part id="P1">${measures}</part></score-partwise>`
  const previewLines = lines.map((line, index) => `${progression[index % progression.length]}\n${line}`)
  const preview = [
    `Música: ${input.title}`,
    `Compositor: ${input.composerName?.trim() || 'DCC Music'}`,
    `Tom: C`,
    `BPM: ${bpm}`,
    '',
    ...previewLines,
  ].join('\n')
  return { bpm, key: 'C', musicXml, preview }
}
