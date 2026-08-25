'use client'

import { useEffect } from 'react'

type SalesChartMode = 'quantity' | 'value'

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

function findSalesChartCard() {
  const heading = Array.from(document.querySelectorAll('h3')).find(
    node => node.textContent?.replace(/\s+/g, ' ').trim() === 'Valores e quantidades vendidas',
  )

  if (!heading) return null

  let current: HTMLElement | null = heading.parentElement
  while (current) {
    const classes = current.className || ''
    if (
      typeof classes === 'string' &&
      classes.includes('rounded-2xl') &&
      classes.includes('border') &&
      classes.includes('bg-gray-950/60')
    ) {
      return current
    }
    current = current.parentElement
  }

  return null
}

function parseBrazilianMoney(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseBrazilianInteger(value: string) {
  const parsed = Number(value.replace(/\./g, '').replace(/[^\d-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatChartMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatChartNumber(value: number) {
  return Math.round(value).toLocaleString('pt-BR')
}

function getSavedSalesChartMode(): SalesChartMode {
  try {
    const saved = window.localStorage.getItem('dcc-finance-sales-mode')
    return saved === 'value' ? 'value' : 'quantity'
  } catch {
    return 'quantity'
  }
}

function saveSalesChartMode(mode: SalesChartMode) {
  try {
    window.localStorage.setItem('dcc-finance-sales-mode', mode)
  } catch {
    // localStorage pode estar indisponível em alguns modos de navegação.
  }
}

function updateSalesToggleAppearance(button: HTMLButtonElement, mode: SalesChartMode) {
  const track = button.querySelector<HTMLElement>('[data-dcc-toggle-track]')
  const knob = button.querySelector<HTMLElement>('[data-dcc-toggle-knob]')
  const quantityLabel = button.querySelector<HTMLElement>('[data-dcc-toggle-quantity]')
  const valueLabel = button.querySelector<HTMLElement>('[data-dcc-toggle-value]')

  button.setAttribute('aria-pressed', mode === 'value' ? 'true' : 'false')

  if (track) {
    track.style.backgroundColor = mode === 'value' ? '#16a34a' : '#374151'
  }

  if (knob) {
    knob.style.transform = mode === 'value' ? 'translateX(16px)' : 'translateX(0)'
  }

  if (quantityLabel) {
    quantityLabel.style.color = mode === 'quantity' ? '#f9fafb' : '#6b7280'
  }

  if (valueLabel) {
    valueLabel.style.color = mode === 'value' ? '#86efac' : '#6b7280'
  }
}

function applySalesChartMode(card: HTMLElement, mode: SalesChartMode) {
  const svg = card.querySelector<SVGSVGElement>('svg')
  if (!svg) return

  const groups = Array.from(svg.querySelectorAll<SVGGElement>('g'))
  const points = groups.flatMap(group => {
    const title = group.querySelector('title')?.textContent || ''
    if (!title.includes('Valor:') || !title.includes('Quantidade:')) return []

    const amountMatch = title.match(/Valor:\s*R\$\s*([\d.]+,\d{2})/i)
    const countMatch = title.match(/Quantidade:\s*([\d.]+)/i)
    if (!amountMatch || !countMatch) return []

    const rects = Array.from(group.querySelectorAll<SVGRectElement>('rect'))
    const background = rects.find(rect => (rect.getAttribute('class') || '').includes('fill-gray-900/90'))
    if (!background) return []

    let bar = rects.find(rect => rect.getAttribute('data-dcc-sales-bar') === 'true') || null
    if (!bar) {
      bar = rects.find(rect => rect.getAttribute('fill') === '#22c55e') || null
      if (bar) bar.setAttribute('data-dcc-sales-bar', 'true')
    }

    return [{
      group,
      background,
      bar,
      amount: parseBrazilianMoney(amountMatch[1]),
      count: parseBrazilianInteger(countMatch[1]),
    }]
  })

  if (points.length === 0) return

  const maxMetric = Math.max(
    1,
    ...points.map(point => mode === 'value' ? point.amount : point.count),
  )

  for (const point of points) {
    const metric = mode === 'value' ? point.amount : point.count
    const backgroundY = Number(point.background.getAttribute('y') || 0)
    const backgroundHeight = Number(point.background.getAttribute('height') || 0)
    const barHeight = metric > 0 ? Math.max(2, (metric / maxMetric) * backgroundHeight) : 0

    let bar = point.bar
    if (!bar && metric > 0) {
      bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      bar.setAttribute('data-dcc-sales-bar', 'true')
      bar.setAttribute('rx', '7')
      bar.setAttribute('opacity', '0.9')
      point.background.parentNode?.insertBefore(bar, point.background.nextSibling)
    }

    if (!bar) continue

    bar.setAttribute('x', point.background.getAttribute('x') || '0')
    bar.setAttribute('width', point.background.getAttribute('width') || '0')
    bar.setAttribute('y', String(backgroundY + backgroundHeight - barHeight))
    bar.setAttribute('height', String(barHeight))
    bar.setAttribute('fill', mode === 'value' ? '#22c55e' : '#8b5cf6')
    bar.style.display = metric > 0 ? '' : 'none'
  }

  const textNodes = Array.from(svg.querySelectorAll<SVGTextElement>('text'))

  let leftAxisTitle = svg.querySelector<SVGTextElement>('[data-dcc-left-axis-title="true"]')
  if (!leftAxisTitle) {
    leftAxisTitle = textNodes.find(
      text => text.getAttribute('y') === '14' && text.getAttribute('text-anchor') !== 'end' && text.textContent?.trim() === 'Valor R$',
    ) || null
    leftAxisTitle?.setAttribute('data-dcc-left-axis-title', 'true')
  }

  let rightAxisTitle = svg.querySelector<SVGTextElement>('[data-dcc-right-axis-title="true"]')
  if (!rightAxisTitle) {
    rightAxisTitle = textNodes.find(
      text => text.getAttribute('y') === '14' && text.getAttribute('text-anchor') === 'end' && text.textContent?.trim() === 'Quantidade',
    ) || null
    rightAxisTitle?.setAttribute('data-dcc-right-axis-title', 'true')
  }

  if (leftAxisTitle) {
    const desiredTitle = mode === 'value' ? 'Valor R$' : 'Quantidade'
    if (leftAxisTitle.textContent !== desiredTitle) leftAxisTitle.textContent = desiredTitle
    leftAxisTitle.setAttribute(
      'class',
      mode === 'value'
        ? 'fill-green-300 text-[11px] font-semibold'
        : 'fill-primary-300 text-[11px] font-semibold',
    )

    const leftAxisX = Number(leftAxisTitle.getAttribute('x') || 72)
    const tickNodes = textNodes
      .filter(text => Math.abs(Number(text.getAttribute('x') || 0) - (leftAxisX - 10)) < 0.5)
      .sort((a, b) => Number(a.getAttribute('y') || 0) - Number(b.getAttribute('y') || 0))

    const ratios = [1, 0.5, 0]
    tickNodes.slice(0, 3).forEach((text, index) => {
      const nextText = mode === 'value'
        ? formatChartMoney(maxMetric * ratios[index])
        : formatChartNumber(maxMetric * ratios[index])
      if (text.textContent !== nextText) text.textContent = nextText
    })
  }

  if (rightAxisTitle) {
    rightAxisTitle.style.display = 'none'
    const rightAxisX = Number(rightAxisTitle.getAttribute('x') || 0)

    for (const text of textNodes) {
      const x = Number(text.getAttribute('x') || 0)
      if (x > rightAxisX && text !== rightAxisTitle) {
        text.style.display = 'none'
      }
    }

    for (const line of Array.from(svg.querySelectorAll<SVGLineElement>('line'))) {
      const x1 = Number(line.getAttribute('x1') || 0)
      const x2 = Number(line.getAttribute('x2') || 0)
      if (Math.abs(x1 - rightAxisX) < 0.5 && Math.abs(x2 - rightAxisX) < 0.5) {
        line.style.display = 'none'
      }
    }
  }

  const quantityLine = svg.querySelector<SVGPathElement>('path[stroke="#38bdf8"]')
  if (quantityLine) quantityLine.style.display = 'none'

  const subtitle = Array.from(card.querySelectorAll('p')).find(
    node => node.textContent?.includes('Barras mostram valor vendido'),
  )
  if (subtitle) {
    const nextSubtitle = mode === 'value'
      ? 'Barras mostram o valor vendido por dia.'
      : 'Barras mostram a quantidade de vendas por dia.'
    if (subtitle.textContent !== nextSubtitle) subtitle.textContent = nextSubtitle
  }

  card.setAttribute('data-dcc-sales-mode', mode)
}

function ensureSalesChartToggle() {
  const card = findSalesChartCard()
  if (!card) return

  const heading = Array.from(card.querySelectorAll('h3')).find(
    node => node.textContent?.replace(/\s+/g, ' ').trim() === 'Valores e quantidades vendidas',
  )
  if (!heading) return

  const header = heading.parentElement?.parentElement as HTMLElement | null
  if (!header) return

  let controls = header.children.item(1) as HTMLElement | null
  if (!controls) {
    controls = document.createElement('div')
    controls.className = 'flex flex-wrap gap-3 text-xs'
    header.appendChild(controls)
  }

  for (const child of Array.from(controls.children)) {
    const element = child as HTMLElement
    if (element.getAttribute('data-dcc-sales-toggle') !== 'true') {
      element.style.display = 'none'
    }
  }

  let button = controls.querySelector<HTMLButtonElement>('[data-dcc-sales-toggle="true"]')
  if (!button) {
    button = document.createElement('button')
    button.type = 'button'
    button.setAttribute('data-dcc-sales-toggle', 'true')
    button.setAttribute('aria-label', 'Alternar gráfico entre quantidade de vendas e valor vendido')
    button.className = 'inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-semibold transition hover:border-gray-600'

    const quantityLabel = document.createElement('span')
    quantityLabel.setAttribute('data-dcc-toggle-quantity', 'true')
    quantityLabel.textContent = 'Quantidade'

    const track = document.createElement('span')
    track.setAttribute('data-dcc-toggle-track', 'true')
    track.className = 'relative inline-block h-5 w-9 rounded-full transition-colors'

    const knob = document.createElement('span')
    knob.setAttribute('data-dcc-toggle-knob', 'true')
    knob.className = 'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform'
    track.appendChild(knob)

    const valueLabel = document.createElement('span')
    valueLabel.setAttribute('data-dcc-toggle-value', 'true')
    valueLabel.textContent = 'Valor'

    button.append(quantityLabel, track, valueLabel)
    controls.appendChild(button)

    button.addEventListener('click', () => {
      const currentMode: SalesChartMode = card.getAttribute('data-dcc-sales-mode') === 'value' ? 'value' : 'quantity'
      const nextMode: SalesChartMode = currentMode === 'value' ? 'quantity' : 'value'
      saveSalesChartMode(nextMode)
      applySalesChartMode(card, nextMode)
      updateSalesToggleAppearance(button!, nextMode)
    })
  }

  const mode = getSavedSalesChartMode()
  applySalesChartMode(card, mode)
  updateSalesToggleAppearance(button, mode)
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

      ensureSalesChartToggle()
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
