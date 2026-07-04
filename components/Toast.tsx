'use client'

import { useEffect } from 'react'
import { FiX, FiInfo } from 'react-icons/fi'

interface ToastProps {
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  onClose: () => void
  duration?: number
}

export default function Toast({
  message,
  type = 'info',
  onClose,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const typeStyles = {
    info: 'bg-blue-900/90 border-blue-700 text-blue-100',
    success: 'bg-green-900/90 border-green-700 text-green-100',
    warning: 'bg-yellow-900/90 border-yellow-700 text-yellow-100',
    error: 'bg-red-900/90 border-red-700 text-red-100',
  }

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm animate-slide-in-right ${typeStyles[type]}`}
      role="alert"
    >
      <FiInfo className="w-5 h-5 flex-shrink-0" />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
        aria-label="Fechar"
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  )
}
