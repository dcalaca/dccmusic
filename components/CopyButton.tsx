'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiCopy, FiCheck } from 'react-icons/fi'

interface CopyButtonProps {
  text: string
  label?: string
}

export default function CopyButton({ text, label }: CopyButtonProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <button onClick={handleCopy} className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors w-full">
      {copied ? (
        <>
          <FiCheck className="w-4 h-4 text-green-400" />
          <span>{t('common.actions.copied')}</span>
        </>
      ) : (
        <>
          <FiCopy className="w-4 h-4" />
          <span>{label || t('common.actions.copy')}</span>
        </>
      )}
    </button>
  )
}
