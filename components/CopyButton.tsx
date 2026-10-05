'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiCopy, FiCheck } from 'react-icons/fi'

interface CopyButtonProps {
  text: string
  label?: string
  copiedLabel?: string
}

export default function CopyButton({ text, label, copiedLabel }: CopyButtonProps) {
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
    <button type="button" disabled={!text.trim()} onClick={handleCopy} aria-live="polite" className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors w-full disabled:opacity-40">
      {copied ? (
        <>
          <FiCheck className="w-4 h-4 text-green-400" />
          <span>{copiedLabel || t('common.actions.copied')}</span>
        </>
      ) : (
        <>
          <FiCopy className="w-4 h-4" />
          <span>{failed ? t('common.actions.copyFailed') : label || t('common.actions.copy')}</span>
        </>
      )}
    </button>
  )
}
