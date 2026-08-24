'use client'

import { useEffect } from 'react'

function findFinanceCard(node: Element, kind: 'section' | 'item') {
  let current: HTMLElement | null = node.parentElement

  while (current) {
    const classes = current.className || ''

    if (
      kind === 'section' &&
      typeof classes === 'string' &&
      classes.includes('bg-gray-950/50') &&
      classes.includes('rounded-xl') &&
      classes.includes('p-4')
    ) {
      return current
    }

    if (
      kind === 'item' &&
      typeof classes === 'string' &&
      classes.includes('rounded-lg') &&
      classes.includes('p-3')
    ) {
      return current
    }

    current = current.parentElement
  }

  return null
}

export default function FinancePanelCleanup() {
  useEffect(() => {
    const clean = () => {
      const nodes = Array.from(document.querySelectorAll('h3, p'))

      for (const node of nodes) {
        const text = node.textContent?.replace(/\s+/g, ' ').trim()

        if (text === 'E-mails e Brevo') {
          const card = findFinanceCard(node, 'section')
          if (card) {
            card.style.setProperty('display', 'none', 'important')
            card.setAttribute('data-dcc-hidden', 'emails-brevo')
          }
        }

        if (text === 'Brevo (e-mails)' || text === 'Cursor (programação)') {
          const card = findFinanceCard(node, 'item')
          if (card) {
            card.style.setProperty('display', 'none', 'important')
            card.setAttribute('data-dcc-hidden', text === 'Brevo (e-mails)' ? 'brevo-cost' : 'cursor-cost')
          }
        }
      }
    }

    clean()
    const observer = new MutationObserver(clean)
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })

    const interval = window.setInterval(clean, 500)
    const timeout = window.setTimeout(() => window.clearInterval(interval), 10000)

    return () => {
      observer.disconnect()
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [])

  return null
}
