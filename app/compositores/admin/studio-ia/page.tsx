'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FiArrowLeft, FiBarChart2, FiCreditCard, FiFolder, FiImage, FiMic, FiMusic, FiPlus, FiZap } from 'react-icons/fi'

type Project = {
  id: string
  title: string
  style: string | null
  mood: string | null
  status: string
  updatedAt: string
  cover?: { imageUrl: string | null } | null
}

export default function StudioDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async (options?: { silent?: boolean }) => {
    const token = localStorage.getItem('composer_token')
    if (!token) {
      router.push('/compositores/login')
      return
    }

    if (!options?.silent) {
      setLoading(true)
    }

    try {
      const [statusResponse, projectsResponse] = await Promise.all([
        fetch('/api/compositores/studio/status', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
        fetch('/api/compositores/studio/projects', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
      ])

      const statusData = await statusResponse.json()
      if (statusResponse.status === 401) {
        router.push('/compositores/login')
        return
      }

      setAllowed(Boolean(statusData.allowed || statusData.canCreateMusic))
      setStatus(statusData)
      setError('')

      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json()
        setProjects(projectsData.projects || [])
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar Studio IA')
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }, [router])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    const refreshAfterReturn = () => {
      loadDashboard({ silent: true })
    }

    window.addEventListener('focus', refreshAfterReturn)
    window.addEventListener('pageshow', refreshAfterReturn)

    return () => {
      window.removeEventListener('focus', refreshAfterReturn)
      window.removeEventListener('pageshow', refreshAfterReturn)
    }
  }, [loadDashboard])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-14 w-14 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    )
  }

  if (!allowed) {
    const freeMusicRemaining = status?.stats?.freeMusicRemaining || 0
    const creditsRemaining = status?.credits?.remaining || 0

    return (
      <div className="min-h-screen py-6 sm:py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Link href="/compositores/admin" className="mb-6 inline-flex items-center gap-2 text-primary-400 sm:mb-8">
              <FiArrowLeft /> Voltar
            </Link>
            <div className="rounded-2xl border border-purple-700/60 bg-gradient-to-br from-purple-950/60 via-black to-gray-950 p-5 text-center sm:rounded-3xl sm:p-8">
              <FiZap className="mx-auto mb-4 h-12 w-12 text-purple-300" />
              <h1 className="mb-3 text-3xl font-black sm:text-4xl">DCC Studio IA</h1>
              <p className="text-gray-300 mb-6">
                Estúdio musical com IA para quem tem música grátis, plano ativo ou créditos avulsos.
              </p>
              {freeMusicRemaining > 0 && (
                <Link
                  href="/compositores/admin/studio-ia/novo"
                  className="mb-5 block rounded-2xl border border-green-500/50 bg-green-950/30 px-5 py-4 text-green-100 transition hover:border-green-300 hover:bg-green-950/50"
                >
                  <span className="block text-lg font-black">Você tem 1 música grátis para testar, clique aqui.</span>
                  <span className="mt-1 block text-sm text-green-200/85">
                    Crie sua primeira música completa com IA e veja como funciona o DCC Studio IA.
                  </span>
                </Link>
              )}
              {freeMusicRemaining <= 0 && creditsRemaining >= 10 && (
                <Link
                  href="/compositores/admin/studio-ia/novo"
                  className="mb-5 block rounded-2xl border border-green-500/50 bg-green-950/30 px-5 py-4 text-green-100 transition hover:border-green-300 hover:bg-green-950/50"
                >
                  <span className="block text-lg font-black">Você tem {creditsRemaining} créditos disponíveis.</span>
                  <span className="mt-1 block text-sm text-green-200/85">
                    Clique aqui para criar sua próxima música usando sua recarga.
                  </span>
                </Link>
              )}
              <Link href="/studio-ia#planos" className="inline-flex w-full justify-center rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-3 font-semibold sm:w-auto">
                Conhecer plano DCC Studio IA
              </Link>
              <Link href="/compositores/admin/studio-ia/recarga" className="ml-0 mt-3 inline-flex w-full justify-center rounded-xl border border-purple-700 px-6 py-3 font-semibold text-purple-100 hover:bg-purple-950/40 sm:ml-3 sm:mt-0 sm:w-auto">
                Comprar recarga avulsa
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const credits = status?.credits || { used: 0, limit: 200, remaining: 200 }
  const hasStudioPlan = Boolean(status?.hasStudioPlan)
  const creditPercent = credits.limit > 0 ? Math.min(100, Math.round((credits.used / credits.limit) * 100)) : 0
  const remainingMusics = Math.floor((credits.remaining || 0) / 10)
  const recentProjects = projects.slice(0, 6)

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/compositores/admin" className="mb-6 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300 sm:mb-8">
            <FiArrowLeft /> Voltar
          </Link>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mb-6 overflow-hidden rounded-2xl border border-primary-700/50 bg-gradient-to-br from-black via-gray-950 to-purple-950/60 p-5 sm:mb-8 sm:rounded-3xl sm:p-12"
          >
            <div className="absolute -right-24 -top-24 hidden h-72 w-72 rounded-full bg-purple-600/25 blur-3xl sm:block" />
            <div className="absolute -bottom-24 left-10 hidden h-72 w-72 rounded-full bg-primary-500/20 blur-3xl sm:block" />
            <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.65fr] items-center">
              <div>
                <span className="mb-4 inline-flex rounded-full border border-purple-400/40 bg-purple-950/50 px-4 py-2 text-sm text-purple-200">
                  Exclusivo DCC Studio IA
                </span>
                <h1 className="mb-4 text-3xl font-black sm:text-6xl">
                  <span className="gradient-text">DCC Studio IA</span>
                </h1>
                <p className="max-w-3xl text-base text-gray-300 sm:text-xl">
                  Crie músicas completas com Inteligência Artificial, organize projetos, gere capas e publique no DCC Music.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link href="/compositores/admin/studio-ia/novo" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-4 font-bold hover:scale-[1.01] transition">
                    <FiPlus /> Criar Nova Música
                  </Link>
                  <Link href="/compositores/admin/studio-ia/criar-capa" className="inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-900/70 px-6 py-4 font-semibold hover:bg-fuchsia-800 transition">
                    <FiImage /> Criar Capa
                  </Link>
                  <Link href="/compositores/admin/studio-ia/melhorar" className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-900/70 px-6 py-4 font-semibold hover:bg-purple-800 transition">
                    <FiZap /> Melhorar Música
                  </Link>
                  <Link href="/compositores/admin/minhas-vozes" className="inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-900/70 px-6 py-4 font-semibold hover:bg-fuchsia-800 transition">
                    <FiMic /> Minhas Vozes
                  </Link>
                  <Link href="/compositores/admin/studio-ia/projetos" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-800 px-6 py-4 font-semibold hover:bg-gray-700 transition">
                    <FiFolder /> Meus Projetos
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-black/50 p-4 sm:p-6">
                <p className="text-sm font-semibold text-gray-400">Saldo atual</p>
                <p className="mt-1 text-4xl font-black text-green-300">{credits.remaining}</p>
                <p className="mt-1 text-sm text-gray-300">
                  créditos disponíveis, aproximadamente {remainingMusics} música(s)
                </p>
                <div className="mt-5 flex justify-between text-sm mb-3">
                  <span className="text-gray-400">Uso do mês</span>
                  <span className="font-semibold text-primary-300">{credits.used} / {credits.limit}</span>
                </div>
                <div className="h-3 rounded-full bg-gray-800 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-500 to-purple-500" style={{ width: `${creditPercent}%` }} />
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  Gerar música usa 10 créditos. Criar voz aprovada usa 2 créditos. Melhorar capa usa 2 créditos.
                </p>
                {!hasStudioPlan && (
                  <p className="mt-2 text-xs text-purple-200">
                    Você está usando saldo avulso, sem mensalidade.
                  </p>
                )}
                {credits.remaining <= 0 && (
                  <Link
                    href="/compositores/admin/studio-ia/recarga"
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-4 py-3 text-sm font-bold text-white hover:from-primary-500 hover:to-purple-500"
                  >
                    <FiCreditCard />
                    Recarga avulsa
                  </Link>
                )}
              </div>
            </div>
          </motion.section>

          {error && <div className="mb-6 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</div>}

          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4 sm:p-5">
              <FiMusic className="mb-3 h-6 w-6 text-primary-300" />
              <p className="text-2xl font-black">{status?.stats?.musicGenerations || 0} / {status?.stats?.musicLimit || 20}</p>
              <p className="text-sm text-gray-400">músicas geradas no mês</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4 sm:p-5">
              <FiFolder className="mb-3 h-6 w-6 text-primary-300" />
              <p className="text-2xl font-black">{status?.stats?.totalProjects || 0}</p>
              <p className="text-sm text-gray-400">projetos salvos</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4 sm:p-5">
              <FiBarChart2 className="mb-3 h-6 w-6 text-primary-300" />
              <p className="text-2xl font-black">{status?.stats?.publishedProjects || 0}</p>
              <p className="text-sm text-gray-400">publicados no DCC</p>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Projetos recentes</h2>
            <Link href="/compositores/admin/studio-ia/projetos" className="text-sm text-primary-300 hover:text-primary-200">
              Ver todos
            </Link>
          </div>

          {recentProjects.length === 0 ? (
            <div className="rounded-3xl border border-gray-800 bg-gray-950/60 p-10 text-center">
              <p className="text-gray-400 mb-4">Você ainda não criou projetos no Studio.</p>
              <Link href="/compositores/admin/studio-ia/novo" className="inline-flex rounded-xl bg-primary-600 px-5 py-3 font-semibold">
                Criar primeira música
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
              {recentProjects.map((project) => (
                <Link key={project.id} href={`/compositores/admin/studio-ia/projetos/${project.id}`} className="group overflow-hidden rounded-2xl border border-gray-800 bg-gray-950/70 hover:border-primary-500 transition">
                  <div className="aspect-square bg-gradient-to-br from-gray-900 to-purple-950">
                    {project.cover?.imageUrl && <img src={project.cover.imageUrl} alt={project.title} className="h-full w-full object-cover" />}
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="font-bold group-hover:text-primary-300 transition">{project.title}</h3>
                    <p className="text-sm text-gray-400">{project.style || 'Livre'} · {project.status}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
