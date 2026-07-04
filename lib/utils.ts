import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
}

export function extractYoutubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

/** Fuso fixo para datas no site — evita divergência SSR (UTC na Vercel) vs navegador (Brasil). */
const BRAZIL_TZ = 'America/Sao_Paulo'

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TZ,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

/** Data curta — mesmo resultado no Node e no browser (hidratação). */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/** Inteiros com separador de milhares (.) — idêntico no servidor e no cliente (toLocaleString varia). */
export function formatIntegerPtBR(n: number): string {
  const v = Math.max(0, Math.floor(Number(n)) || 0)
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
