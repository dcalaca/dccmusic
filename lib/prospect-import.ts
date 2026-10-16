export type Prospect = { email: string; name: string }
export const DEFAULT_SUBJECT = 'Sua primeira música com IA é grátis na DCC Music'
export const DEFAULT_BODY = `Olá, {nome}!

Somos a DCC Music, uma plataforma para transformar suas ideias em música com inteligência artificial.

Você pode gerar letras, criar músicas e até clonar a própria voz para dar um toque pessoal às suas criações. Tudo de um jeito fácil e simples, mesmo sem experiência musical.

Cadastre-se e aproveite: sua primeira música é grátis!

Bora tirar sua ideia do papel e transformar em música?

Um abraço,
Equipe DCC Music`
export function personalizeProspect(text: string, name: string) {
  return text.replace(/\{\{?\s*nome\s*\}\}?/gi, name.trim().split(/\s+/)[0] || 'tudo bem')
}
const validEmail = (s: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s) && s.length <= 254
const header = (s: unknown) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
export function parseProspectRows(rows: unknown[][]) {
  let start = -1, emailCol = -1, nameCol = -1
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const col = rows[i].findIndex(v => /^(email|mail|emailaddress|enderecoemail|enderecodeemail|correioeletronico|emailcliente|emaildocliente)$/.test(header(v)))
    if (col >= 0) { start = i; emailCol = col; nameCol = rows[i].findIndex(v => /^(nome|name|nomecompleto|fullname|primeironome|firstname|cliente)$/.test(header(v))); break }
  }
  if (emailCol < 0) {
    const counts = new Map<number, number>()
    rows.slice(0, 100).forEach(row => row.forEach((v, i) => { if (validEmail(String(v || '').trim())) counts.set(i, (counts.get(i) || 0) + 1) }))
    emailCol = [...counts].sort((a,b) => b[1]-a[1])[0]?.[0] ?? -1
  }
  if (emailCol < 0) throw new Error('Não foi possível identificar uma coluna de e-mail.')
  const contacts: Prospect[] = [], seen = new Set<string>(); let invalid = 0, duplicates = 0
  for (const row of rows.slice(start + 1)) {
    if (!row.some(v => String(v || '').trim())) continue
    const email = String(row[emailCol] || '').trim().toLowerCase()
    if (!validEmail(email)) { invalid++; continue }
    if (seen.has(email)) { duplicates++; continue }
    seen.add(email); contacts.push({ email, name: nameCol < 0 ? '' : String(row[nameCol] || '').trim().slice(0, 200) })
  }
  return { contacts, invalid, duplicates, emailColumn: emailCol + 1, nameColumn: nameCol < 0 ? null : nameCol + 1 }
}
