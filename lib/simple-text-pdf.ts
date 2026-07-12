function escapePdfText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '')
}

function normalizePdfText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?')
}

export function createSimpleTextPdf(input: {
  title: string
  text: string
}) {
  const lines = normalizePdfText(input.text)
    .split('\n')
    .flatMap((line) => {
      if (line.length <= 92) return [line]
      const chunks: string[] = []
      for (let index = 0; index < line.length; index += 92) {
        chunks.push(line.slice(index, index + 92))
      }
      return chunks
    })

  const pageCapacity = 42
  const pages: string[][] = []
  for (let index = 0; index < lines.length; index += pageCapacity) {
    pages.push(lines.slice(index, index + pageCapacity))
  }
  if (pages.length === 0) pages.push([''])

  const objects: string[] = []
  const addObject = (content: string) => {
    objects.push(content)
    return objects.length
  }

  const fontObject = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>')
  const pageObjectIds: number[] = []
  const contentObjectIds: number[] = []

  for (const pageLines of pages) {
    const textOps = [
      'BT',
      '/F1 10 Tf',
      '40 790 Td',
      `(${escapePdfText(normalizePdfText(input.title))}) Tj`,
      '0 -18 Td',
      ...pageLines.flatMap((line) => [
        `(${escapePdfText(line)}) Tj`,
        '0 -14 Td',
      ]),
      'ET',
    ].join('\n')

    const contentId = addObject(`<< /Length ${Buffer.byteLength(textOps)} >>\nstream\n${textOps}\nendstream`)
    contentObjectIds.push(contentId)
    pageObjectIds.push(0)
  }

  const pagesObjectPlaceholder = objects.length + pages.length + 1
  for (let index = 0; index < pages.length; index += 1) {
    const pageId = addObject(`<< /Type /Page /Parent ${pagesObjectPlaceholder} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`)
    pageObjectIds[index] = pageId
  }

  const pagesObject = addObject(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`)
  const catalogObject = addObject(`<< /Type /Catalog /Pages ${pagesObject} 0 R >>`)

  const chunks: string[] = ['%PDF-1.4\n']
  const offsets: number[] = [0]
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(chunks.join('')))
    chunks.push(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`)
  }

  const xrefOffset = Buffer.byteLength(chunks.join(''))
  chunks.push(`xref\n0 ${objects.length + 1}\n`)
  chunks.push('0000000000 65535 f \n')
  for (let index = 1; index < offsets.length; index += 1) {
    chunks.push(`${String(offsets[index]).padStart(10, '0')} 00000 n \n`)
  }
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)

  return Buffer.from(chunks.join(''), 'binary')
}
