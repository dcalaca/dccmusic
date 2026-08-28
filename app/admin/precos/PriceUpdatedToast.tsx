'use client'

import { useEffect, useState } from 'react'
import { FiCheckCircle, FiX } from 'react-icons/fi'

export default function PriceUpdatedToast({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(show)

  useEffect(() => {
    setVisible(show)
    if (!show) return
    const timer = window.setTimeout(() => setVisible(false), 2800)
    return () => window.clearTimeout(timer)
  }, [show])

  if (!visible) return null

  return (
    <div className="fixed right-4 top-20 z-[100] w-[min(92vw,330px)] rounded-2xl border border-emerald-500/40 bg-gray-950/95 p-4 shadow-2xl shadow-black/60 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
          <FiCheckCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-black text-white">Preço atualizado</p>
          <p className="text-xs text-gray-400">A alteração já foi salva no Supabase.</p>
        </div>
        <button type="button" onClick={() => setVisible(false)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white" aria-label="Fechar aviso">
          <FiX className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
