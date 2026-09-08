import fs from 'node:fs'

function patchFile(path, replacements) {
  if (!fs.existsSync(path)) return
  let source = fs.readFileSync(path, 'utf8')
  let changed = false

  for (const [from, to] of replacements) {
    if (source.includes(to)) continue
    if (!source.includes(from)) {
      console.warn(`[patch-spain-market] trecho não encontrado em ${path}: ${from.slice(0, 80)}`)
      continue
    }
    source = source.replace(from, to)
    changed = true
  }

  if (changed) {
    fs.writeFileSync(path, source)
    console.log(`[patch-spain-market] atualizado: ${path}`)
  }
}

patchFile('app/compositores/admin/studio-ia/novo/page.tsx', [
  [
    "  'Español (México)',\n]",
    "  'Español (México)',\n  'Español (España)',\n]",
  ],
  [
    "const unitedStatesStyles = [",
    "const spainStyles = [\n  'Flamenco',\n  'Flamenco pop',\n  'Rumba flamenca',\n  'Pop español',\n  'Rock español',\n  'Indie español',\n  'Cantautor',\n  'Copla',\n  'Reggaetón',\n  'Urbano latino',\n  'Electrónica',\n  ...commonSpanishStyles,\n]\nconst unitedStatesStyles = [",
  ],
  [
    "const mexicoStyleOptions = [...mexicoStyles, customStyleOptionEs]\n",
    "const mexicoStyleOptions = [...mexicoStyles, customStyleOptionEs]\nconst spainStyleOptions = [...spainStyles, customStyleOptionEs]\n",
  ],
  [
    "  if (country === 'MX') {\n    return { language: 'Español (México)', defaultStyle: 'Regional mexicano', styleOptions: mexicoStyleOptions, isSpanish: true }\n  }",
    "  if (country === 'MX') {\n    return { language: 'Español (México)', defaultStyle: 'Regional mexicano', styleOptions: mexicoStyleOptions, isSpanish: true }\n  }\n  if (country === 'ES') {\n    return { language: 'Español (España)', defaultStyle: 'Flamenco pop', styleOptions: spainStyleOptions, isSpanish: true }\n  }",
  ],
  [
    "  const isMexico = country === 'MX'\n",
    "  const isMexico = country === 'MX'\n  const isSpain = String(country) === 'ES'\n",
  ],
  [
    ": isMexico ? 'Ej.: corrido romántico con sierreño' : isPortugal ? 'Ex.: fado pop contemporâneo' : 'Ex: piseiro romântico'",
    ": isMexico ? 'Ej.: corrido romántico con sierreño' : isSpain ? 'Ej.: flamenco pop con guitarra española' : isPortugal ? 'Ex.: fado pop contemporâneo' : 'Ex: piseiro romântico'",
  ],
])

patchFile('app/admin/precos/page.tsx', [
  [
    "  { code: 'PT', label: 'Portugal', flag: '🇵🇹' },\n  { code: 'US'",
    "  { code: 'PT', label: 'Portugal', flag: '🇵🇹' },\n  { code: 'ES', label: 'Espanha', flag: '🇪🇸' },\n  { code: 'US'",
  ],
  [
    "BR: 'BRL', PY: 'PYG', CO: 'COP', MX: 'MXN', PT: 'EUR', US: 'USD',",
    "BR: 'BRL', PY: 'PYG', CO: 'COP', MX: 'MXN', PT: 'EUR', ES: 'EUR', US: 'USD',",
  ],
])
