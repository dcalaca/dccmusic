import fs from 'node:fs'
import path from 'node:path'

const target = path.join(process.cwd(), 'app/api/compositores/studio/music/route.ts')
let source = fs.readFileSync(target, 'utf8')
let changed = false

const oldHighVoice = "  if (descriptionText.includes('voz aguda')) parts.push('high voice')"
const newHighVoice = `  if (descriptionText.includes('voz aguda')) {
    if (wantsMale) {
      parts.push(
        'male high tenor vocal',
        'bright upper register',
        'light vocal weight',
        'gentle controlled delivery',
        'comfortable high register',
        'avoid baritone or bass vocal tone',
        'avoid dark heavy male voice'
      )
    } else if (wantsFemale) {
      parts.push(
        'high female vocal',
        'bright upper register',
        'light vocal weight',
        'comfortable high register',
        'avoid low contralto tone'
      )
    } else {
      parts.push('high vocal register', 'bright upper register', 'light vocal weight')
    }
  }`

if (source.includes(oldHighVoice)) {
  source = source.replace(oldHighVoice, newHighVoice)
  changed = true
} else if (!source.includes("'male high tenor vocal'")) {
  throw new Error('[voice-prompt] Não encontrei o trecho de voz aguda esperado em music/route.ts')
}

const oldTonyMatch = "  if (voiceName === 'voz que encanta') {"
const newTonyMatch = "  if (voiceName.startsWith('voz que encanta')) {"

if (source.includes(oldTonyMatch)) {
  source = source.replace(oldTonyMatch, newTonyMatch)
  changed = true
} else if (!source.includes(newTonyMatch)) {
  throw new Error('[voice-prompt] Não encontrei o perfil Voz que Encanta esperado em music/route.ts')
}

if (changed) {
  fs.writeFileSync(target, source, 'utf8')
  console.log('[voice-prompt] Direção vocal aguda reforçada com sucesso.')
} else {
  console.log('[voice-prompt] Ajuste vocal já aplicado; nenhuma alteração necessária.')
}
