'use client'

import { useEffect, useState } from 'react'

type HeroImageCarouselProps = {
  images: string[]
  mobileImages?: string[]
  intervalMs?: number
  className?: string
}

export default function HeroImageCarousel({
  images,
  mobileImages,
  intervalMs = 3000,
  className = '',
}: HeroImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const slideCount = images.length

  useEffect(() => {
    if (slideCount <= 1) return

    const interval = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % slideCount)
    }, intervalMs)

    return () => window.clearInterval(interval)
  }, [slideCount, intervalMs])

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {[activeIndex, (activeIndex + 1) % slideCount]
        .filter((index, position, indexes) => indexes.indexOf(index) === position)
        .map((index) => {
          const image = images[index]
          const mobileImage = mobileImages?.[index] || image
          const isActive = index === activeIndex

          return (
            <div key={`${image}-${index}`} className={`absolute inset-0 transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
              <div
                className="absolute inset-0 hidden bg-cover bg-no-repeat md:block"
                style={{ backgroundImage: `url("${image}")`, backgroundPosition: 'center 14%' }}
              />
              <div
                className="absolute inset-0 bg-cover bg-no-repeat md:hidden"
                style={{ backgroundImage: `url("${mobileImage}")`, backgroundPosition: 'center center' }}
              />
            </div>
          )
        })}
    </div>
  )
}
