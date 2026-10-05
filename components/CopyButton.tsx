'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiCopy, FiCheck } from 'react-icons/fi'

interface CopyButtonProps {
  text: string
  label?: string
  copiedLabel?: string
  iconOnly?: boolean
}

export default function CopyButton({ text, label, copiedLabel, iconOnly = false }: CopyButtonProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  const handleCopy = async () => {
    setFailed(false)
    setCopied(false)
    try {
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        // Older browsers may lack the Clipboard API or deny its permission.
        const previousFocus = document.activeElement as HTMLElement | null
        const field = document.createElement('textarea')
        field.value = text
        field.style.position = 'fixed'
        field.style.opacity = '0'
        field.style.fontSize = '16px'
        document.body.appendChild(field)
        try {
          field.focus({ preventScroll: true })
          field.select()
          field.setSelectionRange(0, text.length)
          if (!document.execCommand('copy')) throw new Error('copy failed')
        } finally {
          field.remove()
          previousFocus?.focus({ preventScroll: true })
        }
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      setFailed(true)
      console.error('Failed to copy:', err)
    }
  }

  return (
    <button type="button" disabled={!text.trim()} onClick={handleCopy} aria-live="polite" title={failed ? t('common.actions.copyFailed') : copied ? copiedLabel || t('common.actions.copied') : label || t('common.actions.copy')} className={iconOnly
      ? 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-40 sm:h-8 sm:w-8'
      : 'flex items-center justify-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors w-full disabled:opacity-40'}>
      {copied ? (
        <>
          <FiCheck className="w-4 h-4 text-green-400" />
          <span className={iconOnly ? 'sr-only' : undefined}>{copiedLabel || t('common.actions.copied')}</span>
        </>
      ) : (
        <>
          <FiCopy className="w-4 h-4" />
          <span className={iconOnly ? 'sr-only' : undefined}>{failed ? t('common.actions.copyFailed') : label || t('common.actions.copy')}</span>
        </>
      )}
    </button>
  )
}
