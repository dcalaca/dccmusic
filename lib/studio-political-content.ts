const normalizePoliticalText = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const explicitCampaignPatterns = [
  /\b(vote|votar|votem|vota|voto)\b/,
  /\b(urna|eleicao|eleicoes|eleitoral|campanha eleitoral)\b/,
  /\b(candidato|candidata|candidatura)\b/,
  /\b(deputado|deputada)\s+(federal|estadual)\b/,
  /\b(vereador|vereadora|prefeito|prefeita|governador|governadora|senador|senadora)\b/,
  /\bpresidente\s+da\s+republica\b/,
  /\b(vote|vota|votar)\s+\d{2,6}\b/,
  /\b\d{2,6}\s+(na|pra|para)\s+(urna|deputad|vereador|prefeit|governador|senador)\w*\b/,
  /\b(vota|vote|votar|vota em|vote em)\b.*\b(deputad|vereador|prefeit|governador|senador|president|candidat)\w*\b/,
  /\b(deputad|vereador|prefeit|governador|senador|president|candidat)\w*\b.*\b(vota|vote|votar|urna|eleicao|campanha)\b/,
  /\b(vote|votar|vota|urna|eleccion|elecciones|campana)\b.*\b(diputad|concejal|alcald|gobernador|senador|president|candidat)\w*\b/,
  /\b(diputad|concejal|alcald|gobernador|senador|president|candidat)\w*\b.*\b(vote|votar|vota|urna|eleccion|campana)\b/,
  /\b(vote|voting|ballot|election|campaign)\b.*\b(candidate|congress|senator|governor|mayor|president|representative)\b/,
  /\b(candidate|congress|senator|governor|mayor|president|representative)\b.*\b(vote|voting|ballot|election|campaign)\b/,
]

const politicalRolePattern =
  /\b(deputad|vereador|prefeit|governador|senador|president|candidat|diputad|concejal|alcald|candidate|congress|senator|governor|mayor|representative)\w*\b/

const electionActionPattern =
  /\b(vote|votar|vota|voto|urna|eleicao|eleitoral|campanha|eleccion|campana|voting|ballot|election|campaign)\w*\b/

const electoralNumberPattern = /(^|\s)\d{2,6}(\s|$)/

export function isPoliticalCampaignContent(...values: unknown[]) {
  const text = normalizePoliticalText(values.filter(Boolean).join(' '))
  if (!text) return false

  if (explicitCampaignPatterns.some((pattern) => pattern.test(text))) return true

  return (
    politicalRolePattern.test(text) &&
    (electionActionPattern.test(text) || electoralNumberPattern.test(text))
  )
}

export const POLITICAL_CAMPAIGN_READY_LYRIC_MESSAGE =
  'Para conteúdos relacionados a campanhas políticas, o DCC aceita apenas a letra já pronta pelo usuário. Clique em “Tenho minha letra”, cole a letra completa e continue a criação da música. A IA do DCC não cria, reescreve ou adapta conteúdo eleitoral.'

export const POLITICAL_CAMPAIGN_OPENAI_BLOCK_MESSAGE =
  'Para conteúdos relacionados a campanhas políticas, não usamos a IA da OpenAI para criar, reescrever, adaptar ou gerar capas. Você pode continuar com uma letra já pronta e gerar a música pelo fluxo compatível.'
