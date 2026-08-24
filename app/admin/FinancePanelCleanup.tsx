'use client'

import { useEffect } from 'react'

export default function FinancePanelCleanup() {
  useEffect(() => {
    const hideFinanceEmailBlocks = () => {
      const headings = Array.from(document.querySelectorAll('h3, p'))

      for (const node of headings) {
        const text = node.textContent?.trim()

        if (text === 'E-mails e Brevo') {
          const card = node.closest('div.bg-gray-950\/50.border.border-gray-800.rounded-xl') as HTMLElement | null
          if (card) card.style.display = 'none'
        }

        if (text === 'Brevo (e-mails)' || text === 'Cursor (programação)') {
          const card = node.closest('div.border.border-gray-800.rounded-lg.p-3') as HTMLElement | null
          if (card) card.style.display = 'none'
        }
      }
    }

    hideFinanceEmailBlocks()
    const observer = new MutationObserver(hideFinanceEmailBlocks)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return null
}
