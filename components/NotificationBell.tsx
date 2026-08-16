'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FiBell } from 'react-icons/fi'
import { formatDateShort } from '@/lib/utils'

type NotificationItem = {
  id: string
  type: 'comment' | 'reply' | 'comment_like' | 'new_music'
  title: string
  body: string | null
  href: string | null
  actorName: string | null
  readAt: string | null
  createdAt: string
}

type NotificationBellProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function NotificationBell({ open, onOpenChange }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)

  const getToken = () => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('composer_token')
  }

  const loadNotifications = async () => {
    const token = getToken()
    if (!token) {
      setUnreadCount(0)
      setNotifications([])
      return
    }

    try {
      const response = await fetch('/api/compositores/notifications?limit=30', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!response.ok) return
      const data = await response.json()
      setUnreadCount(Number(data.unreadCount) || 0)
      setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
    } catch (error) {
      console.error('Erro ao carregar notificações:', error)
    }
  }

  const markAllRead = async () => {
    const token = getToken()
    if (!token || unreadCount === 0) return

    setUnreadCount(0)
    try {
      await fetch('/api/compositores/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ all: true }),
      })
      setNotifications((current) =>
        current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() }))
      )
    } catch (error) {
      console.error('Erro ao marcar notificações como lidas:', error)
    }
  }

  useEffect(() => {
    loadNotifications()
    const timer = window.setInterval(loadNotifications, 30000)
    const onFocus = () => loadNotifications()
    window.addEventListener('focus', onFocus)
    window.addEventListener('authChange', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('authChange', onFocus)
    }
  }, [])

  const handleToggle = async () => {
    const nextOpen = !open
    onOpenChange(nextOpen)
    if (nextOpen) {
      setLoading(true)
      await loadNotifications()
      setLoading(false)
      await markAllRead()
    }
  }

  return (
    <div className="relative z-[120]">
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        title="Notificações"
        aria-label="Notificações"
      >
        <FiBell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-black" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[130] mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-2xl shadow-black/50">
          <div className="border-b border-gray-700 px-4 py-3">
            <div className="text-sm font-bold text-white">Notificações</div>
            <div className="text-xs text-gray-400">Comentários, respostas, curtidas e músicas prontas</div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">Carregando...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">Nenhuma notificação ainda.</div>
            ) : (
              notifications.map((item) => (
                <Link
                  key={item.id}
                  href={item.href || '/compositores/admin'}
                  onClick={() => onOpenChange(false)}
                  className="block border-b border-gray-800 px-4 py-3 transition-colors last:border-b-0 hover:bg-gray-800"
                >
                  <div className="text-sm font-medium text-white">{item.title}</div>
                  {item.body && (
                    <div className="mt-1 line-clamp-2 text-xs text-gray-400">{item.body}</div>
                  )}
                  <div className="mt-1 text-[11px] text-gray-500">{formatDateShort(item.createdAt)}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
