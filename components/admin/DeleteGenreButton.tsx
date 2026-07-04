'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiTrash2, FiLoader } from 'react-icons/fi'

interface DeleteGenreButtonProps {
  genreId: string
  genreName: string
}

export default function DeleteGenreButton({ genreId, genreName }: DeleteGenreButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir o gênero "${genreName}"?`)) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/generos/${genreId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.refresh()
      } else {
        alert('Erro ao excluir gênero')
      }
    } catch (error) {
      alert('Erro ao excluir gênero')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="p-2 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
    >
      {loading ? (
        <FiLoader className="w-5 h-5 animate-spin" />
      ) : (
        <FiTrash2 className="w-5 h-5" />
      )}
    </button>
  )
}
