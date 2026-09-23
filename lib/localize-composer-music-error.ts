// Only display known API errors. Other responses can include database details and
// should fall back to a translated message instead of exposing raw server text.
export function localizeComposerMusicError(
  message: unknown,
  t: (key: string) => string,
  fallbackKey: string
): string {
  const keys: Record<string, string> = {
    'Não autorizado': 'unauthorized',
    'Música não encontrada ou você não tem permissão': 'songUnavailable',
    'Você precisa de uma assinatura ativa para gerenciar músicas': 'subscriptionRequired',
    'Você precisa de uma assinatura ativa para cadastrar músicas': 'subscriptionRequired',
    'Título é obrigatório': 'titleRequired',
  }
  const key = keys[String(message || '')]
  return t(`composerSongs.${key || fallbackKey}`)
}
