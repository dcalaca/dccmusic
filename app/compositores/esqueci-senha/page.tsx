'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiArrowLeft, FiCheckCircle, FiMail } from 'react-icons/fi'

export default function ForgotComposerPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch('/api/compositores/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao solicitar nova senha')

      setSuccess(data.message || 'Se este e-mail estiver cadastrado, enviaremos um link para criar uma nova senha.')
    } catch (err: any) {
      setError(err.message || 'Erro ao solicitar nova senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-2">
              <span className="gradient-text">Esqueci minha senha</span>
            </h1>
            <p className="text-gray-400">
              Informe seu e-mail de compositor para receber o link de redefinição.
            </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8">
            {error && (
              <div className="mb-5 bg-red-900/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-5 bg-green-900/50 border border-green-800 text-green-300 px-4 py-3 rounded-lg text-sm">
                <div className="flex gap-3">
                  <FiCheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span>{success}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  E-mail
                </label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Enviando...' : 'Enviar link para nova senha'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-800 text-center">
              <Link
                href="/compositores/login"
                className="inline-flex items-center justify-center gap-2 text-sm text-primary-400 hover:text-primary-300"
              >
                <FiArrowLeft />
                Voltar para o login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
