import { PDFArray, PDFDocument, PDFRawStream, PDFStream, StandardFonts, decodePDFRawStream, rgb } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { fitScoreTitleLayout, overlayScoreTitleOnPdf, SCORE_TITLE_OVERLAY } from '../pdf-score-title'

async function createSampleScorePdf() {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const page1 = pdfDoc.addPage([595, 842])
  const page2 = pdfDoc.addPage([595, 842])

  page1.drawText('RANDOMCODE123', {
    x: 180,
    y: 800,
    size: 18,
    font,
    color: rgb(0, 0, 0),
  })
  page1.drawText('COMPASSOS DA PRIMEIRA PAGINA', {
    x: 80,
    y: 400,
    size: 12,
    font,
  })
  page2.drawText('PAGE_TWO_MARKER', {
    x: 80,
    y: 400,
    size: 16,
    font,
    color: rgb(0, 0, 0),
  })

  pdfDoc.setTitle('Titulo errado do MuseScore')
  return Buffer.from(await pdfDoc.save())
}

function decodeStream(stream: any) {
  if (!stream) return ''
  try {
    const decoded = stream instanceof PDFRawStream || stream instanceof PDFStream
      ? decodePDFRawStream(stream).decode()
      : stream.contents
    return Buffer.from(decoded).toString('latin1')
  } catch {
    return String(stream)
  }
}

function decodePageContent(doc: PDFDocument, pageIndex: number) {
  const page = doc.getPages()[pageIndex]
  const contents = page.node.Contents()
  const items = contents instanceof PDFArray
    ? contents.asArray()
    : [contents]

  return items
    .map((item) => decodeStream(doc.context.lookup(item)))
    .join('\n')
}

describe('overlayScoreTitleOnPdf', () => {
  it('substitui o codigo da primeira pagina pelo titulo e preserva as demais paginas', async () => {
    const original = await createSampleScorePdf()
    const originalDoc = await PDFDocument.load(original)
    const originalPage2 = decodePageContent(originalDoc, 1)
    const originalPageCount = originalDoc.getPageCount()

    const corrected = await overlayScoreTitleOnPdf(original, 'Um Jardim Para Deus')
    const correctedDoc = await PDFDocument.load(corrected)
    const correctedPage1 = decodePageContent(correctedDoc, 0)
    const correctedPage2 = decodePageContent(correctedDoc, 1)

    expect(correctedDoc.getTitle()).toBe('Um Jardim Para Deus')
    expect(correctedDoc.getPageCount()).toBe(originalPageCount)
    expect(correctedPage1).toContain('1 0 0 1 85 770 cm')
    expect(correctedPage1).toContain('Helvetica-Bold')
    expect(correctedPage1).toContain(Buffer.from('Um Jardim Para Deus', 'utf8').toString('hex').toUpperCase())
    expect(correctedPage1).toContain(Buffer.from('COMPASSOS DA PRIMEIRA PAGINA', 'utf8').toString('hex').toUpperCase())
    expect(correctedPage2).toBe(originalPage2)
    expect(correctedPage2).toContain(Buffer.from('PAGE_TWO_MARKER', 'utf8').toString('hex').toUpperCase())
    expect(correctedPage2).not.toContain('1 0 0 1 85 770 cm')
    expect(correctedPage2).not.toContain(Buffer.from('Um Jardim Para Deus', 'utf8').toString('hex').toUpperCase())
  })

  it('diminui a fonte quando o titulo e longo demais para a caixa', async () => {
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const longTitle = 'Uma Cancao Muito Comprida Para Caber No Topo Da Partitura'
    const layout = fitScoreTitleLayout({ title: longTitle, font })

    expect(layout.fontSize).toBeLessThan(SCORE_TITLE_OVERLAY.fontSize)
    expect(layout.textWidth).toBeLessThanOrEqual(SCORE_TITLE_OVERLAY.width - SCORE_TITLE_OVERLAY.horizontalPadding)

    const original = await createSampleScorePdf()
    const corrected = await overlayScoreTitleOnPdf(original, longTitle)
    const correctedDoc = await PDFDocument.load(corrected)
    expect(correctedDoc.getTitle()).toBe(longTitle)
    expect(correctedDoc.getPageCount()).toBe(2)
  })

  it('devolve o PDF original se o arquivo for invalido', async () => {
    const original = Buffer.from('%PDF-1.4 arquivo quebrado')
    const result = await overlayScoreTitleOnPdf(original, 'Titulo qualquer')
    expect(Buffer.from(result).equals(original)).toBe(true)
  })

  it('nao altera o arquivo quando nao ha titulo', async () => {
    const original = await createSampleScorePdf()
    const result = await overlayScoreTitleOnPdf(original, '   ')
    expect(Buffer.from(result).equals(original)).toBe(true)
  })
})
