'use client'

import { useEffect } from 'react'

const TITLE_MAX_LENGTH = 30

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function shortenTitle(value: string) {
  const clean = value
    .replace(/^[-–—"'“”‘’]+|[-–—"'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!clean) return 'Nova música'
  if (clean.length <= TITLE_MAX_LENGTH) return clean

  const preview = clean.slice(0, TITLE_MAX_LENGTH + 1)
  const lastSpace = preview.lastIndexOf(' ')
  return (lastSpace >= 12 ? preview.slice(0, lastSpace) : clean.slice(0, TITLE_MAX_LENGTH)).trim()
}

function deriveTitleFromLyric(lyric: string) {
  const lines = lyric
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const sectionLine = /^\[[^\]]+\]$/
  const chorusLine = /^\[(refr[aã]o|coro|estribillo|chorus)\]$/i
  const chorusIndex = lines.findIndex((line) => chorusLine.test(line))

  const candidate = chorusIndex >= 0
    ? lines.slice(chorusIndex + 1).find((line) => !sectionLine.test(line))
    : lines.find((line) => !sectionLine.test(line))

  return shortenTitle(candidate || 'Nova música')
}

function findTitleInput() {
  const labels = Array.from(document.querySelectorAll('label'))
  const titleLabel = labels.find((label) => label.textContent?.trim() === 'Nome da música')
  const wrapper = titleLabel?.parentElement?.parentElement
  return wrapper?.querySelector('input') as HTMLInputElement | null
}

export default function AutoMusicTitleHelper() {
  useEffect(() => {
    if (window.location.pathname !== '/compositores/admin/studio-ia/novo') return

    let replaying = false

    const handleClick = (event: MouseEvent) => {
      if (replaying) return

      const button = (event.target as HTMLElement | null)?.closest('button') as HTMLButtonElement | null
      if (!button) return

      const text = (button.textContent || '').replace(/\s+/g, ' ').trim()
      const creatingWithAi = text.includes('Criar minha música')
      const savingOwnLyric = text.includes('Salvar e Criar Projeto')
      if (!creatingWithAi && !savingOwnLyric) return

      const input = findTitleInput()
      if (!input || input.value.trim()) return

      const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null
      const automaticTitle = savingOwnLyric
        ? deriveTitleFromLyric(textarea?.value || '')
        : 'Nova música'

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()

      setNativeInputValue(input, automaticTitle)

      // Dá um ciclo ao React para atualizar o estado antes de reenviar o clique.
      window.setTimeout(() => {
        replaying = true
        button.click()
        window.setTimeout(() => {
          replaying = false
        }, 0)
      }, 0)
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  return null
}
