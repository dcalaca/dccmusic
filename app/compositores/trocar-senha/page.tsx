'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FiLock, FiEye, FiEyeOff, FiAlertCircle } from 'react-icons/fi'

export default function ComposerChangePasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    // Verificar se tem token temporário
    const tempToken = localStorage.getItem('composer_token_temp')
    if (!tempToken) {
      router.push('/compositores/login')
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validações
    if (!formData.newPassword || formData.newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    if (formData.newPassword === '123') {
      setError('Por favor, escolha uma senha diferente de "123"')
      return
    }

    try {
      setLoading(true)
      const tempToken = localStorage.getItem('composer_token_temp')
      
      if (!tempToken) {
        throw new Error('Sessão expirada. Por favor, faça login novamente.')
      }

      const response = await fetch('/api/compositores/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: tempToken,
          newPassword: formData.newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao trocar senha')
      }

      // Remover token temporário
      localStorage.removeItem('composer_token_temp')
      
      // Redirecionar para login com mensagem de sucesso
      router.push('/compositores/login?passwordChanged=true')
    } catch (err: any) {
      setError(err.message || 'Erro ao trocar senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-900/20 rounded-full mb-4">
              <FiAlertCircle className="w-8 h-8 text-yellow-400" />
            </div>
            <h1 className="text-3xl font-bold mb-2">
              <span className="gradient-text">Trocar Senha</span>
            </h1>
            <p className="text-gray-400">
              Você está usando uma senha temporária. Por favor, crie uma nova senha segura.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-800 text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nova Senha *
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-12 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? (
                    <FiEyeOff className="w-5 h-5" />
                  ) : (
                    <FiEye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirmar Nova Senha *
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-12 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                  placeholder="Digite a senha novamente"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showConfirmPassword ? (
                    <FiEyeOff className="w-5 h-5" />
                  ) : (
                    <FiEye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-800 text-center">
            <p className="text-gray-400 text-sm">
              Após salvar, você precisará fazer login novamente com sua nova senha.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
