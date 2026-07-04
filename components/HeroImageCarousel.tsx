'use client'

import { useEffect, useState } from 'react'

type HeroImageCarouselProps = {
  images: string[]
  intervalMs?: number
  className?: string
}

export default function HeroImageCarousel({
  images,
  intervalMs = 3000,
  className = '',
}: HeroImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (images.length <= 1) return

    const interval = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % images.length)
    }, intervalMs)

    return () => window.clearInterval(interval)
  }, [images.length, intervalMs])

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {images.map((image, index) => (
        <div
          key={image}
          className={`absolute inset-0 bg-cover bg-no-repeat transition-opacity duration-1000 ${
            index === activeIndex ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            backgroundImage: `url("${image}")`,
            backgroundPosition: 'center 14%',
          }}
        />
      ))}
    </div>
  )
}
