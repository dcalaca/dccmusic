'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type DaySummary = {
  date: string
  amount: string
  count: string
}

function isFinanceSalesChart(svg: SVGSVGElement | null) {
  if (!svg) return false
  const className = svg.getAttribute('class') || ''
  return className.includes('min-w-[1180px]') && className.includes('h-[22rem]')
}

function parseDaySummary(value: string): DaySummary | null {
  const lines = value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  if (lines.length < 3) return null

  const amountLine = lines.find(line => line.startsWith('Valor:'))
  const countLine = lines.find(line => line.startsWith('Quantidade:'))
  if (!amountLine || !countLine) return null

  return {
    date: lines[0],
    amount: amountLine.replace(/^Valor:\s*/, ''),
    count: countLine.replace(/^Quantidade:\s*/, ''),
  }
}

export default function FinanceChartTapDetails() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [selectedDay, setSelectedDay] = useState<DaySummary | null>(null)

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.dcc-finance-no-cursor')
    if (!root) return

    const updatePortalTarget = () => {
      const chartSvg = Array.from(root.querySelectorAll<SVGSVGElement>('svg'))
        .find(svg => isFinanceSalesChart(svg))
      const chartCard = chartSvg?.parentElement?.parentElement
      setPortalTarget(chartCard instanceof HTMLElement ? chartCard : null)
    }

    const handleClick = (event: Event) => {
      const clickedElement = event.target instanceof Element ? event.target : null
      const svg = clickedElement?.closest('svg') as SVGSVGElement | null
      if (!isFinanceSalesChart(svg)) return

      const group = clickedElement?.closest('g')
      const title = group?.querySelector('title')?.textContent?.trim()
      if (!title) return

      const summary = parseDaySummary(title)
      if (summary) setSelectedDay(summary)
    }

    updatePortalTarget()
    root.addEventListener('click', handleClick)

    const observer = new MutationObserver(updatePortalTarget)
    observer.observe(root, { childList: true, subtree: true })

    return () => {
      root.removeEventListener('click', handleClick)
      observer.disconnect()
    }
  }, [])

  if (!portalTarget) return null

  return createPortal(
    <div className="mt-3 border-t border-gray-800 pt-3" aria-live="polite">
      {selectedDay ? (
        <div className="rounded-xl border border-green-800/70 bg-green-950/20 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-400">Resumo do dia</p>
              <p className="mt-1 font-bold text-white">{selectedDay.date}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="rounded-lg border border-gray-700 px-2.5 py-1 text-xs text-gray-400 transition hover:border-gray-500 hover:text-white"
            >
              Fechar
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
              <p className="text-xs text-gray-500">Valor vendido</p>
              <p className="mt-1 text-lg font-bold text-green-300">{selectedDay.amount}</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
              <p className="text-xs text-gray-500">Quantidade</p>
              <p className="mt-1 text-lg font-bold text-sky-300">{selectedDay.count}</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">Toque em outra barra para trocar o dia.</p>
        </div>
      ) : (
        <p className="text-center text-xs text-gray-500 sm:text-left">
          No celular, toque em uma barra para ver o valor e a quantidade de vendas daquele dia.
        </p>
      )}
    </div>,
    portalTarget
  )
}
