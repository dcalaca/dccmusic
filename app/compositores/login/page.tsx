'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FiMail, FiLock, FiArrowRight, FiEye, FiEyeOff } from 'react-icons/fi'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')
  const isStudioRedirect = !redirectTo || redirectTo.startsWith('/compositores/admin/studio-ia')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [resendingVerification, setResendingVerification] = useState(false)

  useEffect(() => {
    if (searchParams.get('cadastro') === 'sucesso') {
      const mensagem = searchParams.get('mensagem')
      setSuccess(mensagem || 'Cadastro realizado com sucesso! Faça login para continuar.')
    }
    if (searchParams.get('passwordChanged') === 'true') {
      setSuccess('Senha alterada com sucesso! Faça login com sua nova senha.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setUnverifiedEmail('')
    setLoading(true)

    try {
      const response = await fetch('/api/compositores/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          setUnverifiedEmail(data.email || formData.email)
        }
        throw new Error(data.error || 'Erro ao fazer login')
      }

      // Se precisa trocar senha (senha temporária "123")
      if (data.requiresPasswordChange) {
        // Salvar token temporariamente para trocar senha
        localStorage.setItem('composer_token_temp', data.token)
        localStorage.setItem('composer_data', JSON.stringify(data.composer))
        
        // Redirecionar para página de troca de senha
        router.push('/compositores/trocar-senha')
        return
      }

      // Salvar token no localStorage
      localStorage.setItem('composer_token', data.token)
      localStorage.setItem('composer_data', JSON.stringify(data.composer))
      window.dispatchEvent(new Event('authChange'))

      const safeRedirect = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
        ? redirectTo
        : '/compositores/admin/studio-ia'

      router.push(safeRedirect)
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const resendVerificationEmail = async () => {
    const email = unverifiedEmail || formData.email
    if (!email) return

    setResendingVerification(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/compositores/email-verification/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Erro ao reenviar confirmação')

      setSuccess(data.message || 'Enviamos um novo link de confirmação para seu e-mail.')
    } catch (err: any) {
      setError(err.message || 'Erro ao reenviar confirmação')
    } finally {
      setResendingVerification(false)
    }
  }

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-2">
              <span className="gradient-text">Login Compositor</span>
            </h1>
            <p className="text-gray-400">
              Acesse sua conta e gerencie suas obras
            </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-900/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm">
                  <p>{error}</p>
                  {unverifiedEmail && (
                    <button
                      type="button"
                      onClick={resendVerificationEmail}
                      disabled={resendingVerification}
                      className="mt-3 inline-flex rounded-lg bg-red-700 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-60"
                    >
                      {resendingVerification ? 'Reenviando...' : 'Reenviar link de confirmação'}
                    </button>
                  )}
                </div>
              )}

              {success && (
                <div className="bg-green-900/50 border border-green-800 text-green-300 px-4 py-3 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Email
                </label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Senha
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="w-full pl-10 pr-12 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                    placeholder="Sua senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? (
                      <FiEyeOff className="w-5 h-5" />
                    ) : (
                      <FiEye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <div className="mt-2 text-right">
                  <Link href="/compositores/esqueci-senha" className="text-sm text-primary-400 hover:text-primary-300">
                    Esqueci minha senha
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span>Entrando...</span>
                ) : (
                  <>
                    <span>Entrar</span>
                    <FiArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 space-y-3">
              <div className="text-center">
                <p className="text-gray-400 text-sm">
                  Não tem uma conta?{' '}
                  <Link href="/compositores/cadastro" className="text-primary-400 hover:text-primary-300">
                    Cadastre-se
                  </Link>
                </p>
              </div>
              <div className="border-t border-gray-800 pt-4">
                <Link
                  href={isStudioRedirect ? '/compositores/planos' : '/compositores/planos'}
                  className="block w-full px-4 py-2 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium text-center text-sm"
                >
                  {isStudioRedirect ? 'Ver planos DCC Studio IA' : 'Ver Planos Premium'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ComposerLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
