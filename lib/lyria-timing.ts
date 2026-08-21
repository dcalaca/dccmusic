type LyricEntry = { type: 'section' | 'line'; text: string }

function formatTimestamp(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function phraseWeight(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const vowelGroups = (text.toLocaleLowerCase('pt-BR').match(/[aeiouáéíóúâêôãõàü]+/g) || []).length
  return Math.max(1, vowelGroups + words * 0.35)
}

export function buildLyriaTimedLyrics(lyrics: string, bpm: number, durationSeconds: number) {
  const entries: LyricEntry[] = lyrics.split(/\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ type: /^\[[^\]]+]$/.test(text) ? 'section' : 'line', text }))

  const lines = entries.filter((entry) => entry.type === 'line')
  if (!lines.length) return ''

  const secondsPerBeat = 60 / bpm
  const introSeconds = secondsPerBeat * 8
  const outroSeconds = secondsPerBeat * 8
  const sectionCount = entries.filter((entry) => entry.type === 'section').length
  const transitionCount = Math.max(0, sectionCount - 1)
  const transitionSeconds = secondsPerBeat * 2
  const vocalSeconds = Math.max(lines.length * secondsPerBeat, durationSeconds - introSeconds - outroSeconds - transitionCount * transitionSeconds)
  const totalWeight = lines.reduce((sum, entry) => sum + phraseWeight(entry.text), 0)
  const minimumPhraseSeconds = Math.min(secondsPerBeat, vocalSeconds / lines.length)
  const weightedSeconds = Math.max(0, vocalSeconds - minimumPhraseSeconds * lines.length)

  let cursor = introSeconds
  let seenSection = false
  const output = [`[00:00-${formatTimestamp(introSeconds)}] Instrumental intro. No vocals.`]

  for (const entry of entries) {
    if (entry.type === 'section') {
      if (seenSection) {
        const transitionEnd = cursor + transitionSeconds
        output.push(`[${formatTimestamp(cursor)}-${formatTimestamp(transitionEnd)}] Short instrumental breath. No vocals.`)
        cursor = transitionEnd
      }
      output.push(entry.text)
      seenSection = true
      continue
    }

    const share = phraseWeight(entry.text) / totalWeight
    const phraseSeconds = minimumPhraseSeconds + weightedSeconds * share
    const end = Math.min(durationSeconds - outroSeconds, cursor + phraseSeconds)
    output.push(`[${formatTimestamp(cursor)}-${formatTimestamp(end)}] ${entry.text}`)
    cursor = end
  }

  const outroStart = Math.min(durationSeconds, Math.max(cursor, durationSeconds - outroSeconds))
  output.push(`[${formatTimestamp(outroStart)}-${formatTimestamp(durationSeconds)}] Instrumental outro. No new lyrics. End naturally.`)
  return output.join('\n')
}
