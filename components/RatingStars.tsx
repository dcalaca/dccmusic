'use client'

import { useState } from 'react'

interface RatingStarsProps {
  averageRating: number
  totalRatings: number
  userRating?: number
  onRate?: (rating: number) => void
  isAuthenticated: boolean
  onLoginRequired?: () => void
  size?: 'sm' | 'md' | 'lg'
}

// Componente de estrela SVG
function StarIcon({ filled, size }: { filled: boolean; size: string }) {
  return (
    <svg
      className={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  )
}

export default function RatingStars({
  averageRating,
  totalRatings,
  userRating,
  onRate,
  isAuthenticated,
  onLoginRequired,
  size = 'md',
}: RatingStarsProps) {
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  const handleStarClick = async (rating: number) => {
    if (!isAuthenticated) {
      onLoginRequired?.()
      return
    }

    if (isSubmitting || !onRate) return

    setIsSubmitting(true)
    try {
      await onRate(rating)
    } catch (error) {
      console.error('Erro ao avaliar:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Determinar qual rating mostrar nas estrelas
  // Prioridade: hover > userRating > média arredondada
  const displayRating = hoveredRating || userRating || (averageRating > 0 ? Math.round(averageRating) : 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Estrelas interativas */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = star <= displayRating
            return (
              <button
                key={star}
                type="button"
                onClick={() => handleStarClick(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(null)}
                disabled={isSubmitting || !isAuthenticated}
                className={`${sizeClasses[size]} transition-all ${
                  isFilled
                    ? 'text-yellow-400'
                    : 'text-gray-600'
                } ${
                  isAuthenticated && !isSubmitting
                    ? 'hover:scale-110 cursor-pointer'
                    : 'cursor-not-allowed opacity-50'
                }`}
                title={isAuthenticated ? `Avaliar com ${star} estrela${star > 1 ? 's' : ''}` : 'Faça login para avaliar'}
              >
                <StarIcon filled={isFilled} size="w-full h-full" />
              </button>
            )
          })}
        </div>
        
        {/* Informações de avaliação */}
        <div className="flex flex-col gap-1 text-sm">
          {userRating ? (
            <div className="text-gray-300">
              <span className="font-medium">Sua avaliação: </span>
              <span className="text-yellow-400 font-semibold">{userRating} estrela{userRating > 1 ? 's' : ''}</span>
            </div>
          ) : (
            <div className="text-gray-400">
              {isAuthenticated ? 'Clique nas estrelas para avaliar' : 'Faça login para avaliar'}
            </div>
          )}
          
          {averageRating > 0 && (
            <div className="text-gray-400">
              <span className="font-semibold text-white">{averageRating.toFixed(1)}</span>
              <span className="mx-1">•</span>
              <span>{totalRatings} avaliação{totalRatings !== 1 ? 'ões' : ''}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
