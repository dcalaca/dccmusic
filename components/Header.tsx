'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { FiMusic, FiPlayCircle, FiHome, FiCompass, FiShield, FiUsers, FiUser, FiLogOut, FiZap, FiPlusCircle, FiLock, FiCreditCard, FiFileText, FiGlobe, FiBookOpen } from 'react-icons/fi'
import NotificationBell from './NotificationBell'
import CountrySelector from './CountrySelector'
import {
  clearComposerSessionCookie,
  isComposerBlogSubdomain,
  readComposerSessionCookie,
  writeComposerSessionCookie,
} from '@/lib/composer-session-cookie'

function HeaderComposerAvatar({
  name,
  composerId,
}: {
  name: string
  composerId?: string
}) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const photoUrl = composerId ? `/api/compositores/avatar/${composerId}` : null
  const showPhoto = Boolean(photoUrl) && !photoFailed
  const initial = String(name || 'C').trim().slice(0, 1).toUpperCase() || 'C'

  return (
    <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary-600 to-purple-600 text-sm font-black text-white">
      <span aria-hidden={showPhoto}>{initial}</span>
      {showPhoto ? (
        <img
          src={photoUrl!}
          alt=""
          onError={() => setPhotoFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </span>
  )
}

const siteNavItems = [
  { id: 'home', href: '/', labelKey: 'menu.home', icon: FiHome },
  { id: 'create-song', href: '/studio-ia', labelKey: 'menu.createSong', mobileLabelKey: 'menu.createSongMobile', icon: FiZap },
  { id: 'distribution', href: '/distribuicao-digital', labelKey: 'menu.spotifyPlatforms', mobileLabelKey: 'menu.spotify', icon: FiGlobe },
  { id: 'plans', href: '/compositores/planos', labelKey: 'menu.plans', icon: FiCreditCard },
  { id: 'explore', href: '/musicas', labelKey: 'menu.explore', icon: FiCompass },
  { id: 'chords', href: '/transcricao-musical', labelKey: 'menu.songChords', mobileLabelKey: 'menu.chords', icon: FiFileText },
  { id: 'premium-composers', href: '/compositores', labelKey: 'menu.premiumComposers', mobileLabelKey: 'menu.composers', icon: FiUsers },
]
export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const [composer, setComposer] = useState<any>(null)
  const [composerHasToken, setComposerHasToken] = useState(false)
  const [composerStudioBalance, setComposerStudioBalance] = useState<number | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showBell, setShowBell] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [surface, setSurface] = useState<'blog' | 'site'>('site')

  useEffect(() => {
    setMounted(true)
    const host = window.location.hostname
    const isBlog = host.startsWith('blog.') || window.location.pathname.startsWith('/blog')
    setSurface(isBlog ? 'blog' : 'site')
  }, [pathname])

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
    
    const composerToken = localStorage.getItem('composer_token')
    const composerData = localStorage.getItem('composer_data')
    const cachedStudioBalance = localStorage.getItem('composer_studio_balance')

    if (composerToken && composerData) {
      try {
        const parsed = JSON.parse(composerData)
        setComposer(parsed)
        setComposerHasToken(true)
        writeComposerSessionCookie(parsed)
        if (cachedStudioBalance !== null) {
          setComposerStudioBalance(Number(cachedStudioBalance) || 0)
        }
        loadComposerStudioBalance(composerToken)
      } catch {
        setComposer(null)
        setComposerHasToken(false)
        setComposerStudioBalance(null)
      }
      return
    }

    // No blog o login fica em outro subdomínio (www), então o localStorage não existe.
    // O cookie compartilhado só serve para o cabeçalho reconhecer o compositor.
    if (isComposerBlogSubdomain()) {
      const preview = readComposerSessionCookie()
      if (preview) {
        setComposer(preview)
        setComposerHasToken(false)
        setComposerStudioBalance(null)
        return
      }
    } else {
      clearComposerSessionCookie()
    }

    setComposer(null)
    setComposerHasToken(false)
    setComposerStudioBalance(null)
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

  const handleComposerLogout = () => {
    if (typeof window === 'undefined') return

    localStorage.removeItem('composer_token')
    localStorage.removeItem('composer_token_temp')
    localStorage.removeItem('composer_data')
    clearComposerSessionCookie()
    setComposer(null)
    setComposerHasToken(false)
    setShowUserMenu(false)
    setShowBell(false)
    router.push('/compositores/login')
    window.dispatchEvent(new Event('authChange'))
  }

  const copy = {
    composer: t('header.composer'),
    studioBalance: t('header.studioBalance'),
    myStudio: t('header.myStudio'),
    compositions: t('header.compositions'),
    addSong: t('header.addSong'),
    mySongs: t('header.mySongs'),
    myVideos: t('header.myVideos'),
    premiumCompositions: t('header.premiumCompositions'),
    viewPlans: t('header.viewPlans'),
    account: t('header.account'),
    logout: t('header.logout'),
    composerAccess: t('header.composerAccess'),
  }
  const activeLanguage = i18n.resolvedLanguage || i18n.language || 'pt-BR'
  const showBlog = !mounted || activeLanguage.startsWith('pt')

  const composerDisplayName = composer?.name || composer?.email || copy.composer
  const composerBalanceLabel = composerStudioBalance === null ? null : t('header.credits', { count: composerStudioBalance })
  const composerIsPremium = Boolean(composer?.isPremium)
  const isLocal = mounted && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  const blogHomeHref = !mounted
    ? '/blog'
    : surface === 'blog'
      ? pathname.startsWith('/blog')
        ? '/blog'
        : '/'
      : isLocal
        ? '/blog'
        : 'https://blog.dccmusic.online'
  const siteHomeHref = mounted && surface === 'blog' && !isLocal ? 'https://www.dccmusic.online/' : '/'
  const navItems = [
    {
      id: 'home',
      href: surface === 'blog' ? siteHomeHref : '/',
      label: t('menu.home'),
      mobileLabel: t('menu.home'),
      icon: FiHome,
    },
    ...siteNavItems
      .filter((item) => item.id !== 'home')
      .map((item) => ({
        ...item,
        label: t(item.labelKey),
        mobileLabel: t('mobileLabelKey' in item && typeof item.mobileLabelKey === 'string' ? item.mobileLabelKey : item.labelKey),
      })),
    ...(showBlog ? [{ id: 'blog', href: blogHomeHref, label: t('menu.blog'), mobileLabel: t('menu.blog'), icon: FiBookOpen }] : []),
  ]
  const logoHref = surface === 'blog' ? (pathname.startsWith('/blog') ? '/blog' : '/') : '/'

  const isNavActive = (item: { href: string; id: string }) => {
    if (item.id === 'blog') {
      return surface === 'blog' || pathname === '/blog' || pathname.startsWith('/blog/')
    }
    if (item.id === 'home') {
      return pathname === '/' && surface !== 'blog'
    }

    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`)
    if (!matches) return false

    const hasMoreSpecificMatch = navItems.some((other) => {
      if (other.href === item.href || other.id === 'home' || other.id === 'blog') return false
      if (other.href.length <= item.href.length) return false
      return pathname === other.href || pathname.startsWith(`${other.href}/`)
    })

    return !hasMoreSpecificMatch
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-black">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-16 flex-col gap-2 py-2 md:h-16 md:flex-row md:items-center md:justify-between md:py-0">
          <div className="flex w-full min-w-0 items-center justify-between md:flex-1 md:space-x-4">
            <Link href={logoHref} className="flex shrink-0 items-center space-x-2">
              <Image
                src="/logopng.png"
                alt="DCC Music"
                width={150}
                height={50}
                className="h-9 w-auto sm:h-12"
                priority
              />
            </Link>

            <div className="shrink-0 md:hidden">
              <CountrySelector compact />
            </div>

            {/* Navegação à esquerda */}
            <nav className="hidden min-w-0 flex-1 items-center space-x-1 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-color:#374151_transparent] [scrollbar-width:thin] md:flex">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = isNavActive(item)
                return (
                  <Link
                    key={item.id}
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
            <CountrySelector />
            {mounted && composer ? (
              <>
              {composerHasToken ? (
              <NotificationBell
                open={showBell}
                onOpenChange={(open) => {
                  setShowBell(open)
                  if (open) setShowUserMenu(false)
                }}
              />
              ) : null}
              <div className="relative z-[120]">
                <button
                  onClick={() => {
                    setShowUserMenu(!showUserMenu)
                    setShowBell(false)
                  }}
                  className="rounded-full ring-2 ring-white/15 transition hover:ring-white/35"
                  title={composerDisplayName}
                >
                  <HeaderComposerAvatar name={composerDisplayName} composerId={composer?.id} />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 z-[130] mt-2 w-60 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-2xl shadow-black/50">
                    <div className="border-b border-gray-700 px-4 py-3">
                      <div className="truncate text-sm font-bold">{composerDisplayName}</div>
                      <div className="truncate text-xs text-gray-400">{composer.email}</div>
                      {composerBalanceLabel && (
                        <div className="mt-2 inline-flex rounded-full border border-green-700 bg-green-950/40 px-3 py-1 text-xs font-bold text-green-200">
                          {copy.studioBalance}: {composerBalanceLabel}
                        </div>
                      )}
                    </div>
                    <Link
                      href="/compositores/admin/studio-ia/projetos"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center space-x-2 border-b border-gray-800 px-4 py-3 transition-colors hover:bg-gray-800"
                    >
                      <FiZap className="w-4 h-4" />
                      <span>{copy.myStudio}</span>
                    </Link>
                    <div className="border-b border-gray-800 py-2">
                      <div className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                        {copy.compositions}
                      </div>
                      {composerIsPremium ? (
                        <>
                          <Link
                            href="/compositores/admin/musicas/nova"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center space-x-2 px-4 py-2.5 transition-colors hover:bg-gray-800"
                          >
                            <FiPlusCircle className="w-4 h-4" />
                            <span>{copy.addSong}</span>
                          </Link>
                          <Link
                            href="/compositores/admin/musicas"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center space-x-2 px-4 py-2.5 transition-colors hover:bg-gray-800"
                          >
                            <FiMusic className="w-4 h-4" />
                            <span>{copy.mySongs}</span>
                          </Link>
                          <Link
                            href="/compositores/admin/videos"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center space-x-2 px-4 py-2.5 transition-colors hover:bg-gray-800"
                          >
                            <FiPlayCircle className="w-4 h-4" />
                            <span>{copy.myVideos}</span>
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
                            <span className="block">{copy.premiumCompositions}</span>
                            <span className="block text-xs text-gray-400">{copy.viewPlans}</span>
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
                        <span>{copy.account}</span>
                      </Link>
                      <button
                        onClick={handleComposerLogout}
                        className="flex w-full items-center space-x-2 px-4 py-2.5 text-left text-red-400 transition-colors hover:bg-gray-800"
                      >
                        <FiLogOut className="w-4 h-4" />
                        <span>{copy.logout}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </>
            ) : (
              <Link
                href="/compositores/admin"
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white font-medium transition-all"
              >
                <FiShield className="w-4 h-4" />
                <span>{copy.composerAccess}</span>
              </Link>
            )}
          </nav>

          {/* Mobile menu */}
          <nav className="flex w-full min-w-0 items-center gap-2 md:hidden">
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = isNavActive(item)
                const mobileLabel = item.mobileLabel || item.label
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition-all sm:px-3 sm:text-xs ${
                      isActive
                        ? 'bg-primary-600 text-white neon-glow'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                    title={item.label}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap">{mobileLabel}</span>
                  </Link>
                )
              })}
            </div>
            {mounted && composer ? (
              <div className="flex shrink-0 items-center gap-1">
              {composerHasToken ? (
              <NotificationBell
                open={showBell}
                onOpenChange={(open) => {
                  setShowBell(open)
                  if (open) setShowUserMenu(false)
                }}
              />
              ) : null}
              <div className="relative z-[120] shrink-0">
                <button
                  onClick={() => {
                    setShowUserMenu(!showUserMenu)
                    setShowBell(false)
                  }}
                  className="rounded-full ring-2 ring-white/15 transition hover:ring-white/35"
                  title={composerDisplayName}
                >
                  <HeaderComposerAvatar name={composerDisplayName} composerId={composer?.id} />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 z-[130] mt-2 w-60 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-2xl shadow-black/50">
                    <div className="border-b border-gray-700 px-4 py-3">
                      <div className="truncate text-sm font-bold">{composerDisplayName}</div>
                      <div className="truncate text-xs text-gray-400">{composer.email}</div>
                      {composerBalanceLabel && (
                        <div className="mt-2 inline-flex rounded-full border border-green-700 bg-green-950/40 px-3 py-1 text-xs font-bold text-green-200">
                          {copy.studioBalance}: {composerBalanceLabel}
                        </div>
                      )}
                    </div>
                    <Link
                      href="/compositores/admin/studio-ia/projetos"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center space-x-2 border-b border-gray-800 px-4 py-3 transition-colors hover:bg-gray-800"
                    >
                      <FiZap className="w-4 h-4" />
                      <span>{copy.myStudio}</span>
                    </Link>
                    <div className="border-b border-gray-800 py-2">
                      <div className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                        {copy.compositions}
                      </div>
                      {composerIsPremium ? (
                        <>
                          <Link
                            href="/compositores/admin/musicas/nova"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center space-x-2 px-4 py-2.5 transition-colors hover:bg-gray-800"
                          >
                            <FiPlusCircle className="w-4 h-4" />
                            <span>{copy.addSong}</span>
                          </Link>
                          <Link
                            href="/compositores/admin/musicas"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center space-x-2 px-4 py-2.5 transition-colors hover:bg-gray-800"
                          >
                            <FiMusic className="w-4 h-4" />
                            <span>{copy.mySongs}</span>
                          </Link>
                          <Link
                            href="/compositores/admin/videos"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center space-x-2 px-4 py-2.5 transition-colors hover:bg-gray-800"
                          >
                            <FiPlayCircle className="w-4 h-4" />
                            <span>{copy.myVideos}</span>
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
                            <span className="block">{copy.premiumCompositions}</span>
                            <span className="block text-xs text-gray-400">{copy.viewPlans}</span>
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
                        <span>{copy.account}</span>
                      </Link>
                      <button
                        onClick={handleComposerLogout}
                        className="flex w-full items-center space-x-2 px-4 py-2.5 text-left text-red-400 transition-colors hover:bg-gray-800"
                      >
                        <FiLogOut className="w-4 h-4" />
                        <span>{copy.logout}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </div>
            ) : (
              <Link
                href="/compositores/admin"
                className="shrink-0 rounded-lg bg-gradient-to-r from-primary-600 to-purple-600 p-2 text-white transition-all hover:from-primary-700 hover:to-purple-700"
                title={copy.composerAccess}
              >
                <FiShield className="w-5 h-5" />
              </Link>
            )}
          </nav>
        </div>
      </div>
      
      {/* Overlay para fechar menu ao clicar fora */}
      {(showUserMenu || showBell) && (
        <div
          className="fixed inset-0 z-[110]"
          onClick={() => {
            setShowUserMenu(false)
            setShowBell(false)
          }}
        />
      )}
    </header>
  )
}