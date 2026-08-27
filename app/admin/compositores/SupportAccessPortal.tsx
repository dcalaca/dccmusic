'use client'

import { useEffect } from 'react'

function findActionGrid() {
  const studioLink = document.querySelector('a[href*="/admin/compositores/"][href$="/studio"]')
  return studioLink?.parentElement as HTMLElement | null
}

export default function SupportAccessPortal() {
  useEffect(() => {
    const match = window.location.pathname.match(/^\/admin\/compositores\/([^/]+)$/)
    if (!match) return

    const composerId = match[1]
    let cancelled = false

    const renderButton = () => {
      const grid = findActionGrid()
      if (!grid || grid.querySelector('[data-support-access-button="true"]')) return Boolean(grid)

      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.supportAccessButton = 'true'
      button.className = 'rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50'
      button.textContent = 'Acessar como usuário'
      button.title = 'Entrar temporariamente na área deste usuário para atendimento'

      button.onclick = async () => {
        if (button.disabled) return
        button.disabled = true
        const originalLabel = button.textContent
        button.textContent = 'Abrindo...'

        // Abre a aba durante o clique para evitar bloqueio de popup no celular/navegador.
        const supportTab = window.open('about:blank', '_blank')

        try {
          const response = await fetch(`/api/admin/composers/${encodeURIComponent(composerId)}/support-access`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
          const data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(data.details || data.error || 'Não foi possível acessar o usuário')

          localStorage.setItem('composer_token', data.token)
          localStorage.setItem('composer_data', JSON.stringify(data.composer))
          localStorage.setItem('composer_support_mode', JSON.stringify({
            composerId: data.composer?.id,
            composerName: data.composer?.name,
            startedAt: new Date().toISOString(),
            expiresInMinutes: data.expiresInMinutes || 60,
          }))

          if (supportTab) {
            supportTab.location.href = '/compositores/admin'
          } else {
            window.location.href = '/compositores/admin'
          }
        } catch (error: any) {
          if (supportTab) supportTab.close()
          window.alert(`Erro: ${error?.message || 'Não foi possível acessar o usuário'}`)
        } finally {
          if (!cancelled) {
            button.disabled = false
            button.textContent = originalLabel || 'Acessar como usuário'
          }
        }
      }

      // Deixa o acesso de suporte em destaque e ocupando a largura inteira da grade.
      button.style.gridColumn = '1 / -1'
      grid.prepend(button)
      return true
    }

    if (renderButton()) return

    const observer = new MutationObserver(() => {
      if (renderButton()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    window.setTimeout(() => observer.disconnect(), 10000)

    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [])

  return null
}
