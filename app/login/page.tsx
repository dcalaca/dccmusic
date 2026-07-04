'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi'

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  })

  useEffect(() => {
    // Verificar se a senha foi alterada (apenas no cliente)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('passwordChanged') === 'true') {
        setPasswordChanged(true)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = isLogin ? '/api/site-users/login' : '/api/site-users/register'
      const body = isLogin
        ? { email: formData.email, password: formData.password }
        : { name: formData.name, email: formData.email, password: formData.password }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer login')
      }

      // Se precisa trocar senha (senha temporária "123")
      if (data.requiresPasswordChange) {
        // Salvar token temporariamente para trocar senha
        localStorage.setItem('site_user_token_temp', data.token)
        localStorage.setItem('site_user_data', JSON.stringify(data.user))
        
        // Redirecionar para página de troca de senha
        router.push('/trocar-senha')
        return
      }

      // Salvar token e dados do usuário
      localStorage.setItem('site_user_token', data.token)
      localStorage.setItem('site_user_data', JSON.stringify(data.user))

      // Disparar evento customizado para atualizar o Header
      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(new CustomEvent('authChange', { detail: { authenticated: true, user: data.user } }))

      // Redirecionar para a página anterior ou home
      const returnUrl = typeof window !== 'undefined' 
        ? new URLSearchParams(window.location.search).get('return') || '/'
        : '/'
      router.push(returnUrl)
    } catch (err: any) {
      setError(err.message || 'Erro ao processar solicitação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 sm:p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">
              <span className="gradient-text">
                {isLogin ? 'Entrar' : 'Criar Conta'}
              </span>
            </h1>
            <p className="text-gray-400">
              {isLogin
                ? 'Entre para avaliar e comentar'
                : 'Cadastre-se gratuitamente para avaliar e comentar'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-800 text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          {passwordChanged && (
            <div className="mb-4 p-3 bg-green-900/50 border border-green-800 text-green-300 rounded-lg text-sm">
              Senha alterada com sucesso! Faça login com sua nova senha.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome Completo *
                </label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                    placeholder="Seu nome completo"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email *
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Senha *
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-12 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                  placeholder={isLogin ? 'Sua senha' : 'Mínimo 6 caracteres'}
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

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Processando...' : isLogin ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setError('')
                setFormData({ name: '', email: '', password: '' })
              }}
              className="text-primary-400 hover:text-primary-300 text-sm"
            >
              {isLogin
                ? 'Não tem conta? Cadastre-se'
                : 'Já tem conta? Faça login'}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-800 text-center">
            <Link
              href="/"
              className="text-gray-400 hover:text-gray-300 text-sm transition-colors"
            >
              ← Voltar para o site
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
