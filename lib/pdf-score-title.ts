import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const SCORE_TITLE_OVERLAY = {
  x: 85,
  y: 770,
  width: 425,
  height: 52,
  titleY: 790,
  fontSize: 24,
  minFontSize: 10,
  horizontalPadding: 16,
} as const

function cleanScoreTitle(value?: string | null) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toWinAnsiSafeTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function fitScoreTitleLayout(input: {
  title: string
  font: { widthOfTextAtSize: (text: string, size: number) => number }
  maxWidth?: number
  fontSize?: number
  minFontSize?: number
}) {
  const maxWidth = input.maxWidth ?? (SCORE_TITLE_OVERLAY.width - SCORE_TITLE_OVERLAY.horizontalPadding)
  const minFontSize = input.minFontSize ?? SCORE_TITLE_OVERLAY.minFontSize
  let displayTitle = input.title
  let fontSize = input.fontSize ?? SCORE_TITLE_OVERLAY.fontSize
  let textWidth = input.font.widthOfTextAtSize(displayTitle, fontSize)

  while (textWidth > maxWidth && fontSize > minFontSize) {
    fontSize -= 0.5
    textWidth = input.font.widthOfTextAtSize(displayTitle, fontSize)
  }

  if (textWidth > maxWidth) {
    while (displayTitle.length > 1 && input.font.widthOfTextAtSize(`${displayTitle}...`, fontSize) > maxWidth) {
      displayTitle = displayTitle.slice(0, -1).trim()
    }
    displayTitle = `${displayTitle}...`
    textWidth = input.font.widthOfTextAtSize(displayTitle, fontSize)
  }

  return { displayTitle, fontSize, textWidth }
}

export async function overlayScoreTitleOnPdf(
  pdfBytes: Buffer | Uint8Array,
  title?: string | null,
): Promise<Buffer> {
  const original = Buffer.from(pdfBytes)
  const cleanTitle = cleanScoreTitle(title)
  if (!cleanTitle) return original

  try {
    const pdfDoc = await PDFDocument.load(original, { ignoreEncryption: true, updateMetadata: false })
    const pages = pdfDoc.getPages()
    if (pages.length === 0) return original

    const firstPage = pages[0]
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const box = SCORE_TITLE_OVERLAY

    firstPage.drawRectangle({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    })

    let fitted = fitScoreTitleLayout({
      title: cleanTitle,
      font,
    })

    try {
      font.encodeText(fitted.displayTitle)
    } catch {
      fitted = fitScoreTitleLayout({
        title: toWinAnsiSafeTitle(cleanTitle) || 'Partitura',
        font,
      })
    }

    firstPage.drawText(fitted.displayTitle, {
      x: box.x + (box.width - fitted.textWidth) / 2,
      y: box.titleY - fitted.fontSize * 0.35,
      size: fitted.fontSize,
      font,
      color: rgb(0, 0, 0),
    })

    pdfDoc.setTitle(cleanTitle)
    return Buffer.from(await pdfDoc.save())
  } catch (error) {
    console.error('[PDF Score Title] Falha no overlay, mantendo o PDF original:', error)
    return original
  }
}
