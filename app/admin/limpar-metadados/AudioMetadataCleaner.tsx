'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { FiCheckCircle, FiDownload, FiMusic, FiTrash2, FiUploadCloud } from 'react-icons/fi'

type CleanResult = {
  url: string
  filename: string
  originalBytes: number
  cleanBytes: number
  removedBytes: number
}

function isMp3(file: File) {
  return file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3')
}

function synchsafeToInt(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  )
}

function readUint32LE(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0
}

function matchesAscii(bytes: Uint8Array, offset: number, value: string) {
  if (offset < 0 || offset + value.length > bytes.length) return false

  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false
  }

  return true
}

function stripMp3Metadata(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let start = 0
  let end = bytes.length

  // ID3v2 fica no início do MP3. O tamanho não inclui o cabeçalho de 10 bytes.
  if (bytes.length >= 10 && matchesAscii(bytes, 0, 'ID3')) {
    const tagSize = synchsafeToInt(bytes, 6)
    const hasFooter = (bytes[5] & 0x10) !== 0
    start = Math.min(bytes.length, 10 + tagSize + (hasFooter ? 10 : 0))
  }

  // ID3v1 fica nos últimos 128 bytes.
  if (end - start >= 128 && matchesAscii(bytes, end - 128, 'TAG')) {
    end -= 128
  }

  // APEv2 pode aparecer no final, inclusive antes de um ID3v1 já removido acima.
  if (end - start >= 32 && matchesAscii(bytes, end - 32, 'APETAGEX')) {
    const apeSize = readUint32LE(bytes, end - 20)
    if (apeSize >= 32 && apeSize <= end - start) {
      end -= apeSize
    }
  }

  if (start >= end) {
    throw new Error('Não foi possível localizar o áudio dentro deste MP3.')
  }

  return bytes.slice(start, end)
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

export default function AudioMetadataCleaner() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<CleanResult | null>(null)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    return () => {
      if (result?.url) URL.revokeObjectURL(result.url)
    }
  }, [result])

  const selectedLabel = useMemo(() => {
    if (!file) return 'Nenhum arquivo selecionado'
    return `${file.name} · ${formatBytes(file.size)}`
  }, [file])

  function resetResult() {
    if (result?.url) URL.revokeObjectURL(result.url)
    setResult(null)
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] || null
    resetResult()
    setError('')

    if (!nextFile) {
      setFile(null)
      return
    }

    if (!isMp3(nextFile)) {
      setFile(null)
      setError('Por segurança, esta ferramenta aceita apenas arquivos MP3.')
      event.target.value = ''
      return
    }

    setFile(nextFile)
  }

  async function cleanMetadata() {
    if (!file || processing) return

    setProcessing(true)
    setError('')
    resetResult()

    try {
      const original = await file.arrayBuffer()
      const cleanBytes = stripMp3Metadata(original)
      const blob = new Blob([cleanBytes], { type: 'audio/mpeg' })
      const baseName = file.name.replace(/\.mp3$/i, '')
      const url = URL.createObjectURL(blob)

      setResult({
        url,
        filename: `${baseName}-sem-metadados.mp3`,
        originalBytes: file.size,
        cleanBytes: blob.size,
        removedBytes: Math.max(0, file.size - blob.size),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível limpar os metadados deste arquivo.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold">
            <span className="gradient-text">Limpar metadados do áudio</span>
          </h1>
          <p className="text-gray-400">
            Remova tags ID3 e APE de um MP3 sem recomprimir o áudio e sem enviar o arquivo para o servidor.
          </p>
        </div>

        <div className="rounded-3xl border border-gray-800 bg-gray-950/60 p-6 shadow-2xl sm:p-8">
          <div className="mb-6 flex items-start gap-4 rounded-2xl border border-green-900/60 bg-green-950/20 p-4">
            <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
            <div>
              <p className="font-semibold text-green-300">Isolado do restante do sistema</p>
              <p className="mt-1 text-sm leading-6 text-gray-400">
                A limpeza acontece somente no seu navegador. Nada é salvo no Supabase, no bucket ou nos projetos dos usuários.
              </p>
            </div>
          </div>

          <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-gray-700 bg-black/20 p-8 text-center transition hover:border-primary-500">
            <FiUploadCloud className="mx-auto mb-3 h-9 w-9 text-gray-400" />
            <span className="block font-semibold text-white">Selecionar MP3</span>
            <span className="mt-2 block text-sm text-gray-500">{selectedLabel}</span>
            <input className="hidden" type="file" accept="audio/mpeg,.mp3" onChange={handleFile} />
          </label>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={cleanMetadata}
            disabled={!file || processing}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 font-bold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FiTrash2 className="h-5 w-5" />
            {processing ? 'Limpando...' : 'Remover metadados'}
          </button>

          {result ? (
            <div className="mt-6 rounded-2xl border border-gray-800 bg-black/30 p-5">
              <div className="flex items-start gap-3">
                <FiMusic className="mt-1 h-5 w-5 shrink-0 text-primary-400" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">Arquivo pronto</p>
                  <p className="mt-1 break-all text-sm text-gray-400">{result.filename}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    Original: {formatBytes(result.originalBytes)} · Limpo: {formatBytes(result.cleanBytes)} · Removido: {formatBytes(result.removedBytes)}
                  </p>
                </div>
              </div>

              <a
                href={result.url}
                download={result.filename}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary-500/60 bg-primary-950/30 px-5 py-3 font-bold text-primary-200 transition hover:bg-primary-900/40"
              >
                <FiDownload className="h-5 w-5" />
                Baixar MP3 sem metadados
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
