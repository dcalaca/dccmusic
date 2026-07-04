'use client'

import { useState, useEffect } from 'react'
import { FiX, FiPlus } from 'react-icons/fi'

interface ComposerSelectorProps {
  selectedComposers: string[]
  onChange: (composers: string[]) => void
}

export default function ComposerSelector({ selectedComposers, onChange }: ComposerSelectorProps) {
  const [composers, setComposers] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [newComposer, setNewComposer] = useState('')
  const [showNewInput, setShowNewInput] = useState(false)

  useEffect(() => {
    const fetchComposers = async () => {
      try {
        const res = await fetch('/api/admin/composers/list')
        if (res.ok) {
          const data = await res.json()
          setComposers(data)
        }
      } catch (error) {
        console.error('Erro ao buscar compositores:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchComposers()
  }, [])

  const handleAddComposer = (composerName: string) => {
    if (composerName.trim() && !selectedComposers.includes(composerName.trim())) {
      onChange([...selectedComposers, composerName.trim()])
    }
    setNewComposer('')
    setShowNewInput(false)
  }

  const handleRemoveComposer = (composerName: string) => {
    onChange(selectedComposers.filter(c => c !== composerName))
  }

  const handleSelectExisting = (composerName: string) => {
    if (!selectedComposers.includes(composerName)) {
      onChange([...selectedComposers, composerName])
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium mb-2">
        Compositores
      </label>
      
      {/* Compositores selecionados */}
      {selectedComposers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedComposers.map((composer) => (
            <span
              key={composer}
              className="inline-flex items-center gap-2 px-3 py-1 bg-primary-600/20 text-primary-300 border border-primary-800 rounded-lg text-sm"
            >
              {composer}
              <button
                type="button"
                onClick={() => handleRemoveComposer(composer)}
                className="hover:text-red-400 transition-colors"
              >
                <FiX className="w-4 h-4" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Adicionar novo compositor */}
      {showNewInput ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newComposer}
            onChange={(e) => setNewComposer(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddComposer(newComposer)
              }
            }}
            placeholder="Nome do compositor"
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
            autoFocus
          />
          <button
            type="button"
            onClick={() => handleAddComposer(newComposer)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            Adicionar
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNewInput(false)
              setNewComposer('')
            }}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          {!loading && composers.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleSelectExisting(e.target.value)
                  e.target.value = ''
                }
              }}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
            >
              <option value="">Selecione um compositor existente</option>
              {composers
                .filter(c => !selectedComposers.includes(c.name))
                .map((composer) => (
                  <option key={composer.id} value={composer.name}>
                    {composer.name}
                  </option>
                ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowNewInput(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FiPlus className="w-4 h-4" />
            <span>Novo</span>
          </button>
        </div>
      )}
    </div>
  )
}
