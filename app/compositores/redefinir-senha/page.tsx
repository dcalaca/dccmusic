'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FiEye, FiEyeOff, FiLock } from 'react-icons/fi'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Link inválido. Solicite um novo link de redefinição de senha.')
      return
    }

    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/compositores/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao criar nova senha')

      router.push('/compositores/login?passwordChanged=true')
    } catch (err: any) {
      setError(err.message || 'Erro ao criar nova senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8">
      {!token && (
        <div className="mb-5 bg-red-900/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm">
          Link inválido. Solicite um novo link de redefinição de senha.
        </div>
      )}

      {error && (
        <div className="mb-5 bg-red-900/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2">
            Nova senha
          </label>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-10 pr-12 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="Mínimo 6 caracteres"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
            >
              {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Confirmar nova senha
          </label>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-10 pr-12 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="Digite a senha novamente"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
            >
              {showConfirmPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !token}
          className="w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-800 text-center">
        <Link href="/compositores/esqueci-senha" className="text-sm text-primary-400 hover:text-primary-300">
          Solicitar outro link
        </Link>
      </div>
    </div>
  )
}

export default function ResetComposerPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    }>
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-md mx-auto">
            <div className="mb-8 text-center">
              <h1 className="text-4xl font-bold mb-2">
                <span className="gradient-text">Criar nova senha</span>
              </h1>
              <p className="text-gray-400">
                Digite uma senha nova para voltar a acessar sua conta de compositor.
              </p>
            </div>

            <ResetPasswordForm />
          </div>
        </div>
      </div>
    </Suspense>
  )
}
