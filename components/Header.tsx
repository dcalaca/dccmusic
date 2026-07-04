'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { FiMusic, FiPlayCircle, FiHome, FiShield, FiUsers, FiUser, FiLogOut, FiChevronDown, FiZap, FiPlusCircle, FiLock, FiCreditCard } from 'react-icons/fi'

const navItems = [
  { href: '/', label: 'Home', icon: FiHome },
  { href: '/studio-ia', label: 'Studio IA', icon: FiZap },
  { href: '/videos', label: 'Vídeos', icon: FiPlayCircle },
  { href: '/musicas', label: 'Músicas', icon: FiMusic },
  { href: '/compositores', label: 'Compositores Premium', icon: FiUsers },
  { href: '/compositores/planos', label: 'Planos', icon: FiCreditCard },
]

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [composer, setComposer] = useState<any>(null)
  const [composerStudioBalance, setComposerStudioBalance] = useState<number | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Marcar como montado apenas no cliente para evitar hydration mismatch
    setMounted(true)
  }, [])

  useEffect(() => {
    // Só executar no cliente após montagem
    if (!mounted) return
    
    checkAuth()
    
    // Verificar mudanças no localStorage (de outras abas)
    const handleStorageChange = () => {
      checkAuth()
    }
    // Verificar mudanças de autenticação (mesma aba)
    const handleAuthChange = () => {
      checkAuth()
    }
    const handleStudioBalanceChange = (event: Event) => {
      const balance = Number((event as CustomEvent)?.detail?.balance)
      if (Number.isFinite(balance) && balance >= 0) {
        localStorage.setItem('composer_studio_balance', String(balance))
        setComposerStudioBalance(balance)
        return
      }

      const composerToken = localStorage.getItem('composer_token')
      if (composerToken) {
        loadComposerStudioBalance(composerToken)
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('authChange', handleAuthChange)
    window.addEventListener('studioBalanceChange', handleStudioBalanceChange)
    window.addEventListener('focus', handleStudioBalanceChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('authChange', handleAuthChange)
      window.removeEventListener('studioBalanceChange', handleStudioBalanceChange)
      window.removeEventListener('focus', handleStudioBalanceChange)
    }
  }, [mounted, pathname])

  const checkAuth = () => {
    // Verificar se está no cliente antes de acessar localStorage
    if (typeof window === 'undefined') return
    
    const token = localStorage.getItem('site_user_token')
    const userData = localStorage.getItem('site_user_data')
    const composerToken = localStorage.getItem('composer_token')
    const composerData = localStorage.getItem('composer_data')
    const cachedStudioBalance = localStorage.getItem('composer_studio_balance')

    if (composerToken && composerData) {
      try {
        setComposer(JSON.parse(composerData))
        if (cachedStudioBalance !== null) {
          setComposerStudioBalance(Number(cachedStudioBalance) || 0)
        }
        loadComposerStudioBalance(composerToken)
      } catch {
        setComposer(null)
        setComposerStudioBalance(null)
      }
    } else {
      setComposer(null)
      setComposerStudioBalance(null)
    }
    
    if (token && userData) {
      try {
        const user = JSON.parse(userData)
        setIsAuthenticated(true)
        setUser(user)
      } catch (error) {
        setIsAuthenticated(false)
        setUser(null)
      }
    } else {
      setIsAuthenticated(false)
      setUser(null)
    }
  }

  const loadComposerStudioBalance = async (composerToken: string) => {
    try {
      const response = await fetch('/api/compositores/me', {
        headers: { Authorization: `Bearer ${composerToken}` },
        cache: 'no-store',
      })
      if (!response.ok) return
      const data = await response.json()
      let balance = Number(data?.statement?.summary?.currentCreditBalance)

      if (!Number.isFinite(balance)) {
        const fallbackResponse = await fetch('/api/compositores/studio/status', {
          headers: { Authorization: `Bearer ${composerToken}` },
          cache: 'no-store',
        })
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json()
          balance = Number(fallbackData?.credits?.remaining) || 0
        }
      }

      balance = Math.max(0, Number(balance) || 0)
      localStorage.setItem('composer_studio_balance', String(balance))
      setComposerStudioBalance(balance)
    } catch {
      setComposerStudioBalance(null)
    }
  }

  const handleLogout = () => {
    if (typeof window === 'undefined') return
    
    if (confirm('Deseja realmente sair?')) {
      localStorage.removeItem('site_user_token')
      localStorage.removeItem('site_user_data')
      setIsAuthenticated(false)
      setUser(null)
      setShowUserMenu(false)
      router.push('/')
      // Disparar evento para outros componentes atualizarem
      window.dispatchEvent(new Event('storage'))
    }
  }

  const handleComposerLogout = () => {
    if (typeof window === 'undefined') return

    localStorage.removeItem('composer_token')
    localStorage.removeItem('composer_token_temp')
    localStorage.removeItem('composer_data')
    setComposer(null)
    setShowUserMenu(false)
    router.push('/compositores/login')
    window.dispatchEvent(new Event('authChange'))
  }

  const composerDisplayName = composer?.name || composer?.email || 'Compositor'
  const composerInitial = String(composerDisplayName).slice(0, 1).toUpperCase()
  const composerBalanceLabel = composerStudioBalance === null ? null : `${composerStudioBalance} créditos`
  const composerIsPremium = Boolean(composer?.isPremium)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-black">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 flex-col gap-2 py-2 md:h-16 md:flex-row md:items-center md:justify-between md:py-0">
          <div className="flex w-full min-w-0 items-center justify-between md:flex-1 md:space-x-4">
            <Link href="/" className="flex shrink-0 items-center space-x-2">
              <Image
                src="/logopng.png"
                alt="DCC Music"
                width={150}
                height={50}
                className="h-9 w-auto sm:h-12"
                priority
              />
            </Link>

            {/* Navegação à esquerda */}
            <nav className="hidden min-w-0 flex-1 items-center space-x-1 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-color:#374151_transparent] [scrollbar-width:thin] md:flex">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex shrink-0 items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-primary-600 text-white neon-glow'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Botões à direita */}
          <nav className="hidden shrink-0 items-center space-x-2 md:flex">
            {/* Usuário comum só aparece se já estiver logado pelo fluxo de avaliação */}
            {mounted && !composer && isAuthenticated && user && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-all"
                >
                  <FiUser className="w-4 h-4" />
                  <span className="max-w-[100px] truncate">{user.firstName || user.name}</span>
                  <FiChevronDown className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden z-50">
                    <Link
                      href="/minha-conta"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center space-x-2 px-4 py-3 hover:bg-gray-800 transition-colors"
                    >
                      <FiUser className="w-4 h-4" />
                      <span>Minha Conta</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-2 px-4 py-3 hover:bg-gray-800 transition-colors text-left text-red-400"
                    >
                      <FiLogOut className="w-4 h-4" />
                      <span>Sair</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {mounted && composer ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 rounded-lg bg-gradient-to-r from-primary-600 to-purple-600 px-3 py-2 font-medium text-white transition-all hover:from-primary-700 hover:to-purple-700"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-sm font-black">
                    {composerInitial}
                  </span>
                  <span className="max-w-[130px] truncate">{composerDisplayName}</span>
                  {composerBalanceLabel && (
                    <span className="rounded-full bg-black/25 px-2 py-1 text-xs font-black text-green-200">
                      {composerBalanceLabel}
                    </span>
                  )}
                  <FiChevronDown className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-lg">
                    <div className="border-b border-gray-700 px-4 py-3">
                      <div className="truncate text-sm font-bold">{composerDisplayName}</div>
                      <div className="truncate text-xs text-gray-400">{composer.email}</div>
                      {composerBalanceLabel && (
                        <div className="mt-2 inline-flex rounded-full border border-green-700 bg-green-950/40 px-3 py-1 text-xs font-bold text-green-200">
                          Saldo Studio IA: {composerBalanceLabel}
                        </div>
                      )}
                    </div>
                    <Link
                      href="/compositores/admin/studio-ia/projetos"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center space-x-2 border-b border-gray-800 px-4 py-3 transition-colors hover:bg-gray-800"
                    >
                      <FiZap className="w-4 h-4" />
                      <span>Meu Studio IA</span>
                    </Link>
                    <div className="border-b border-gray-800 py-2">
                      <div className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                        Composições
                      </div>
                      {composerIsPremium ? (
                        <>
                          <Link
                            href="/compositores/admin/musicas/nova"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center space-x-2 px-4 py-2.5 transition-colors hover:bg-gray-800"
                          >
                            <FiPlusCircle className="w-4 h-4" />
                            <span>Cadastrar música</span>
                          </Link>
                          <Link
                            href="/compositores/admin/musicas"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center space-x-2 px-4 py-2.5 transition-colors hover:bg-gray-800"
                          >
                            <FiMusic className="w-4 h-4" />
                            <span>Minhas músicas</span>
                          </Link>
                          <Link
                            href="/compositores/admin/videos"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center space-x-2 px-4 py-2.5 transition-colors hover:bg-gray-800"
                          >
                            <FiPlayCircle className="w-4 h-4" />
                            <span>Meus vídeos</span>
                          </Link>
                        </>
                      ) : (
                        <Link
                          href="/compositores/admin/musicas"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-start space-x-2 px-4 py-2.5 text-yellow-200 transition-colors hover:bg-gray-800"
                        >
                          <FiLock className="mt-0.5 w-4 h-4" />
                          <span>
                            <span className="block">Composições Premium</span>
                            <span className="block text-xs text-gray-400">Ver aviso e planos de compositor</span>
                          </span>
                        </Link>
                      )}
                    </div>
                    <div className="py-2">
                      <Link
                        href="/compositores/admin/meus-dados"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center space-x-2 px-4 py-2.5 transition-colors hover:bg-gray-800"
                      >
                        <FiUser className="w-4 h-4" />
                        <span>Meus dados</span>
                      </Link>
                      <button
                        onClick={handleComposerLogout}
                        className="flex w-full items-center space-x-2 px-4 py-2.5 text-left text-red-400 transition-colors hover:bg-gray-800"
                      >
                        <FiLogOut className="w-4 h-4" />
                        <span>Sair</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/compositores/admin"
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white font-medium transition-all"
              >
                <FiShield className="w-4 h-4" />
                <span>Acesso do Compositor</span>
              </Link>
            )}
          </nav>

          {/* Mobile menu */}
          <nav className="flex w-full items-center gap-2 md:hidden">
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-primary-600 text-white neon-glow'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                    title={item.label}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
            
            {/* Mobile: usuário comum só aparece se já estiver logado pelo fluxo de avaliação */}
            {mounted && !composer && isAuthenticated && user && (
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="p-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-all"
                  title={user.firstName || user.name}
                >
                  <FiUser className="w-5 h-5" />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden z-50">
                    <div className="px-4 py-2 border-b border-gray-700">
                      <div className="font-medium text-sm">{user.name}</div>
                      <div className="text-xs text-gray-400">{user.email}</div>
                    </div>
                    <Link
                      href="/minha-conta"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center space-x-2 px-4 py-3 hover:bg-gray-800 transition-colors"
                    >
                      <FiUser className="w-4 h-4" />
                      <span>Minha Conta</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-2 px-4 py-3 hover:bg-gray-800 transition-colors text-left text-red-400"
                    >
                      <FiLogOut className="w-4 h-4" />
                      <span>Sair</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {mounted && composer ? (
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex min-h-10 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-primary-600 to-purple-600 px-2 text-sm font-black text-white transition-all hover:from-primary-700 hover:to-purple-700"
                  title={composerDisplayName}
                >
                  <span>{composerInitial}</span>
                  {composerBalanceLabel && <span className="text-[10px] font-bold text-green-100">{composerStudioBalance}</span>}
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-lg">
                    <div className="border-b border-gray-700 px-4 py-3">
                      <div className="truncate text-sm font-bold">{composerDisplayName}</div>
                      <div className="truncate text-xs text-gray-400">{composer.email}</div>
                      {composerBalanceLabel && (
                        <div className="mt-2 inline-flex rounded-full border border-green-700 bg-green-950/40 px-3 py-1 text-xs font-bold text-green-200">
                          Saldo Studio IA: {composerBalanceLabel}
                        </div>
                      )}
                    </div>
                    <Link
                      href="/compositores/admin/studio-ia/projetos"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center space-x-2 border-b border-gray-800 px-4 py-3 transition-colors hover:bg-gray-800"
                    >
                      <FiZap className="w-4 h-4" />
                      <span>Meu Studio IA</span>
                    </Link>
                    <div className="border-b border-gray-800 py-2">
                      <div className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                        Composições
                      </div>
                      {composerIsPremium ? (
                        <>
                          <Link
                            href="/compositores/admin/musicas/nova"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center space-x-2 px-4 py-2.5 transition-colors hover:bg-gray-800"
                          >
                            <FiPlusCircle className="w-4 h-4" />
                            <span>Cadastrar música</span>
                          </Link>
                          <Link
                            href="/compositores/admin/musicas"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center space-x-2 px-4 py-2.5 transition-colors hover:bg-gray-800"
                          >
                            <FiMusic className="w-4 h-4" />
                            <span>Minhas músicas</span>
                          </Link>
                          <Link
                            href="/compositores/admin/videos"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center space-x-2 px-4 py-2.5 transition-colors hover:bg-gray-800"
                          >
                            <FiPlayCircle className="w-4 h-4" />
                            <span>Meus vídeos</span>
                          </Link>
                        </>
                      ) : (
                        <Link
                          href="/compositores/admin/musicas"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-start space-x-2 px-4 py-2.5 text-yellow-200 transition-colors hover:bg-gray-800"
                        >
                          <FiLock className="mt-0.5 w-4 h-4" />
                          <span>
                            <span className="block">Composições Premium</span>
                            <span className="block text-xs text-gray-400">Ver aviso e planos de compositor</span>
                          </span>
                        </Link>
                      )}
                    </div>
                    <div className="py-2">
                      <Link
                        href="/compositores/admin/meus-dados"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center space-x-2 px-4 py-2.5 transition-colors hover:bg-gray-800"
                      >
                        <FiUser className="w-4 h-4" />
                        <span>Meus dados</span>
                      </Link>
                      <button
                        onClick={handleComposerLogout}
                        className="flex w-full items-center space-x-2 px-4 py-2.5 text-left text-red-400 transition-colors hover:bg-gray-800"
                      >
                        <FiLogOut className="w-4 h-4" />
                        <span>Sair</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/compositores/admin"
                className="shrink-0 rounded-lg bg-gradient-to-r from-primary-600 to-purple-600 p-2 text-white transition-all hover:from-primary-700 hover:to-purple-700"
                title="Acesso do Compositor"
              >
                <FiShield className="w-5 h-5" />
              </Link>
            )}
          </nav>
        </div>
      </div>
      
      {/* Overlay para fechar menu ao clicar fora */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </header>
  )
}
