import fs from 'node:fs'
import path from 'node:path'

const target = path.join(process.cwd(), 'app/compositores/admin/studio-ia/melhorar/musica-pronta/page.tsx')
let source = fs.readFileSync(target, 'utf8')

if (source.includes('data-feature="enhance-compact-layout"')) {
  console.log('[enhance-layout] Layout compacto já aplicado.')
  process.exit(0)
}

// 1) Deixa o nome da música em largura total depois de mover o gênero.
source = source.replace(
  '<div className="grid gap-4 sm:grid-cols-2">\n              <label className="block">\n                <span className="mb-2 block text-sm font-bold text-gray-300">Nome da música</span>',
  '<div className="grid gap-4">\n              <label className="block">\n                <span className="mb-2 block text-sm font-bold text-gray-300">Nome da música</span>'
)

// 2) Move o seletor de gênero para depois de "O que você quer melhorar?".
const genreText = 'Gênero/ritmo desejado'
const genreTextIndex = source.indexOf(genreText)
if (genreTextIndex === -1) throw new Error('[enhance-layout] Não encontrei o seletor de gênero.')

const genreStart = source.lastIndexOf('              <label className="block">', genreTextIndex)
const genreEnd = source.indexOf('              </label>', genreTextIndex)
if (genreStart === -1 || genreEnd === -1) throw new Error('[enhance-layout] Não consegui delimitar o seletor de gênero.')

const genreBlock = source.slice(genreStart, genreEnd + '              </label>\n'.length)
source = source.slice(0, genreStart) + source.slice(genreEnd + '              </label>\n'.length)

const instructionsAnchor = '            <div className="mt-5 rounded-2xl border border-gray-800 bg-black/20 p-4">\n              <p className="mb-2 text-sm font-bold text-gray-200">Instruções adicionais'
const instructionsIndex = source.indexOf(instructionsAnchor)
if (instructionsIndex === -1) throw new Error('[enhance-layout] Não encontrei o início das opções adicionais.')

const genreSection = `            <div className="mt-5 rounded-2xl border border-purple-800/50 bg-purple-950/15 p-4">\n              <div className="mb-3">\n                <p className="text-sm font-black text-white">Gênero e ritmo</p>\n                <p className="mt-1 text-xs text-gray-400">Escolha só se quiser mudar o estilo da música.</p>\n              </div>\n${genreBlock}            </div>\n\n`
source = source.slice(0, instructionsIndex) + genreSection + source.slice(instructionsIndex)

// 3) Move a voz cadastrada para as escolhas principais, antes das opções avançadas.
const customVoiceMarker = 'data-feature="custom-voice-enhance:ui"'
const customVoiceMarkerIndex = source.indexOf(customVoiceMarker)
let customVoiceBlock = ''
if (customVoiceMarkerIndex !== -1) {
  const customVoiceStart = source.lastIndexOf('              <div className="mt-5', customVoiceMarkerIndex)
  const nextStyleHeading = source.indexOf('              <p className="mb-3 mt-5 text-sm font-bold text-gray-300">Estilo da voz</p>', customVoiceMarkerIndex)
  if (customVoiceStart !== -1 && nextStyleHeading !== -1) {
    customVoiceBlock = source.slice(customVoiceStart, nextStyleHeading)
    source = source.slice(0, customVoiceStart) + source.slice(nextStyleHeading)
  }
}

const movedInstructionsIndex = source.indexOf(instructionsAnchor)
if (movedInstructionsIndex === -1) throw new Error('[enhance-layout] Âncora das opções avançadas desapareceu.')

if (customVoiceBlock) {
  const voiceSection = `            <div className="mt-5">\n              <div className="mb-2 flex items-center justify-between gap-3">\n                <div>\n                  <p className="text-sm font-black text-white">Voz cadastrada</p>\n                  <p className="mt-1 text-xs text-gray-400">Opcional. Use sua voz clonada junto com o gênero escolhido.</p>\n                </div>\n              </div>\n${customVoiceBlock}            </div>\n\n`
  source = source.slice(0, movedInstructionsIndex) + voiceSection + source.slice(movedInstructionsIndex)
}

// 4) Coloca as configurações secundárias dentro de um bloco recolhível.
const advancedStartIndex = source.indexOf(instructionsAnchor)
if (advancedStartIndex === -1) throw new Error('[enhance-layout] Não encontrei onde abrir as opções avançadas.')

const advancedOpen = `            <details data-feature="enhance-compact-layout" className="group mt-5 rounded-2xl border border-gray-800 bg-black/20">\n              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm font-black text-white [&::-webkit-details-marker]:hidden">\n                <span>Mais opções de personalização</span>\n                <span className="text-xs font-semibold text-primary-300 group-open:hidden">Mostrar</span>\n                <span className="hidden text-xs font-semibold text-primary-300 group-open:inline">Esconder</span>\n              </summary>\n              <div className="border-t border-gray-800 px-4 pb-4">\n`
source = source.slice(0, advancedStartIndex) + advancedOpen + source.slice(advancedStartIndex)

const lyricAnchor = '            <div className="mt-5">\n              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">\n                <span className="text-sm font-bold text-gray-300">Letra da música'
const lyricIndex = source.indexOf(lyricAnchor, advancedStartIndex + advancedOpen.length)
if (lyricIndex === -1) throw new Error('[enhance-layout] Não encontrei a seção da letra para fechar as opções avançadas.')

const advancedClose = '              </div>\n            </details>\n\n'
source = source.slice(0, lyricIndex) + advancedClose + source.slice(lyricIndex)

// 5) Compacta um pouco a letra sem perder espaço útil de edição.
source = source.replace('                rows={8}\n', '                rows={5}\n')

fs.writeFileSync(target, source, 'utf8')
console.log('[enhance-layout] Página de melhoria reorganizada e compactada.')
