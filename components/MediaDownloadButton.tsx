'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FiDownload, FiLoader } from 'react-icons/fi'

export default function MediaDownloadButton({ src, filename, mediaType, className, children, admin = false }: {
  src: string; filename: string; mediaType: 'audio' | 'video'; className?: string; children?: ReactNode; admin?: boolean
}) {
  const { t, i18n } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const language = i18n.language.split('-')[0]
  const labels = language === 'en'
    ? { ready: 'File ready', share: 'Share file', save: 'Save file', close: 'Close', failed: 'Could not prepare the file. Please try again.' }
    : language === 'es'
      ? { ready: 'Archivo listo', share: 'Compartir archivo', save: 'Guardar archivo', close: 'Cerrar', failed: 'No se pudo preparar el archivo. Inténtalo de nuevo.' }
      : { ready: 'Arquivo pronto', share: 'Compartilhar arquivo', save: 'Salvar arquivo', close: 'Fechar', failed: 'Não foi possível preparar o arquivo. Tente novamente.' }

  useEffect(() => { setFile(null); setOpen(false); setError(false) }, [src, filename])

  const save = (prepared: File) => {
    const url = URL.createObjectURL(prepared)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = prepared.name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const prepare = async () => {
    if (busy) return
    setError(false)
    setBusy(true)
    try {
      let prepared = file
      if (!prepared) {
        const token = localStorage.getItem('composer_token')
        if (!admin && !token) throw new Error('unauthorized')
        // Same-origin proxy avoids cross-origin download and CORS differences on phones.
        const response = await fetch('/api/compositores/studio/download-proxy', {
          method: 'POST',
          headers: { ...(!admin && token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: src, mediaType, filename }),
        })
        if (!response.ok) throw new Error('download_failed')
        const blob = await response.blob()
        if (!blob.size || !blob.type.startsWith(`${mediaType}/`)) throw new Error('invalid_media')
        const name = filename.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').slice(0, 180)
        prepared = new File([blob], name, { type: mediaType === 'video' ? 'video/mp4' : blob.type })
        setFile(prepared)
      }
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent))
      if (mobile && navigator.canShare?.({ files: [prepared] })) {
        // A fresh tap is required after a slow fetch to preserve user activation.
        setOpen(true)
      } else {
        save(prepared)
      }
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  const share = async () => {
    if (!file || busy) return
    setBusy(true)
    try {
      await navigator.share({ files: [file] })
      setOpen(false)
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(true)
    } finally { setBusy(false) }
  }

  return <>
    <button type="button" onClick={prepare} disabled={busy} className={className} aria-label={t('studio.project.audio.download')}>
      {busy ? <FiLoader className="animate-spin" /> : children || <FiDownload />}
    </button>
    {error && <span role="alert" className="text-xs text-red-300">{labels.failed}</span>}
    {open && file && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={labels.ready}>
      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-950 p-5 text-white">
        <h2 className="font-bold">{labels.ready}</h2>
        <p className="my-3 break-words text-sm text-gray-300">{file.name}</p>
        <div className="flex flex-col gap-3">
          <button type="button" disabled={busy} onClick={share} className="rounded-xl bg-primary-700 p-3 font-bold">{labels.share}</button>
          <button type="button" onClick={() => { save(file); setOpen(false) }} className="rounded-xl border border-gray-700 p-3">{labels.save}</button>
          <button type="button" onClick={() => setOpen(false)} className="p-2 text-gray-400">{labels.close}</button>
        </div>
      </div>
    </div>}
  </>
}
