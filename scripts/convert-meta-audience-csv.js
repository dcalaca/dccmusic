const fs = require('fs')

const inputPath = process.argv[2] || 'C:/Users/dougc/Downloads/compradores-recorrentes (1).csv'
const outputPath = process.argv[3] || 'C:/Users/dougc/Downloads/meta-publico-recorrentes.csv'

function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }

  result.push(current)
  return result
}

function csvEscape(value) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D+/g, '')
  if (!digits) return ''
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`
  if (digits.length >= 10 && digits.length <= 11) return `+55${digits}`
  if (String(phone).trim().startsWith('+')) return String(phone).trim()
  return `+${digits}`
}

const raw = fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, '')
const lines = raw.split(/\r?\n/).filter(Boolean)
const header = parseCsvLine(lines[0])
const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]))

// Modelo Meta: identificadores principais + value (recomendado) + adicionais.
const outHeader = 'email,phone,fn,ln,country,value,madid,appuid,pageuid,iguid'
const outRows = [outHeader]
let count = 0
let withPhone = 0
let totalValue = 0

for (const line of lines.slice(1)) {
  const cols = parseCsvLine(line)
  const email = String(cols[idx.email] || '').trim().toLowerCase()
  if (!email || !email.includes('@')) continue

  const phone = normalizePhone(cols[idx.phone])
  let fn = String(cols[idx.fn] || '').trim()
  let ln = String(cols[idx.ln] || '').trim()
  const name = String(cols[idx.name] || '').trim()

  if (!fn && name) {
    const parts = name.split(/\s+/).filter(Boolean)
    fn = parts[0] || ''
    ln = parts.slice(1).join(' ')
  }

  const value = Number(String(cols[idx.total_amount] || '0').replace(',', '.'))
  if (!Number.isFinite(value) || value < 0) continue

  if (phone) withPhone += 1
  totalValue += value

  outRows.push([
    email,
    phone,
    fn,
    ln,
    'BR',
    // Só número, sem R$ e sem vírgula
    value.toFixed(2),
    '', // madid
    '', // appuid
    '', // pageuid
    '', // iguid
  ].map(csvEscape).join(','))

  count += 1
}

fs.writeFileSync(outputPath, `\uFEFF${outRows.join('\n')}`, 'utf8')
console.log(`OK rows=${count} withPhone=${withPhone} totalValue=${totalValue.toFixed(2)}`)
console.log(`file=${outputPath}`)
if (count < 100) {
  console.log(`AVISO: Meta pede no minimo 100 clientes. Este arquivo tem ${count}.`)
}
