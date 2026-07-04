'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiArrowLeft, FiLock, FiMail, FiTrendingUp } from 'react-icons/fi'

export default function PartnerLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/partners/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao entrar')

      localStorage.setItem('partner_token', data.token)
      localStorage.setItem('partner_data', JSON.stringify(data.partner))

      if (data.requiresPasswordChange) {
        router.push('/parceiros/trocar-senha')
      } else {
        router.push('/parceiros/admin')
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto max-w-md px-4">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-gray-400 hover:text-white">
          <FiArrowLeft /> Voltar
        </Link>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white">
              <FiTrendingUp className="h-7 w-7" />
            </div>
            <h1 className="text-3xl font-black">
              <span className="gradient-text">Área do Parceiro</span>
            </h1>
            <p className="mt-2 text-sm text-gray-400">Acesse seu gerencial de cliques, cadastros e compras.</p>
          </div>

          {error && <div className="mb-4 rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-300">E-mail</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 py-3 pl-10 pr-4 text-white outline-none focus:border-primary-500"
                  placeholder="parceiro@email.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-gray-300">Senha</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 py-3 pl-10 pr-4 text-white outline-none focus:border-primary-500"
                  placeholder="Senha temporária ou oficial"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary-600 px-4 py-3 font-black text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

