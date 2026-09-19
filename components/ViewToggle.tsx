'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FiList, FiGrid } from 'react-icons/fi'

interface ViewToggleProps {
  defaultView?: 'lista' | 'grid'
}

export default function ViewToggle({ defaultView = 'lista' }: ViewToggleProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<'lista' | 'grid'>(defaultView)
  const [language, setLanguage] = useState<'pt' | 'en' | 'es'>('pt')
  useEffect(() => {
    const lang = document.documentElement.lang || ''
    setLanguage(lang.startsWith('en') ? 'en' : lang.startsWith('es') ? 'es' : 'pt')
  }, [])
  const copy = language === 'en' ? { list: 'List', grid: 'Grid', listAria: 'List view', gridAria: 'Grid view' } : language === 'es' ? { list: 'Lista', grid: 'Cuadrícula', listAria: 'Vista de lista', gridAria: 'Vista de cuadrícula' } : { list: 'Lista', grid: 'Grade', listAria: 'Visualização em lista', gridAria: 'Visualização em grade' }

  useEffect(() => {
    const viewParam = searchParams.get('visualizacao')
    if (viewParam === 'grid' || viewParam === 'lista') {
      setView(viewParam)
    }
  }, [searchParams])

  const toggleView = (newView: 'lista' | 'grid') => {
    setView(newView)
    const params = new URLSearchParams(searchParams.toString())
    params.set('visualizacao', newView)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center space-x-2 bg-gray-900/50 border border-gray-800 rounded-lg p-1">
      <button
        onClick={() => toggleView('lista')}
        className={`flex items-center space-x-2 px-3 py-2 rounded transition-colors ${
          view === 'lista'
            ? 'bg-primary-600 text-white'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
        aria-label={copy.listAria}
      >
        <FiList className="w-4 h-4" />
        <span className="text-sm">{copy.list}</span>
      </button>
      <button
        onClick={() => toggleView('grid')}
        className={`flex items-center space-x-2 px-3 py-2 rounded transition-colors ${
          view === 'grid'
            ? 'bg-primary-600 text-white'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
        aria-label={copy.gridAria}
      >
        <FiGrid className="w-4 h-4" />
        <span className="text-sm">{copy.grid}</span>
      </button>
    </div>
  )
}
