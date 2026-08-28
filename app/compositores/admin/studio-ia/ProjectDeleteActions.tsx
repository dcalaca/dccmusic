'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const PROJECT_HREF_PREFIX = '/compositores/admin/studio-ia/projetos/'

function extractProjectId(card: Element) {
  const projectLink = card.querySelector<HTMLAnchorElement>(`a[href^="${PROJECT_HREF_PREFIX}"]`)
  if (!projectLink) return null

  const pathname = new URL(projectLink.href, window.location.origin).pathname
  const id = pathname.slice(PROJECT_HREF_PREFIX.length).split('/')[0]
  return id || null
}

export default function ProjectDeleteActions() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname !== '/compositores/admin/studio-ia/projetos') return

    let disposed = false

    const enhanceMenus = () => {
      if (disposed) return

      const inspirationButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter(
        (button) => button.textContent?.trim().includes('Usar de inspiração')
      )

      inspirationButtons.forEach((inspirationButton) => {
        const menu = inspirationButton.parentElement
        if (!menu || menu.querySelector('[data-dcc-delete-project]')) return

        const card = menu.closest('.group.relative')
        if (!card) return

        const projectId = extractProjectId(card)
        if (!projectId) return

        const deleteButton = document.createElement('button')
        deleteButton.type = 'button'
        deleteButton.dataset.dccDeleteProject = projectId
        deleteButton.className = 'flex w-full items-center gap-2 border-t border-gray-800 px-4 py-3 text-left text-sm font-bold text-red-300 hover:bg-red-950/40 hover:text-red-200 disabled:opacity-60'
        deleteButton.innerHTML = '<span aria-hidden="true" class="text-base">🗑️</span><span>Excluir projeto</span>'

        deleteButton.addEventListener('click', async (event) => {
          event.preventDefault()
          event.stopPropagation()

          const projectTitle = card.querySelector('h3')?.textContent?.trim() || 'este projeto'
          const confirmed = window.confirm(`Excluir “${projectTitle}”? Esta ação é permanente e não pode ser desfeita.`)
          if (!confirmed) return

          const token = localStorage.getItem('composer_token')
          if (!token) {
            window.location.href = `/compositores/login?redirect=${encodeURIComponent('/compositores/admin/studio-ia/projetos')}`
            return
          }

          deleteButton.disabled = true
          deleteButton.innerHTML = '<span aria-hidden="true">⏳</span><span>Excluindo...</span>'

          try {
            const response = await fetch(`/api/compositores/studio/projects/${projectId}/delete`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            })
            const data = await response.json().catch(() => ({}))

            if (response.status === 401) {
              localStorage.removeItem('composer_token')
              window.location.href = `/compositores/login?redirect=${encodeURIComponent('/compositores/admin/studio-ia/projetos')}`
              return
            }

            if (!response.ok) {
              throw new Error(data.error || 'Não foi possível excluir o projeto.')
            }

            card.remove()
          } catch (error: any) {
            window.alert(error?.message || 'Não foi possível excluir o projeto.')
            deleteButton.disabled = false
            deleteButton.innerHTML = '<span aria-hidden="true" class="text-base">🗑️</span><span>Excluir projeto</span>'
          }
        })

        menu.appendChild(deleteButton)
      })
    }

    enhanceMenus()
    const observer = new MutationObserver(enhanceMenus)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      disposed = true
      observer.disconnect()
    }
  }, [pathname])

  return null
}
