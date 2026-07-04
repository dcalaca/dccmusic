'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiTrash2, FiLoader } from 'react-icons/fi'

interface DeleteVideoButtonProps {
  videoId: string
  videoTitle: string
}

export default function DeleteVideoButton({ videoId, videoTitle }: DeleteVideoButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir o vídeo "${videoTitle}"?`)) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/videos/${videoId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.refresh()
      } else {
        alert('Erro ao excluir vídeo')
      }
    } catch (error) {
      alert('Erro ao excluir vídeo')
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
