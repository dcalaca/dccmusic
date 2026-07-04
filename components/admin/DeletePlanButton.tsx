'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiTrash2, FiLoader } from 'react-icons/fi'

interface DeletePlanButtonProps {
  planId: string
  planName: string
}

export default function DeletePlanButton({ planId, planName }: DeletePlanButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja desativar o plano "${planName}"?\n\nIsso marcará o plano como inativo, mas não afetará assinaturas existentes.`)) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao desativar plano')
      }
    } catch (error) {
      alert('Erro ao desativar plano')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="px-4 py-2 bg-red-900/50 hover:bg-red-900/70 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center space-x-2"
    >
      {loading ? (
        <FiLoader className="w-4 h-4 animate-spin" />
      ) : (
        <FiTrash2 className="w-4 h-4" />
      )}
    </button>
  )
}
