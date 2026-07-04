'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiTrash2, FiLoader } from 'react-icons/fi'

interface DeleteMusicButtonProps {
  musicId: string
  musicTitle: string
}

export default function DeleteMusicButton({ musicId, musicTitle }: DeleteMusicButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir a música "${musicTitle}"?`)) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/musicas/${musicId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.refresh()
      } else {
        alert('Erro ao excluir música')
      }
    } catch (error) {
      alert('Erro ao excluir música')
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
