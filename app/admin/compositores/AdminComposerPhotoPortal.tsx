'use client'

import { useEffect } from 'react'

function findAvatarContainer(composerName: string) {
  const headings = Array.from(document.querySelectorAll('h1'))
  const heading = headings.find((item) => item.textContent?.trim() === composerName)
  const info = heading?.parentElement
  const row = info?.parentElement
  const avatar = row?.firstElementChild as HTMLElement | null
  return avatar
}

export default function AdminComposerPhotoPortal() {
  useEffect(() => {
    const match = window.location.pathname.match(/^\/admin\/compositores\/([^/]+)$/)
    if (!match) return

    const composerId = match[1]
    let cancelled = false

    const applyPhoto = async () => {
      try {
        const response = await fetch(`/api/admin/composers/${encodeURIComponent(composerId)}`, { cache: 'no-store' })
        const composer = await response.json()
        if (!response.ok || cancelled) return

        const photoUrl = String(
          composer?.profilePhotoUrl ||
          composer?.profile_photo_url ||
          ''
        ).trim()

        if (!photoUrl) return

        const render = () => {
          const avatar = findAvatarContainer(String(composer?.name || ''))
          if (!avatar) return false

          avatar.style.backgroundImage = `url("${photoUrl.replace(/"/g, '%22')}")`
          avatar.style.backgroundSize = 'cover'
          avatar.style.backgroundPosition = 'center'
          avatar.style.backgroundRepeat = 'no-repeat'
          avatar.style.cursor = 'zoom-in'
          avatar.setAttribute('title', 'Clique para abrir a foto do compositor')
          avatar.setAttribute('role', 'button')
          avatar.setAttribute('tabindex', '0')

          const icon = avatar.querySelector('svg') as HTMLElement | null
          if (icon) icon.style.display = 'none'

          const openPhoto = () => window.open(photoUrl, '_blank', 'noopener,noreferrer')
          avatar.onclick = openPhoto
          avatar.onkeydown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openPhoto()
            }
          }
          return true
        }

        if (render()) return
        const observer = new MutationObserver(() => {
          if (render()) observer.disconnect()
        })
        observer.observe(document.body, { childList: true, subtree: true })
        window.setTimeout(() => observer.disconnect(), 10000)
      } catch (error) {
        console.warn('[ADMIN COMPOSER PHOTO] Não foi possível carregar a foto:', error)
      }
    }

    void applyPhoto()
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
