'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { FiArrowLeft, FiLoader } from 'react-icons/fi'

export default function EditMusicBySlugPage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadMusicId = async () => {
      try {
        // Buscar música pelo slug para obter o ID
        const response = await fetch(`/api/musics/all`)
        
        if (response.ok) {
          const data = await response.json()
          const music = data.musics?.find((m: any) => m.slug === params.slug)
          
          if (music && music.id) {
            // Redirecionar para a página de edição com o ID
            router.push(`/compositores/admin/musicas/${music.id}/editar`)
          } else {
            setError(t('composerSongs.notFound'))
            setLoading(false)
          }
        } else {
          setError(t('composerSongs.searchError'))
          setLoading(false)
        }
      } catch (err) {
        console.error('Erro ao carregar música:', err)
        setError(t('composerSongs.loadError'))
        setLoading(false)
      }
    }

    loadMusicId()
  }, [params.slug, router])

  if (loading) {
    return (
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="text-center">
          <FiLoader className="w-12 h-12 animate-spin text-primary-400 mx-auto mb-4" />
          <p className="text-gray-400">{t('composerSongs.loading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/compositores/admin/musicas"
              className="inline-flex items-center space-x-2 text-primary-400 hover:text-primary-300 mb-6"
            >
              <FiArrowLeft className="w-4 h-4" />
              <span>{t('composerSongs.back')}</span>
            </Link>
            <div className="bg-red-900/50 border border-red-800 rounded-lg p-8 text-center">
              <h2 className="text-2xl font-bold mb-4 text-red-300">
                {t('composerSongs.error')}
              </h2>
              <p className="text-gray-400 mb-6">{error}</p>
              <Link
                href="/compositores/admin/musicas"
                className="inline-block px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors font-medium"
              >
                {t('composerSongs.backToSongs')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
