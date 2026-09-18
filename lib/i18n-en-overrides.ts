const exactEnglishOverrides: Record<string, string> = {
  'Crie sua música': 'Create your song',
  'Crie sua música com inteligência artificial': 'Create your song with artificial intelligence',
  'Digite sua ideia ou letra e transforme em uma música completa. Cadastre-se e experimente sua primeira criação grátis.':
    'Enter your idea or lyrics and turn them into a complete song. Sign up and try your first creation free.',
  'Spotify e Plataformas': 'Spotify & Platforms',
  'Spotify e Plataformas | DCC Music + SomVibe': 'Spotify & Platforms | DCC Music + SomVibe',
  'Imagine sua música no Spotify!': 'Imagine your song on Spotify!',
  'Leve sua música para Spotify, Apple Music, Deezer e muito mais.':
    'Get your song on Spotify, Apple Music, Deezer, and more.',
  'Leve sua música para Spotify, Apple Music, Deezer e muito mais com a SomVibe, parceira da DCC Music.':
    'Get your song on Spotify, Apple Music, Deezer, and more with SomVibe, a DCC Music partner.',
}

export function translateEnglishOverride(value: string) {
  const leading = value.match(/^\s*/)?.[0] || ''
  const trailing = value.match(/\s*$/)?.[0] || ''
  const core = value.trim()
  const translated = exactEnglishOverrides[core]
  return translated === undefined ? null : `${leading}${translated}${trailing}`
}
