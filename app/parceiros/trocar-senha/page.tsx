'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiLock } from 'react-icons/fi'

export default function PartnerChangePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    const token = localStorage.getItem('partner_token')
    if (!token) {
      router.push('/parceiros/login')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/partners/change-password', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao trocar senha')

      localStorage.setItem('partner_token', data.token)
      router.push('/parceiros/admin')
    } catch (err: any) {
      setError(err.message || 'Erro ao trocar senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto max-w-md px-4">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-600 text-white">
              <FiLock className="h-7 w-7" />
            </div>
            <h1 className="text-3xl font-black text-white">Crie sua senha oficial</h1>
            <p className="mt-2 text-sm text-gray-400">
              A senha `123` é temporária. Para continuar, defina uma senha segura.
            </p>
          </div>

          {error && <div className="mb-4 rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-300">Nova senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-primary-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-gray-300">Confirmar senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-primary-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary-600 px-4 py-3 font-black text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {loading ? 'Salvando...' : 'Salvar senha e entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

