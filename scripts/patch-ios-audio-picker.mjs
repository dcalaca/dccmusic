import fs from 'node:fs'
import path from 'node:path'

const target = path.join(process.cwd(), 'app/compositores/admin/studio-ia/melhorar/musica-pronta/page.tsx')
let source = fs.readFileSync(target, 'utf8')
let changed = false

const oldAccept = 'accept="audio/*"'
const newAccept = 'accept=".mp3,.m4a,.wav,.aac,.ogg,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/aac,audio/ogg"'

if (source.includes(oldAccept)) {
  source = source.replace(oldAccept, newAccept)
  changed = true
}

const oldHelp = 'Use áudio de até 4 minutos e 30 segundos (máx. 80 MB). Pode ser demo, guia, voz e violão ou gravação do celular.'
const newHelp = 'Formatos aceitos: MP3, M4A, WAV, AAC e OGG. Até 4 minutos e 30 segundos (máx. 80 MB). Pode ser demo, guia, voz e violão ou gravação do celular.'

if (source.includes(oldHelp)) {
  source = source.replace(oldHelp, newHelp)
  changed = true
}

if (changed) {
  fs.writeFileSync(target, source, 'utf8')
  console.log('[ios-audio-picker] Campo de áudio ajustado para iPhone/iOS.')
} else if (!source.includes(newAccept)) {
  throw new Error('[ios-audio-picker] Não encontrei o campo de upload esperado em melhorar/musica-pronta.')
}
