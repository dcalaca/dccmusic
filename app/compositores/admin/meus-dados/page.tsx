'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiAlertTriangle, FiArrowLeft, FiCalendar, FiCamera, FiCheckCircle, FiCreditCard, FiLogOut, FiMail, FiMic, FiMusic, FiPlayCircle, FiTrash2, FiUpload, FiUser, FiX, FiZap } from 'react-icons/fi'

function formatDate(value?: string | null) {
  if (!value) return 'Não informado'
  return new Date(value).toLocaleDateString('pt-BR')
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Não informado'
  return new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMoney(value?: number | null) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function planStatusLabel(status?: string | null) {
  if (status === 'active') return 'Ativo'
  if (status === 'pending') return 'Pendente'
  if (status === 'cancelled') return 'Cancelado'
  if (status === 'failed') return 'Falhou'
  return 'Sem plano ativo'
}

function StatCard({ icon: Icon, label, value, detail }: {
  icon: any
  label: string
  value: string | number
  detail?: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-lg shadow-black/10">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-primary-300/20 bg-primary-400/10 text-primary-200">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xl font-black text-white sm:text-2xl">{value}</p>
      <p className="mt-1 text-sm font-bold text-gray-300">{label}</p>
      {detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}
    </div>
  )
}

function StatementSection({ statement }: { statement: any }) {
  const payments = statement?.payments || []
  const creditMovements = statement?.creditMovements || []

  return (
    <section className="mt-5 rounded-[1.75rem] border border-white/10 bg-gray-950/80 p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div className="mb-4">
        <h2 className="text-xl font-black text-white sm:text-2xl">Pagamentos e créditos</h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-400">
          Aqui aparecem seus pagamentos, recargas e entradas ou saídas de créditos.
        </p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">Total pago</p>
          <p className="mt-1 text-xl font-black text-green-300">{formatMoney(statement?.summary?.totalPaid)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">Saldo atual</p>
          <p className="mt-1 text-xl font-black text-green-300">{statement?.summary?.currentCreditBalance || 0}</p>
          <p className="mt-1 text-xs text-gray-500">{statement?.summary?.currentMusicBalance || 0} música(s)</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">Créditos recebidos</p>
          <p className="mt-1 text-xl font-black text-primary-300">{statement?.summary?.boughtCredits || 0}</p>
          {statement?.summary?.studioPlanName && (
            <p className="mt-1 text-xs text-gray-500">{statement.summary.studioPlanName}</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">Músicas avulsas</p>
          <p className="mt-1 text-xl font-black text-purple-300">{statement?.summary?.boughtMusicQuantity || 0}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 font-black text-white">Pagamentos e recargas</h3>
          {payments.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-gray-500">
              Nenhum pagamento registrado ainda.
            </p>
          ) : (
            <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {payments.slice(0, 12).map((payment: any) => (
                <div key={`${payment.type}-${payment.id}`} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold text-white">{payment.label}</p>
                      <p className="mt-1 text-sm text-gray-400">{payment.description}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatDateTime(payment.date)}</p>
                      {payment.paymentId && <p className="mt-1 break-all text-xs text-gray-500">{payment.paymentIdLabel || 'ID pagamento'}: {payment.paymentId}</p>}
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-black text-green-300">{formatMoney(payment.amount)}</p>
                      <p className="mt-1 text-xs text-gray-400">{payment.statusLabel}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-3 font-black text-white">Uso dos créditos</h3>
          {creditMovements.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-gray-500">
              Nenhum uso de crédito registrado ainda.
            </p>
          ) : (
            <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {creditMovements.map((movement: any) => (
                <div key={movement.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{movement.label}</p>
                      <p className="mt-1 text-sm text-gray-400">{movement.description}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatDateTime(movement.date)}</p>
                      {typeof movement.balanceAfter === 'number' && (
                        <p className="mt-1 text-xs font-bold text-primary-200">
                          Saldo após: {movement.balanceAfter}
                        </p>
                      )}
                    </div>
                    <p className={`shrink-0 font-black ${movement.direction === 'credit' ? 'text-green-300' : movement.direction === 'ignored' ? 'text-gray-400' : 'text-yellow-300'}`}>
                      {movement.direction === 'credit' ? '+' : movement.direction === 'ignored' ? '' : '-'}{movement.amount}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default function ComposerMyDataPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [accountDeleted, setAccountDeleted] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login?redirect=/compositores/admin/meus-dados')
      return
    }

    fetch('/api/compositores/me', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json()
        if (response.status === 401) {
          localStorage.removeItem('composer_token')
          localStorage.removeItem('composer_data')
          router.push('/compositores/login?redirect=/compositores/admin/meus-dados')
          return
        }
        if (!response.ok) throw new Error(payload.error || 'Erro ao carregar dados')
        setData(payload)
        const currentCreditBalance = Number(payload?.statement?.summary?.currentCreditBalance) || 0
        localStorage.setItem('composer_studio_balance', String(currentCreditBalance))
        window.dispatchEvent(new CustomEvent('studioBalanceChange', { detail: { balance: currentCreditBalance } }))
      })
      .catch((err) => setError(err.message || 'Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('composer_token')
    localStorage.removeItem('composer_token_temp')
    localStorage.removeItem('composer_data')
    window.dispatchEvent(new Event('authChange'))
    router.push('/compositores/login')
  }

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setPhotoFile(file)
    setError('')

    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(file ? URL.createObjectURL(file) : '')
  }

  const handleProfilePhotoUpload = async () => {
    if (!photoFile) return

    try {
      setPhotoUploading(true)
      setError('')

      const token = localStorage.getItem('composer_token')
      if (!token) {
        router.push('/compositores/login?redirect=/compositores/admin/meus-dados')
        return
      }

      const formData = new FormData()
      formData.append('photo', photoFile)

      const response = await fetch('/api/compositores/profile-photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const payload = await response.json()

      if (!response.ok) throw new Error(payload.error || 'Erro ao salvar foto')

      setData((currentData: any) => ({
        ...currentData,
        composer: {
          ...currentData.composer,
          profilePhotoUrl: payload.profilePhotoUrl,
        },
      }))
      setPhotoFile(null)
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      setPhotoPreview('')
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar foto')
    } finally {
      setPhotoUploading(false)
    }
  }

  const clearComposerSession = () => {
    localStorage.removeItem('composer_token')
    localStorage.removeItem('composer_token_temp')
    localStorage.removeItem('composer_data')
    window.dispatchEvent(new Event('authChange'))
  }

  const handleDeleteAccount = async () => {
    try {
      setDeletingAccount(true)
      setError('')

      const token = localStorage.getItem('composer_token')
      if (!token) {
        clearComposerSession()
        router.push('/compositores/login')
        return
      }

      const response = await fetch('/api/compositores/me', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Erro ao excluir conta')
      }

      clearComposerSession()
      setShowDeleteModal(false)
      setAccountDeleted(true)
      window.setTimeout(() => {
        router.push('/')
      }, 4500)
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir conta')
      setDeletingAccount(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-xl rounded-2xl border border-red-800 bg-red-950/40 p-6 text-red-200">
            {error}
          </div>
        </div>
      </div>
    )
  }

  const composer = data.composer
  const plan = data.plan
  const studio = data.studio
  const catalog = data.catalog
  const statement = data.statement
  const currentStudioBalance = Number(statement?.summary?.currentCreditBalance ?? studio?.creditsRemaining ?? 0) || 0
  const currentStudioMusicBalance = Math.floor(currentStudioBalance / 10)

  return (
    <div className="min-h-screen py-5 sm:py-7">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link href="/compositores/admin" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-300 transition hover:text-primary-200">
            <FiArrowLeft /> Voltar
          </Link>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black text-white sm:text-3xl">
                Minha conta
              </h1>
              <p className="mt-1 text-sm text-gray-400">Veja seus dados, saldo, plano e atalhos principais.</p>
            </div>
            <div className="grid gap-2 sm:flex sm:gap-3">
              <Link
                href="/compositores/admin/minhas-vozes"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-purple-600 px-4 py-3 text-sm font-bold text-white hover:from-primary-500 hover:to-purple-500"
              >
                <FiMic />
                Minhas vozes
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={deletingAccount}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-950/20 px-4 py-3 text-sm font-bold text-red-200 hover:bg-red-950/35 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiLogOut />
                Sair
              </button>
            </div>
          </div>

          <section className="mb-5 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.25),transparent_32%),linear-gradient(135deg,rgba(8,8,12,0.98),rgba(17,24,39,0.94),rgba(49,15,80,0.65))] p-4 shadow-2xl shadow-purple-950/25 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
              <div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="w-full sm:w-auto">
                    <div className="relative h-24 w-24 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary-600 to-purple-600 text-2xl font-black text-white shadow-lg shadow-purple-950/30">
                      {photoPreview || composer.profilePhotoUrl ? (
                        <img
                          src={photoPreview || composer.profilePhotoUrl}
                          alt={`Foto de ${composer.name}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          {(composer.name || 'C').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 grid gap-2">
                      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-gray-100 hover:bg-white/[0.09]">
                        <FiCamera />
                        Escolher foto
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                      </label>
                      {photoFile && (
                        <button
                          type="button"
                          onClick={handleProfilePhotoUpload}
                          disabled={photoUploading}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-purple-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                        >
                          {photoUploading ? (
                            <>
                              <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <FiUpload />
                              Salvar foto
                            </>
                          )}
                        </button>
                      )}
                      <p className="text-[11px] leading-relaxed text-gray-500">
                        JPG, PNG ou WebP até 3 MB.
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-100">Compositor</p>
                    <h2 className="mt-1 text-2xl font-black leading-tight text-white sm:text-3xl">{composer.name}</h2>
                    <p className="mt-1 text-sm text-gray-400">{composer.accountName || 'Nome real não informado'}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-gray-300 sm:grid-cols-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FiMail className="shrink-0 text-primary-300" />
                    <span className="break-all">{composer.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FiCalendar className="shrink-0 text-primary-300" />
                    Cadastro em {formatDate(composer.createdAt)}
                  </div>
                  <div className="flex items-center gap-2">
                    <FiCheckCircle className={`shrink-0 ${composer.emailVerified ? 'text-green-300' : 'text-yellow-300'}`} />
                    {composer.emailVerified ? 'E-mail confirmado' : 'E-mail ainda não confirmado'}
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <FiUser className="shrink-0 text-primary-300" />
                    <span className="break-all">Página pública: /compositores/{composer.slug}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-950/40 px-3 py-1 text-xs font-bold text-purple-100">
                  <FiCreditCard />
                  Plano atual
                </div>
                <h3 className="text-2xl font-black text-white">{plan.name || 'Sem plano ativo'}</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-400">
                  <p>Situação: <span className="font-bold text-gray-200">{planStatusLabel(plan.status)}</span></p>
                  <p>Vencimento: <span className="font-bold text-gray-200">{formatDate(plan.endDate)}</span></p>
                  <p>
                  Studio IA: {plan.hasStudioPlan ? 'Incluído no plano' : 'Sem plano Studio IA mensal'}
                  </p>
                </div>
                <Link
                  href="/studio-ia#planos"
                  className="mt-4 inline-flex w-full justify-center rounded-2xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 text-sm font-bold text-white"
                >
                  Ver planos Studio IA
                </Link>
              </div>
            </div>
          </section>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              icon={FiCreditCard}
              label="saldo do Studio IA"
              value={`${currentStudioBalance} créditos`}
              detail={`aprox. ${currentStudioMusicBalance} música(s)`}
            />
            <StatCard icon={FiZap} label="letras criadas" value={studio.lyricsCreated} />
            <StatCard icon={FiMusic} label="músicas criadas" value={studio.musicsCreated} />
            <StatCard icon={FiMusic} label="músicas cadastradas" value={catalog.musics} />
            <StatCard icon={FiPlayCircle} label="vídeos cadastrados" value={catalog.videos} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-[1.75rem] border border-white/10 bg-gray-950/80 p-4 shadow-2xl shadow-black/20 sm:p-5">
              <h2 className="mb-4 text-xl font-black text-white sm:text-2xl">Resumo do Studio IA</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                  <span className="text-gray-400">Créditos disponíveis</span>
                  <span className="font-bold text-white">{currentStudioBalance} créditos</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                  <span className="text-gray-400">Músicas que pode criar</span>
                  <span className="font-bold text-white">{currentStudioMusicBalance + (studio.freeMusicRemaining || 0)}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                  <span className="text-gray-400">Música grátis restante</span>
                  <span className="font-bold text-white">{studio.freeMusicRemaining}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Músicas em outros sites</span>
                  <span className="font-bold text-white">{catalog.embeddedMusics}</span>
                </div>
              </div>
              <Link
                href="/compositores/admin/studio-ia/projetos"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white"
              >
                <FiZap />
                Meu Studio IA
              </Link>
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-gray-950/80 p-4 shadow-2xl shadow-black/20 sm:p-5">
              <h2 className="mb-4 text-xl font-black text-white sm:text-2xl">Acessos rápidos</h2>
              <div className="grid gap-3">
                <Link href="/compositores/admin/studio-ia/projetos" className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 font-bold text-gray-100 hover:bg-white/[0.08]">
                  Abrir Studio IA
                </Link>
                <Link href="/compositores/admin/minhas-vozes" className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 font-bold text-gray-100 hover:bg-white/[0.08]">
                  Minhas vozes
                </Link>
                <Link href="/compositores/admin/musicas" className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 font-bold text-gray-100 hover:bg-white/[0.08]">
                  Músicas cadastradas
                </Link>
                <Link href="/compositores/admin/videos" className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 font-bold text-gray-100 hover:bg-white/[0.08]">
                  Vídeos cadastrados
                </Link>
                <Link href={`/compositores/${composer.slug}`} target="_blank" className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 font-bold text-gray-100 hover:bg-white/[0.08]">
                  Ver minha página pública
                </Link>
              </div>
            </section>
          </div>

          <StatementSection statement={statement} />

          <section className="mt-5 rounded-[1.75rem] border border-red-500/25 bg-red-950/10 p-4 sm:p-5">
            <h2 className="text-lg font-black text-red-100 sm:text-xl">Excluir conta</h2>
            <p className="mt-2 text-sm leading-relaxed text-red-100/80">
              Use esta opção somente se quiser apagar definitivamente sua conta de compositor e os dados vinculados a ela.
              Depois da confirmação, o sistema fará logout automaticamente.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              disabled={deletingAccount}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-700/90 px-5 py-3 font-bold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <FiTrash2 />
              {deletingAccount ? 'Excluindo conta...' : 'Excluir minha conta'}
            </button>
          </section>

          {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-red-800/70 bg-gradient-to-br from-gray-950 via-black to-red-950/40 shadow-2xl shadow-red-950/40">
                <div className="border-b border-red-900/50 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-500/50 bg-red-950/70 text-red-200">
                        <FiAlertTriangle className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-red-300">Ação permanente</p>
                        <h2 className="mt-1 text-2xl font-black text-white">Excluir sua conta?</h2>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(false)}
                      disabled={deletingAccount}
                      className="rounded-xl p-2 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
                      aria-label="Fechar"
                    >
                      <FiX className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 p-5 sm:p-6">
                  <p className="text-sm leading-relaxed text-gray-200">
                    Tem certeza que deseja excluir sua conta de compositor?
                  </p>
                  <div className="rounded-2xl border border-red-900/70 bg-red-950/25 p-4 text-sm leading-relaxed text-red-100/90">
                    Todos os seus dados de compositor serão excluídos, incluindo cadastro, acesso, projetos do Studio IA,
                    letras, músicas IA, assinaturas e histórico vinculado à conta.
                  </div>
                  <p className="text-xs font-semibold text-red-200">
                    Esta ação não pode ser desfeita. Depois da exclusão, você será desconectado automaticamente.
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-red-900/50 p-5 sm:flex-row sm:justify-end sm:p-6">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deletingAccount}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-700 bg-gray-900 px-5 py-3 font-bold text-gray-100 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-3 font-bold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiTrash2 />
                    {deletingAccount ? 'Excluindo...' : 'Excluir definitivamente'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {accountDeleted && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md overflow-hidden rounded-3xl border border-green-700/70 bg-gradient-to-br from-gray-950 via-black to-green-950/40 p-6 text-center shadow-2xl shadow-green-950/30 sm:p-8">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-green-400/50 bg-green-950/70 text-green-200">
                  <FiCheckCircle className="h-8 w-8" />
                </div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-green-300">
                  Solicitação concluída
                </p>
                <h2 className="text-2xl font-black text-white">
                  Sua conta foi excluída
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-gray-300">
                  Conforme solicitado, excluímos sua conta de compositor da DCC Music. Enviamos um e-mail de confirmação quando possível.
                </p>
                <p className="mt-3 text-xs text-gray-500">
                  Você será redirecionado para a página inicial em alguns segundos.
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white hover:from-primary-500 hover:to-purple-500"
                >
                  Ir para a página inicial
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
