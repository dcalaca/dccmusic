'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiMusic, FiPlayCircle, FiCreditCard, FiLogOut, FiUser, FiCheckCircle, FiImage, FiMail, FiZap } from 'react-icons/fi'

export default function ComposerAdminPage() {
  const router = useRouter()
  const [composer, setComposer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [canUseAiCovers, setCanUseAiCovers] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('composer_token')
    const composerData = localStorage.getItem('composer_data')

    if (!token || !composerData) {
      router.push('/compositores/login')
      return
    }

    try {
      const data = JSON.parse(composerData)
      setComposer(data)
      loadAiCoverAccess(token)
    } catch (error) {
      router.push('/compositores/login')
    } finally {
      setLoading(false)
    }
  }, [router])

  const loadAiCoverAccess = async (token: string) => {
    try {
      const response = await fetch('/api/compositores/capas-ia', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })

      setCanUseAiCovers(response.ok)
    } catch {
      setCanUseAiCovers(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('composer_token')
    localStorage.removeItem('composer_data')
    router.push('/compositores/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    )
  }

  if (!composer) {
    return null
  }

  const cancelPlanEmail = `mailto:suporte@dccmusic.online?subject=${encodeURIComponent('Solicitar cancelamento de plano DCCMusic')}&body=${encodeURIComponent(`Olá, quero solicitar o cancelamento do meu plano DCCMusic.\n\nNome: ${composer.name}\nPágina: /compositores/${composer.slug}\n\nObrigado.`)}`

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                <span className="gradient-text">Área do Compositor</span>
              </h1>
              <p className="text-gray-400">
                Bem-vindo, {composer.name}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FiLogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>

          {/* Status da Assinatura */}
          {composer.isPremium ? (
            <div className="bg-green-900/50 border border-green-800 rounded-lg p-6 mb-8">
              <div className="flex items-center space-x-3">
                <FiCheckCircle className="w-6 h-6 text-green-400" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-300">Assinatura Ativa</h3>
                  <p className="text-sm text-gray-400">
                    Você pode cadastrar músicas e vídeos ilimitados
                  </p>
                  {(composer.subscription_expires_at || composer.subscriptionExpiresAt) && (
                    <p className="text-sm text-green-400 mt-1">
                      Assinatura válida até {new Date(composer.subscription_expires_at || composer.subscriptionExpiresAt).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-900/50 border border-yellow-800 rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FiCreditCard className="w-6 h-6 text-yellow-400" />
                  <div>
                    <h3 className="font-semibold text-yellow-300">Assinatura Necessária</h3>
                    <p className="text-sm text-gray-400">
                      Assine um plano para cadastrar suas músicas e vídeos
                    </p>
                  </div>
                </div>
                <Link
                  href="/compositores/planos"
                  className="px-4 py-2 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium"
                >
                  Ver Planos
                </Link>
              </div>
            </div>
          )}

          {/* Cards de Ação */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {!composer.isPremium && (
              <Link
                href="/compositores/planos"
                className="bg-gradient-to-br from-primary-900/50 to-purple-900/50 border-2 border-primary-500 rounded-lg p-6 hover:border-primary-400 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 px-3 py-1 bg-primary-600 text-white text-xs font-bold rounded-bl-lg">
                  NOVO
                </div>
                <FiCreditCard className="w-8 h-8 text-primary-400 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-semibold mb-2 text-white">Assinar Plano Premium</h3>
                <p className="text-gray-300 text-sm mb-2">
                  Ganhe acesso completo ao sistema
                </p>
                <p className="text-primary-300 text-xs font-semibold">
                  Ver planos disponíveis →
                </p>
              </Link>
            )}
            
            <Link
              href="/compositores/admin/musicas"
              className={`bg-gray-900/50 border rounded-lg p-6 hover:border-primary-500 transition-all group ${!composer.isPremium ? 'border-gray-800 opacity-60' : 'border-gray-800'}`}
            >
              <FiMusic className="w-8 h-8 text-primary-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-semibold mb-2">Minhas Músicas</h3>
              <p className="text-gray-400 text-sm">
                Gerencie suas músicas cadastradas
              </p>
            </Link>

            <Link
              href="/compositores/admin/videos"
              className={`bg-gray-900/50 border rounded-lg p-6 hover:border-primary-500 transition-all group ${!composer.isPremium ? 'border-gray-800 opacity-60' : 'border-gray-800'}`}
            >
              <FiPlayCircle className="w-8 h-8 text-primary-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-semibold mb-2">Meus Vídeos</h3>
              <p className="text-gray-400 text-sm">
                Gerencie seus vídeos cadastrados
              </p>
            </Link>

            <Link
              href={`/compositores/${composer.slug}`}
              target="_blank"
              className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 hover:border-primary-500 transition-all group"
            >
              <FiUser className="w-8 h-8 text-primary-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-semibold mb-2">Minha Página</h3>
              <p className="text-gray-400 text-sm">
                Ver sua página pública
              </p>
            </Link>

            {canUseAiCovers && (
              <Link
                href="/compositores/admin/capas-ia"
                className="relative overflow-hidden bg-gradient-to-br from-purple-950/80 via-gray-950 to-primary-950/70 border border-primary-500/60 rounded-lg p-6 hover:border-primary-300 transition-all group"
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary-500/20 blur-2xl" />
                <FiImage className="relative w-8 h-8 text-primary-300 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="relative text-xl font-semibold mb-2">Gerador de Capas IA</h3>
                <p className="relative text-gray-300 text-sm mb-3">
                  Crie capas profissionais para suas músicas com Inteligência Artificial.
                </p>
                <span className="relative inline-flex rounded-full bg-yellow-500/20 border border-yellow-500/40 px-3 py-1 text-xs font-semibold text-yellow-200">
                  Exclusivo Plano Ouro
                </span>
              </Link>
            )}

            <Link
              href="/compositores/admin/studio-ia"
              className="relative overflow-hidden bg-gradient-to-br from-black via-purple-950/70 to-gray-950 border border-purple-500/60 rounded-lg p-6 hover:border-purple-300 transition-all group"
            >
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-purple-500/25 blur-2xl" />
              <FiZap className="relative w-8 h-8 text-purple-300 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="relative text-xl font-semibold mb-2">✨ DCC Studio IA</h3>
              <p className="relative text-gray-300 text-sm mb-3">
                Crie músicas completas com Inteligência Artificial.
              </p>
              <ul className="relative mb-3 space-y-1 text-xs text-gray-400">
                <li>Gere letras profissionais</li>
                <li>Transforme letras em músicas</li>
                <li>Crie capas automáticas</li>
                <li>Organize projetos musicais</li>
              </ul>
              <span className="relative inline-flex rounded-full bg-purple-500/20 border border-purple-500/40 px-3 py-1 text-xs font-semibold text-purple-200">
                Exclusivo DCC Studio IA
              </span>
            </Link>
          </div>

          {/* Informações */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Informações da Conta</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Nome:</span>
                <span className="text-white">{composer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={composer.isPremium ? 'text-green-400' : 'text-yellow-400'}>
                  {composer.isPremium ? 'Premium' : 'Básico'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Página:</span>
                <Link
                  href={`/compositores/${composer.slug}`}
                  className="text-primary-400 hover:text-primary-300"
                  target="_blank"
                >
                  /compositores/{composer.slug}
                </Link>
              </div>
            </div>

            <div className="mt-6 border-t border-gray-800 pt-6">
              <h4 className="text-base font-semibold mb-2">Gerenciar Plano</h4>
              <p className="text-sm text-gray-400 mb-4">
                Você pode trocar de plano quando quiser. Para cancelar, envie uma solicitação para o suporte da DCCMusic.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/compositores/planos"
                  className="inline-flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium"
                >
                  <FiCreditCard className="w-4 h-4" />
                  <span>Upgrade / Downgrade</span>
                </Link>
                <a
                  href={cancelPlanEmail}
                  className="inline-flex items-center justify-center space-x-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all font-medium text-gray-200"
                >
                  <FiMail className="w-4 h-4" />
                  <span>Solicitar cancelamento</span>
                </a>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                O cancelamento manual evita perda indevida de acesso antes do fim do período já pago.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
