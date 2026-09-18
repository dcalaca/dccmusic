const exactEnglishOverrides: Record<string, string> = {
  'Crie sua música': 'Create your song',
  // Logged-in AI Studio dashboard
  'Voltar': 'Back',
  'Exclusivo DCC Studio IA': 'Exclusive DCC AI Studio',
  'Crie músicas completas com Inteligência Artificial, organize projetos, gere capas e publique no DCC Music.':
    'Create complete songs with artificial intelligence, organize projects, generate covers, and publish on DCC Music.',
  'Criar Nova Música': 'Create New Song',
  'Criar Capa': 'Create Cover',
  'Melhorar Música': 'Improve Song',
  'Minhas Vozes': 'My Voices',
  'Meus Projetos': 'My Projects',
  'Saldo atual': 'Current balance',
  'créditos disponíveis, aproximadamente': 'credits available, approximately',
  'música(s)': 'song(s)',
  'Uso do mês': 'Monthly usage',
  'Gerar música usa 10 créditos. Criar voz aprovada usa 2 créditos. Melhorar capa usa 2 créditos.':
    'Generating a song uses 10 credits. Creating an approved voice uses 2 credits. Improving a cover uses 2 credits.',
  'Você está usando saldo avulso, sem mensalidade.': 'You are using one-time credits with no subscription.',
  'Recarga avulsa': 'One-time credits',
  'músicas geradas no mês': 'songs generated this month',
  'projetos salvos': 'saved projects',
  'publicados no DCC': 'published on DCC',
  'Projetos recentes': 'Recent projects',
  'Ver todos': 'View all',
  'Você ainda não criou projetos no Studio.': 'You have not created any Studio projects yet.',
  'Criar primeira música': 'Create first song',
  'Livre': 'Free style',
  'Estúdio musical com IA para quem tem música grátis, plano ativo ou créditos avulsos.':
    'AI music studio for users with a free song, an active plan, or one-time credits.',
  'Você tem 1 música grátis para testar, clique aqui.': 'You have 1 free song to try. Click here.',
  'Crie sua primeira música completa com IA e veja como funciona o DCC Studio IA.':
    'Create your first complete AI song and see how DCC AI Studio works.',
  'créditos disponíveis.': 'credits available.',
  'Clique aqui para criar sua próxima música usando sua recarga.':
    'Click here to create your next song using your credits.',
  'Conhecer plano DCC Studio IA': 'View DCC AI Studio plan',
  'Comprar recarga avulsa': 'Buy one-time credits',
  'Erro ao carregar Studio IA': 'Error loading AI Studio',
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
