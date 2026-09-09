const COMMON_ID3_FRAMES = new Set([
  'TIT1','TIT2','TIT3','TALB','TPE1','TPE2','TPE3','TPE4','TCOM','TCON','TRCK','TPOS',
  'TDRC','TDOR','TYER','TDAT','TIME','TCOP','TPUB','TSSE','TSOA','TSOP','TSOT','COMM','USLT',
  'SYLT','APIC','PIC','WXXX','WOAR','WPUB','TXXX',
])

const COMMON_ID3V22_FRAMES = new Set([
  'TT1','TT2','TT3','TAL','TP1','TP2','TP3','TP4','TCM','TCO','TRK','TPA','TYE','TDA','TIM',
  'TCR','TPB','TSS','COM','ULT','SLT','PIC','WXX','TXX',
])

const PROVENANCE_HINT = /(?:c2pa|content[ _-]?credentials?|jumbf|manifest|provenance|signature)/i

function readSynchsafe32(buffer: Buffer, offset: number) {
  return (
    ((buffer[offset] & 0x7f) << 21) |
    ((buffer[offset + 1] & 0x7f) << 14) |
    ((buffer[offset + 2] & 0x7f) << 7) |
    (buffer[offset + 3] & 0x7f)
  ) >>> 0
}

function writeSynchsafe32(value: number) {
  return Buffer.from([
    (value >>> 21) & 0x7f,
    (value >>> 14) & 0x7f,
    (value >>> 7) & 0x7f,
    value & 0x7f,
  ])
}

function shouldRemoveFrame(id: string, framePayload: Buffer) {
  const common = id.length === 3 ? COMMON_ID3V22_FRAMES.has(id) : COMMON_ID3_FRAMES.has(id)
  if (!common) return false

  // Nunca remova um frame que pareça carregar credencial/proveniência assinada.
  // A limpeza DCC é apenas dos metadados descritivos comuns.
  const preview = framePayload.subarray(0, Math.min(framePayload.length, 4096)).toString('latin1')
  return !PROVENANCE_HINT.test(preview)
}

function cleanId3v2(buffer: Buffer) {
  if (buffer.length < 10 || buffer.subarray(0, 3).toString('ascii') !== 'ID3') return buffer

  const major = buffer[3]
  if (major < 2 || major > 4) return buffer

  const flags = buffer[5]
  // Tags com unsynchronisation/extended header exigem reconstrução especializada.
  // Preserve-os para não corromper nem apagar eventual proveniência assinada.
  if ((flags & 0x80) || (flags & 0x40)) return buffer

  const declaredSize = readSynchsafe32(buffer, 6)
  const hasFooter = major === 4 && Boolean(flags & 0x10)
  const totalTagSize = 10 + declaredSize + (hasFooter ? 10 : 0)
  if (totalTagSize > buffer.length) return buffer

  const framesEnd = 10 + declaredSize
  const kept: Buffer[] = []
  let cursor = 10

  while (cursor < framesEnd) {
    const headerSize = major === 2 ? 6 : 10
    if (cursor + headerSize > framesEnd) break

    const idLength = major === 2 ? 3 : 4
    const id = buffer.subarray(cursor, cursor + idLength).toString('ascii')
    if (!id.trim() || /^\x00+$/.test(id)) break
    if (!/^[A-Z0-9]{3,4}$/.test(id)) return buffer

    const frameSize = major === 2
      ? buffer.readUIntBE(cursor + 3, 3)
      : major === 4
        ? readSynchsafe32(buffer, cursor + 4)
        : buffer.readUInt32BE(cursor + 4)

    if (frameSize <= 0 || cursor + headerSize + frameSize > framesEnd) return buffer

    const rawFrame = buffer.subarray(cursor, cursor + headerSize + frameSize)
    const payload = buffer.subarray(cursor + headerSize, cursor + headerSize + frameSize)
    if (!shouldRemoveFrame(id, payload)) kept.push(rawFrame)
    cursor += headerSize + frameSize
  }

  const audio = buffer.subarray(totalTagSize)
  if (!kept.length) return audio

  const payload = Buffer.concat(kept)
  const header = Buffer.from(buffer.subarray(0, 10))
  header[5] = flags & ~0x10 // reconstruímos sem footer
  writeSynchsafe32(payload.length).copy(header, 6)
  return Buffer.concat([header, payload, audio])
}

function cleanId3v1(buffer: Buffer) {
  if (buffer.length >= 128 && buffer.subarray(buffer.length - 128, buffer.length - 125).toString('ascii') === 'TAG') {
    return buffer.subarray(0, buffer.length - 128)
  }
  return buffer
}

/**
 * Remove metadados descritivos comuns de MP3 sem recodificar o áudio.
 *
 * Remove título, artista, álbum, compositor, gênero, faixa, data, comentários,
 * letras, capa, encoder/software e campos TXXX comuns (incluindo IDs auxiliares).
 * Frames desconhecidos e frames que pareçam C2PA/Content Credentials/proveniência
 * são preservados de propósito. Watermark/fingerprint no sinal de áudio não é alterado.
 */
export function sanitizeGeneratedAudioMetadata(buffer: Buffer, contentType = 'audio/mpeg') {
  const looksLikeMp3 =
    contentType.toLowerCase().includes('mpeg') ||
    contentType.toLowerCase().includes('mp3') ||
    buffer.subarray(0, 3).toString('ascii') === 'ID3' ||
    (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)

  if (!looksLikeMp3) {
    // Não remuxe formatos desconhecidos: isso poderia alterar o áudio ou uma
    // credencial de proveniência. Novos formatos devem ganhar sanitizador próprio.
    return { buffer, changed: false, format: 'unchanged' as const }
  }

  const withoutV2 = cleanId3v2(buffer)
  const cleaned = cleanId3v1(withoutV2)
  if (!cleaned.length) throw new Error('Sanitização de metadados resultou em áudio vazio.')

  return {
    buffer: Buffer.from(cleaned),
    changed: cleaned.length !== buffer.length,
    format: 'mp3' as const,
  }
}
