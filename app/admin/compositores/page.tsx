'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { FiUser, FiMail, FiCalendar, FiCheckCircle, FiXCircle, FiRefreshCw, FiSearch, FiEdit2, FiMusic, FiVideo, FiEye, FiKey, FiFileText, FiDownload, FiTrash2, FiCreditCard, FiGift } from 'react-icons/fi'

interface Composer {
  id: string
  name: string
  slug: string
  email?: string
  emailVerified?: boolean
  emailVerifiedAt?: Date | null
  hasActiveSubscription?: boolean
  subscriptionExpiresAt?: Date | null
  isPremium?: boolean
  createdAt: Date
  videoCount?: number
  musicCount?: number
  totalViews?: number
  studioLyricCount?: number
  studioMusicCount?: number
  studioCreditBalance?: number
  studioMusicBalance?: number
  totalPlanPaid?: number
  totalTopupPaid?: number
  totalPlanAndTopupPaid?: number
  musicComments?: number
  videoComments?: number
  studioMusicComments?: number
  totalComments?: number
  musicRatings?: number
  videoRatings?: number
  studioMusicRatings?: number
  totalRatings?: number
}

interface SpendingRankingItem {
  position: number
  composerId: string
  name: string
  email: string
  slug: string
  createdAt?: string | null
  totalSpent: number
  planSpent: number
  topupSpent: number
  featuredSpent: number
  paymentCount: number
}

const PAGE_SIZE = 100

type AdminComposersSummary = {
  total: number
  active: number
  inactive: number
  pendingEmail: number
  withStudio: number
  studioLyrics: number
  studioMusics: number
}

const EMPTY_SUMMARY: AdminComposersSummary = {
  total: 0,
  active: 0,
  inactive: 0,
  pendingEmail: 0,
  withStudio: 0,
  studioLyrics: 0,
  studioMusics: 0,
}

export default function AdminComposersPage() {
  const [composers, setComposers] = useState<Composer[]>([])
  const [summary, setSummary] = useState<AdminComposersSummary>(EMPTY_SUMMARY)
  const [listTotal, setListTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'studio' | 'pending'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const [spendingRankingOpen, setSpendingRankingOpen] = useState(false)
  const [spendingRankingLoading, setSpendingRankingLoading] = useState(false)
  const [spendingRanking, setSpendingRanking] = useState<SpendingRankingItem[]>([])
  const [spendingTotal, setSpendingTotal] = useState(0)
  const [editingComposer, setEditingComposer] = useState<Composer | null>(null)
  const [editForm, setEditForm] = useState({ name: '', slug: '', email: '' })
  const [creditComposer, setCreditComposer] = useState<Composer | null>(null)
  const [emailComposer, setEmailComposer] = useState<Composer | null>(null)
  const [creditForm, setCreditForm] = useState({
    musicQuantity: '2',
    reason: 'Correção de saldo do Studio IA',
    message: 'Identificamos o erro na recarga e creditamos músicas como compensação pelo transtorno.',
    sendEmail: true,
  })
  const [emailForm, setEmailForm] = useState({
    email: '',
    subject: '',
    message: '',
  })

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim())
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [searchTerm])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, statusFilter])

  const loadComposers = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(PAGE_SIZE),
        status: statusFilter,
      })
      if (debouncedSearch) {
        params.set('search', debouncedSearch)
      }

      const response = await fetch(`/api/admin/composers/list?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Erro ao carregar compositores')
      }
      const data = await response.json()
      setComposers(Array.isArray(data.items) ? data.items : [])
      setListTotal(Number(data.total) || 0)
      setTotalPages(Math.max(1, Number(data.totalPages) || 1))
      setSummary(data.summary || EMPTY_SUMMARY)
    } catch (error) {
      console.error('Erro ao carregar compositores:', error)
      alert('Erro ao carregar compositores')
    } finally {
      setLoading(false)
    }
  }, [currentPage, debouncedSearch, statusFilter])

  useEffect(() => {
    loadComposers()
  }, [loadComposers])

  const handleGrantAccess = async (composerId: string, durationYears: number = 10) => {
    if (!confirm(`Liberar acesso de graça por ${durationYears} anos?`)) {
      return
    }

    try {
      setActionLoading(composerId)
      const response = await fetch(`/api/admin/composers/${composerId}/subscription`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'grant',
          durationYears,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Erro ao liberar acesso')
      }

      alert('Acesso liberado com sucesso!')
      loadComposers()
    } catch (error: any) {
      console.error('Erro ao liberar acesso:', error)
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRevokeAccess = async (composerId: string) => {
    if (!confirm('Revogar acesso deste compositor?')) {
      return
    }

    try {
      setActionLoading(composerId)
      const response = await fetch(`/api/admin/composers/${composerId}/subscription`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'revoke',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Erro ao revogar acesso')
      }

      alert('Acesso revogado com sucesso!')
      loadComposers()
    } catch (error: any) {
      console.error('Erro ao revogar acesso:', error)
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleResetPassword = async (composerId: string, composerName: string) => {
    if (!confirm(`Deseja resetar a senha do compositor "${composerName}" para "123"?\n\nO compositor precisará criar uma nova senha ao fazer login.`)) {
      return
    }

    try {
      setActionLoading(composerId)
      const response = await fetch(`/api/admin/composers/${composerId}/reset-password`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao resetar senha')
      }

      alert('Senha resetada com sucesso! A nova senha temporária é "123".')
      loadComposers()
    } catch (error: any) {
      console.error('Erro ao resetar senha:', error)
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleActivateAccount = async (composerId: string, composerName: string) => {
    if (!confirm(`Ativar manualmente a conta do compositor "${composerName}"?\n\nIsso confirma o e-mail e define a senha padrão como "123".`)) {
      return
    }

    try {
      setActionLoading(composerId)
      const response = await fetch(`/api/admin/composers/${composerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'activate_account' }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Erro ao ativar conta')
      }

      alert('Conta ativada com sucesso! A senha padrão é "123".')
      loadComposers()
    } catch (error: any) {
      console.error('Erro ao ativar conta:', error)
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteComposer = async (composer: Composer) => {
    const confirmed = confirm(
      `Tem certeza que deseja excluir o compositor "${composer.name}"?\n\n` +
      `Email: ${composer.email || 'Sem email'}\n\n` +
      'Esta ação apaga o cadastro, login, assinatura, pagamentos, projetos do Studio IA, letras e músicas IA deste usuário.\n\n' +
      'As músicas e vídeos públicos do site não serão apagados, mas deixarão de ficar vinculados a este compositor.\n\n' +
      'Esta ação não pode ser desfeita.'
    )

    if (!confirmed) return

    try {
      setActionLoading(composer.id)
      const response = await fetch(`/api/admin/composers/${composer.id}`, {
        method: 'DELETE',
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Erro ao excluir compositor')
      }

      setComposers((currentComposers) => currentComposers.filter((item) => item.id !== composer.id))
      alert('Compositor excluído com sucesso.')
    } catch (error: any) {
      console.error('Erro ao excluir compositor:', error)
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleEditClick = (composer: Composer) => {
    setEditingComposer(composer)
    setEditForm({
      name: composer.name,
      slug: composer.slug,
      email: composer.email || '',
    })
  }

  const handleEditCancel = () => {
    setEditingComposer(null)
    setEditForm({ name: '', slug: '', email: '' })
  }

  const handleCreditClick = (composer: Composer) => {
    setCreditComposer(composer)
    setCreditForm({
      musicQuantity: '2',
      reason: 'Correção de saldo do Studio IA',
      message: 'Identificamos o erro na recarga e creditamos músicas como compensação pelo transtorno.',
      sendEmail: true,
    })
  }

  const handleCreditCancel = () => {
    setCreditComposer(null)
  }

  const handleEmailClick = (composer: Composer) => {
    setEmailComposer(composer)
    setEmailForm({
      email: composer.email || '',
      subject: '',
      message: '',
    })
  }

  const handleEmailCancel = () => {
    setEmailComposer(null)
    setEmailForm({ email: '', subject: '', message: '' })
  }

  const handleEmailSend = async () => {
    if (!emailComposer) return
    if (!emailForm.email.trim()) {
      alert('Informe o e-mail do destinatário.')
      return
    }
    if (!emailForm.subject.trim()) {
      alert('Informe o assunto do e-mail.')
      return
    }
    if (emailForm.message.trim().length < 5) {
      alert('Escreva a mensagem do e-mail.')
      return
    }

    const confirmed = confirm(
      `Enviar e-mail para ${emailForm.email.trim()}?\n\n` +
      `Assunto: ${emailForm.subject.trim()}`
    )
    if (!confirmed) return

    try {
      setActionLoading(emailComposer.id)
      const response = await fetch(`/api/admin/composers/${emailComposer.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send_admin_email',
          email: emailForm.email.trim(),
          subject: emailForm.subject.trim(),
          message: emailForm.message.trim(),
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Erro ao enviar e-mail')
      }

      alert(`E-mail enviado para ${data.recipientEmail || emailForm.email.trim()}.`)
      handleEmailCancel()
    } catch (error: any) {
      console.error('Erro ao enviar e-mail:', error)
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreditSave = async () => {
    if (!creditComposer) return

    const musicQuantity = Math.floor(Number(creditForm.musicQuantity) || 0)
    if (musicQuantity <= 0) {
      alert('Informe a quantidade de músicas.')
      return
    }
    if (!creditForm.reason.trim()) {
      alert('Informe o motivo do crédito manual.')
      return
    }

    const confirmed = confirm(
      `Creditar ${musicQuantity} música(s) para "${creditComposer.name}"?\n\n` +
      `E-mail: ${creditComposer.email || 'sem e-mail'}\n` +
      `Créditos: ${musicQuantity * 10}\n\n` +
      'Essa movimentação aparecerá no extrato do compositor.'
    )
    if (!confirmed) return

    try {
      setActionLoading(creditComposer.id)
      const response = await fetch(`/api/admin/composers/${creditComposer.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'grant_studio_credits',
          musicQuantity,
          reason: creditForm.reason.trim(),
          message: creditForm.message.trim(),
          sendEmail: creditForm.sendEmail,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Erro ao creditar músicas')
      }

      alert(
        `Crédito lançado com sucesso.\n\n` +
        `${musicQuantity} música(s) adicionada(s).\n` +
        `E-mail ${data.emailSent ? 'enviado' : 'não enviado'}.`
      )
      handleCreditCancel()
    } catch (error: any) {
      console.error('Erro ao creditar músicas:', error)
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleEditSave = async () => {
    if (!editingComposer) return

    if (!editForm.name.trim()) {
      alert('Nome é obrigatório')
      return
    }

    try {
      setActionLoading(editingComposer.id)
      const response = await fetch(`/api/admin/composers/${editingComposer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name.trim(),
          slug: editForm.slug.trim() || undefined,
          email: editForm.email.trim() || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Erro ao atualizar compositor')
      }

      alert('Compositor atualizado com sucesso!')
      handleEditCancel()
      loadComposers()
    } catch (error: any) {
      console.error('Erro ao atualizar compositor:', error)
      alert(`Erro: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const composerHasActiveAccess = (composer: Composer) => {
    const isExpired = composer.subscriptionExpiresAt
      ? new Date(composer.subscriptionExpiresAt) < new Date()
      : false
    return Boolean(composer.hasActiveSubscription && composer.isPremium && !isExpired)
  }

  const safeCurrentPage = Math.min(currentPage, totalPages)

  const listRangeStart = listTotal === 0 ? 0 : ((safeCurrentPage - 1) * PAGE_SIZE) + 1
  const listRangeEnd = listTotal === 0 ? 0 : Math.min(safeCurrentPage * PAGE_SIZE, listTotal)

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatDateTime = (date: Date | null | undefined) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatMoney = (value: number | null | undefined) => {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const loadSpendingRanking = async () => {
    try {
      setSpendingRankingOpen(true)
      setSpendingRankingLoading(true)

      const response = await fetch('/api/admin/composers/spending-ranking', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Erro ao carregar ranking de gastos')
      }

      setSpendingRanking(Array.isArray(data.ranking) ? data.ranking : [])
      setSpendingTotal(Number(data.totalRevenue) || 0)
    } catch (error: any) {
      console.error('Erro ao carregar ranking de gastos:', error)
      alert(`Erro: ${error.message}`)
      setSpendingRankingOpen(false)
    } finally {
      setSpendingRankingLoading(false)
    }
  }

  const exportSpendingRankingToXLSX = async () => {
    if (spendingRanking.length === 0) {
      alert('Nenhum gasto encontrado para exportar')
      return
    }

    try {
      const XLSX = await import('xlsx')
      const rows = spendingRanking.map((row) => ({
        Posição: row.position,
        Nome: row.name,
        Email: row.email || 'Sem email',
        Slug: row.slug,
        'Total gasto': formatMoney(row.totalSpent),
        'Gasto com planos': formatMoney(row.planSpent),
        'Gasto com recargas avulsas': formatMoney(row.topupSpent),
        'Gasto com destaques': formatMoney(row.featuredSpent),
        'Quantidade de pagamentos': row.paymentCount,
        'Data de cadastro': row.createdAt ? formatDateTime(new Date(row.createdAt)) : 'N/A',
      }))

      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Ranking de gastos')
      XLSX.writeFile(workbook, `ranking-gastos-compositores-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (error) {
      console.error('Erro ao exportar ranking de gastos:', error)
      alert('Erro ao exportar ranking de gastos')
    }
  }

  const exportToXLSX = async () => {
    if (summary.total === 0) {
      alert('Nenhum compositor para exportar')
      return
    }

    try {
      setExporting(true)
      setExportProgress('Preparando...')

      const exportComposers: Composer[] = []
      const chunkSize = 15
      let offset = 0
      let total = 0
      let done = false

      while (!done) {
        const exportResponse = await fetch(`/api/admin/composers/list?export=1&offset=${offset}&limit=${chunkSize}`, { cache: 'no-store' })
        if (!exportResponse.ok) {
          const data = await exportResponse.json().catch(() => ({}))
          throw new Error(data.details || data.error || 'Erro ao buscar dados completos para exportação')
        }

        const payload = await exportResponse.json()
        const items = Array.isArray(payload?.items) ? payload.items : []
        total = Number(payload?.total || total || items.length)
        exportComposers.push(...items)

        offset = Number(payload?.nextOffset || offset + items.length)
        done = Boolean(payload?.done) || items.length === 0
        setExportProgress(`Gerando ${Math.min(exportComposers.length, total)}/${total}...`)
      }

      const term = searchTerm.trim().toLowerCase()
      const composersToExport = term
        ? exportComposers.filter((composer) => (
            composer.name.toLowerCase().includes(term) ||
            composer.slug.toLowerCase().includes(term) ||
            composer.email?.toLowerCase().includes(term)
          ))
        : exportComposers

      const XLSX = await import('xlsx')
      const rows = composersToExport.map((composer) => {
        const hasAccess = composer.hasActiveSubscription && composer.isPremium
        const isExpired = composer.subscriptionExpiresAt
          ? new Date(composer.subscriptionExpiresAt) < new Date()
          : false

        const hasEmail = Boolean(composer.email)
        const emailConfirmed = hasEmail && composer.emailVerified

        return {
          Nome: composer.name,
          Email: composer.email || 'Sem email',
          'E-mail confirmado': !hasEmail ? 'Sem e-mail' : emailConfirmed ? 'Sim' : 'Não',
          'E-mail confirmado em': emailConfirmed ? formatDateTime(composer.emailVerifiedAt) : '',
          Slug: composer.slug,
          'Músicas cadastradas': composer.musicCount ?? 0,
          'Vídeos cadastrados': composer.videoCount ?? 0,
          'Letras Studio IA': composer.studioLyricCount ?? 0,
          'Músicas Studio IA': composer.studioMusicCount ?? 0,
          'Data de cadastro': formatDateTime(composer.createdAt),
          Visualizações: composer.totalViews ?? 0,
          Status: hasAccess && !isExpired ? 'Ativo' : 'Inativo',
          'Expira em': composer.subscriptionExpiresAt ? formatDate(composer.subscriptionExpiresAt) : 'N/A',
        }
      })

      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Compositores')
      XLSX.writeFile(workbook, `compositores-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (error) {
      console.error('Erro ao exportar compositores:', error)
      alert('Erro ao exportar XLSX')
    } finally {
      setExporting(false)
      setExportProgress('')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="text-center">
          <FiRefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando compositores...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              <span className="gradient-text">Gerenciar Compositores</span>
            </h1>
            <p className="text-gray-400">Controle, edição, saldos e uso do Studio IA por compositor.</p>
          </div>
          <button
            type="button"
            onClick={loadComposers}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-bold text-gray-100 hover:border-primary-500"
          >
            <FiRefreshCw className="h-4 w-4" />
            Recarregar
          </button>
        </div>

        {/* Estatísticas */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <p className="text-xs text-gray-500">Total</p>
            <p className="mt-1 text-2xl font-black text-white">{summary.total}</p>
            <p className="text-xs text-gray-500">compositores</p>
          </div>
          <div className="rounded-xl border border-green-800 bg-green-950/30 p-4">
            <p className="text-xs text-green-300/70">Ativos</p>
            <p className="mt-1 text-2xl font-black text-green-300">{summary.active}</p>
            <p className="text-xs text-green-300/60">com acesso</p>
          </div>
          <div className="rounded-xl border border-red-900 bg-red-950/20 p-4">
            <p className="text-xs text-red-300/70">Sem acesso</p>
            <p className="mt-1 text-2xl font-black text-red-300">{summary.inactive}</p>
            <p className="text-xs text-red-300/60">inativos</p>
          </div>
          <div className="rounded-xl border border-purple-800 bg-purple-950/30 p-4">
            <p className="text-xs text-purple-300/70">Letras IA</p>
            <p className="mt-1 text-2xl font-black text-purple-200">{summary.studioLyrics}</p>
            <p className="text-xs text-purple-300/60">no Studio</p>
          </div>
          <div className="rounded-xl border border-primary-800 bg-primary-950/30 p-4">
            <p className="text-xs text-primary-300/70">Músicas IA</p>
            <p className="mt-1 text-2xl font-black text-primary-200">{summary.studioMusics}</p>
            <p className="text-xs text-primary-300/60">gerações</p>
          </div>
          <div className="rounded-xl border border-yellow-800 bg-yellow-950/20 p-4">
            <p className="text-xs text-yellow-300/70">E-mail pendente</p>
            <p className="mt-1 text-2xl font-black text-yellow-200">{summary.pendingEmail}</p>
            <p className="text-xs text-yellow-300/60">cadastros</p>
          </div>
        </div>

        {/* Busca e filtros */}
        <div className="sticky top-0 z-30 mb-6 rounded-2xl border border-gray-800 bg-black/90 p-4 backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
            />
            </div>
            <button
              type="button"
              onClick={loadSpendingRanking}
              disabled={spendingRankingLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-950/40 px-4 py-2 text-sm font-bold text-emerald-100 hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {spendingRankingLoading ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiCreditCard className="w-4 h-4" />}
              Ranking de gastos
            </button>
            <button
              type="button"
              onClick={exportToXLSX}
              disabled={exporting}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-bold text-gray-100 hover:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiDownload className="w-4 h-4" />}
              {exporting ? exportProgress || 'Gerando...' : 'Exportar XLSX'}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[
              { key: 'all', label: 'Todos', count: summary.total },
              { key: 'active', label: 'Ativos', count: summary.active },
              { key: 'inactive', label: 'Inativos', count: summary.inactive },
              { key: 'studio', label: 'Com Studio IA', count: summary.withStudio },
              { key: 'pending', label: 'E-mail pendente', count: summary.pendingEmail },
            ].map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setStatusFilter(filter.key as typeof statusFilter)}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                  statusFilter === filter.key
                    ? 'border-primary-400 bg-primary-600 text-white'
                    : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-primary-500'
                }`}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-500">
              Exibindo {listRangeStart}-{listRangeEnd} de {listTotal}
            </span>
          </div>
        </div>

        {/* Lista de Compositores */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-[1080px] w-full">
              <thead className="sticky top-0 z-20 bg-gray-900 shadow-[0_1px_0_rgba(31,41,55,1)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Compositor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Cadastro
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Vídeos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Músicas
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Visualizações
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Studio IA
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Expira em
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {listTotal === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-400">
                      {debouncedSearch || statusFilter !== 'all' ? 'Nenhum compositor encontrado' : 'Nenhum compositor cadastrado'}
                    </td>
                  </tr>
                ) : (
                  composers.map((composer) => {
                    const hasAccess = composer.hasActiveSubscription && composer.isPremium
                    const isExpired = composer.subscriptionExpiresAt
                      ? new Date(composer.subscriptionExpiresAt) < new Date()
                      : false

                    return (
                      <tr key={composer.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-600">
                              <FiUser className="h-4 w-4 text-white" />
                            </div>
                            <div className="ml-3 flex items-baseline gap-2">
                              <Link
                                href={`/admin/compositores/${composer.id}`}
                                className="text-sm font-semibold text-white transition hover:text-primary-300"
                                title="Abrir perfil administrativo do compositor"
                              >
                                {composer.name}
                              </Link>
                              <span className="text-xs text-gray-500">/{composer.slug}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-300">
                            <FiMail className="w-4 h-4 mr-2 text-gray-400" />
                            {composer.email || 'Sem email'}
                            {composer.email && !composer.emailVerified && (
                              <span className="ml-2 inline-flex items-center rounded-full border border-yellow-800 bg-yellow-900/40 px-2 py-0.5 text-[11px] font-medium text-yellow-300">
                                <FiXCircle className="mr-1 h-3 w-3" />
                                Pendente
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-300">
                            <FiCalendar className="w-4 h-4 mr-2 shrink-0 text-gray-400" />
                            {formatDateTime(composer.createdAt)}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-300">
                            <FiVideo className="w-4 h-4 mr-2 text-gray-400" />
                            {composer.videoCount ?? 0}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-300">
                            <FiMusic className="w-4 h-4 mr-2 text-gray-400" />
                            {composer.musicCount ?? 0}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-300">
                            <FiEye className="w-4 h-4 mr-2 text-gray-400" />
                            {composer.totalViews?.toLocaleString('pt-BR') ?? 0}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Link
                            href={`/admin/compositores/${composer.id}/studio`}
                            className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-gray-300 transition hover:bg-purple-950/40 hover:text-purple-100"
                            title="Ver letras e músicas Studio IA deste compositor"
                          >
                            <FiFileText className="h-4 w-4 text-purple-300" />
                            <span>{composer.studioLyricCount ?? 0} letras</span>
                            <span className="text-gray-600">·</span>
                            <FiMusic className="h-4 w-4 text-primary-300" />
                            <span>{composer.studioMusicCount ?? 0} músicas IA</span>
                          </Link>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {hasAccess && !isExpired ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/50 text-green-300 border border-green-800">
                              <FiCheckCircle className="w-3 h-3 mr-1" />
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/50 text-red-300 border border-red-800">
                              <FiXCircle className="w-3 h-3 mr-1" />
                              Inativo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                          {composer.subscriptionExpiresAt ? (
                            <div className="flex items-center">
                              <FiCalendar className="w-4 h-4 mr-2 text-gray-400" />
                              {formatDate(composer.subscriptionExpiresAt)}
                            </div>
                          ) : (
                            <span className="text-gray-500">N/A</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {listTotal > 0 && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-400">
              Página <span className="font-bold text-white">{safeCurrentPage}</span> de <span className="font-bold text-white">{totalPages}</span>
              {' '}· mostrando {listRangeStart}-{listRangeEnd} de {listTotal}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage <= 1}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-bold text-gray-200 hover:border-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Primeira página"
              >
                &lt;=
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage <= 1}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-bold text-gray-200 hover:border-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Página anterior"
              >
                &lt;
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-bold text-gray-200 hover:border-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Próxima página"
              >
                &gt;
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage >= totalPages}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-bold text-gray-200 hover:border-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Última página"
              >
                =&gt;
              </button>
            </div>
          </div>
        )}

        {/* Modal de Edição */}
        {editingComposer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4 text-white">Editar Compositor</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
                    placeholder="Nome do compositor"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Slug
                  </label>
                  <input
                    type="text"
                    value={editForm.slug}
                    onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
                    placeholder="slug-do-compositor"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Deixe em branco para gerar automaticamente
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleEditSave}
                  disabled={actionLoading === editingComposer.id || !editForm.name.trim()}
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {actionLoading === editingComposer.id ? (
                    <span className="flex items-center justify-center">
                      <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </span>
                  ) : (
                    'Salvar'
                  )}
                </button>
                <button
                  onClick={handleEditCancel}
                  disabled={actionLoading === editingComposer.id}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de crédito manual Studio IA */}
        {creditComposer && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-emerald-800 bg-gray-950 p-6 shadow-2xl shadow-emerald-950/30">
              <div className="mb-5 flex items-start gap-3">
                <div className="rounded-xl bg-emerald-900/60 p-3 text-emerald-200">
                  <FiGift className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Creditar Studio IA</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Adicione músicas manualmente para {creditComposer.name}.
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{creditComposer.email || 'Sem e-mail cadastrado'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Quantas músicas quer creditar?
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={creditForm.musicQuantity}
                    onChange={(e) => setCreditForm({ ...creditForm, musicQuantity: e.target.value })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-emerald-300">
                    {Math.max(0, Math.floor(Number(creditForm.musicQuantity) || 0)) * 10} créditos serão adicionados.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Motivo interno *
                  </label>
                  <input
                    type="text"
                    value={creditForm.reason}
                    onChange={(e) => setCreditForm({ ...creditForm, reason: e.target.value })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="Ex.: Correção de recarga Mercado Pago"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Mensagem para o compositor
                  </label>
                  <textarea
                    value={creditForm.message}
                    onChange={(e) => setCreditForm({ ...creditForm, message: e.target.value })}
                    rows={4}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="Mensagem que irá no e-mail."
                  />
                </div>

                <label className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/70 p-3 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={creditForm.sendEmail}
                    onChange={(e) => setCreditForm({ ...creditForm, sendEmail: e.target.checked })}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  Enviar e-mail avisando o compositor
                </label>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleCreditSave}
                  disabled={actionLoading === creditComposer.id || !creditForm.reason.trim()}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionLoading === creditComposer.id ? (
                    <span className="flex items-center justify-center">
                      <FiRefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Creditando...
                    </span>
                  ) : (
                    'Creditar músicas'
                  )}
                </button>
                <button
                  onClick={handleCreditCancel}
                  disabled={actionLoading === creditComposer.id}
                  className="flex-1 rounded-lg bg-gray-800 px-4 py-2 font-bold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de e-mail administrativo */}
        {emailComposer && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-sky-800 bg-gray-950 p-6 shadow-2xl shadow-sky-950/30">
              <div className="mb-5 flex items-start gap-3">
                <div className="rounded-xl bg-sky-900/60 p-3 text-sky-200">
                  <FiMail className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Enviar e-mail</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Responda profissionalmente pelo e-mail oficial da DCC Music.
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Compositor selecionado: {emailComposer.name}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    E-mail do destinatário *
                  </label>
                  <input
                    type="email"
                    value={emailForm.email}
                    onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-sky-500 focus:outline-none"
                    placeholder="cliente@email.com"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Assunto *
                  </label>
                  <input
                    type="text"
                    value={emailForm.subject}
                    onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-sky-500 focus:outline-none"
                    placeholder="Ex.: Retorno sobre sua solicitação"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Mensagem *
                  </label>
                  <textarea
                    value={emailForm.message}
                    onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                    rows={9}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-sky-500 focus:outline-none"
                    placeholder="Escreva aqui a resposta para o cliente."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    O sistema adiciona automaticamente a saudação e a assinatura da Equipe DCC Music no layout do e-mail.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleEmailSend}
                  disabled={actionLoading === emailComposer.id || !emailForm.email.trim() || !emailForm.subject.trim() || emailForm.message.trim().length < 5}
                  className="flex-1 rounded-lg bg-sky-600 px-4 py-2 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionLoading === emailComposer.id ? (
                    <span className="flex items-center justify-center">
                      <FiRefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </span>
                  ) : (
                    'Enviar e-mail'
                  )}
                </button>
                <button
                  onClick={handleEmailCancel}
                  disabled={actionLoading === emailComposer.id}
                  className="flex-1 rounded-lg bg-gray-800 px-4 py-2 font-bold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal ranking de gastos */}
        {spendingRankingOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
            <div className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-emerald-800 bg-gray-950 shadow-2xl shadow-emerald-950/30">
              <div className="border-b border-gray-800 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-emerald-900/60 p-3 text-emerald-200">
                      <FiCreditCard className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Ranking de gastos</h2>
                      <p className="mt-1 text-sm text-gray-400">
                        Compositores ordenados pelo total pago em planos, recargas avulsas e destaques.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSpendingRankingOpen(false)}
                    className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-bold text-gray-200 hover:border-gray-500"
                  >
                    Fechar
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-gray-800 bg-black/30 p-4">
                    <p className="text-xs text-gray-500">Total pago</p>
                    <p className="mt-1 text-2xl font-black text-emerald-300">{formatMoney(spendingTotal)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-black/30 p-4">
                    <p className="text-xs text-gray-500">Compositores pagantes</p>
                    <p className="mt-1 text-2xl font-black text-white">{spendingRanking.length}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-black/30 p-4">
                    <p className="text-xs text-gray-500">Maior cliente</p>
                    <p className="mt-1 truncate text-lg font-black text-white">
                      {spendingRanking[0]?.name || 'Nenhum pagamento'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-5 sm:p-6">
                {spendingRankingLoading ? (
                  <div className="flex min-h-60 flex-col items-center justify-center text-center">
                    <FiRefreshCw className="mb-4 h-8 w-8 animate-spin text-emerald-300" />
                    <p className="text-gray-300">Carregando ranking...</p>
                  </div>
                ) : spendingRanking.length === 0 ? (
                  <div className="rounded-xl border border-gray-800 bg-black/30 p-8 text-center text-gray-400">
                    Nenhum pagamento aprovado encontrado.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-800">
                    <table className="w-full min-w-[900px]">
                      <thead className="bg-gray-900">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">#</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Compositor</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Total</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Planos</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Recargas</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Destaques</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Pagamentos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 bg-gray-950">
                        {spendingRanking.map((row) => (
                          <tr key={row.composerId} className="hover:bg-gray-900/80">
                            <td className="px-4 py-3 text-sm font-black text-emerald-300">{row.position}</td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-white">{row.name}</p>
                              <p className="text-xs text-gray-500">{row.email || 'Sem email'} · /{row.slug}</p>
                            </td>
                            <td className="px-4 py-3 text-sm font-black text-white">{formatMoney(row.totalSpent)}</td>
                            <td className="px-4 py-3 text-sm text-gray-300">{formatMoney(row.planSpent)}</td>
                            <td className="px-4 py-3 text-sm text-gray-300">{formatMoney(row.topupSpent)}</td>
                            <td className="px-4 py-3 text-sm text-gray-300">{formatMoney(row.featuredSpent)}</td>
                            <td className="px-4 py-3 text-sm text-gray-300">{row.paymentCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-800 p-5 sm:flex-row sm:justify-end sm:p-6">
                <button
                  type="button"
                  onClick={exportSpendingRankingToXLSX}
                  disabled={spendingRankingLoading || spendingRanking.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FiDownload className="h-4 w-4" />
                  Exportar ranking XLSX
                </button>
                <button
                  type="button"
                  onClick={() => setSpendingRankingOpen(false)}
                  className="rounded-lg bg-gray-800 px-5 py-3 font-bold text-white hover:bg-gray-700"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
