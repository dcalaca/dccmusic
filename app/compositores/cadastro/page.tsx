'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiArrowLeft, FiArrowRight, FiEye, FiEyeOff, FiLock, FiMail, FiUser } from 'react-icons/fi'
import { getStoredPartnerAttribution } from '@/components/PartnerAttribution'
import { pushGtmEvent } from '@/components/GtmEvents'
import { validateSignupEmail } from '@/lib/email-validation'

export default function ComposerSignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'account' | 'artist'>('account')
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    artistName: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSuggestion, setEmailSuggestion] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setEmailSuggestion('')

    if (step === 'account') {
      if (!formData.fullName.trim()) {
        setError('Informe seu nome.')
        return
      }

      const emailValidation = validateSignupEmail(formData.email)
      if (!emailValidation.valid) {
        setError(emailValidation.error)
        setEmailSuggestion(emailValidation.suggestion || '')
        return
      }

      if (formData.password !== formData.confirmPassword) {
        setError('As senhas não coincidem.')
        return
      }

      setStep('artist')
      return
    }

    if (!formData.artistName.trim()) {
      setError('Informe seu pseudônimo/nome artístico.')
      return
    }

    const emailValidation = validateSignupEmail(formData.email)
    if (!emailValidation.valid) {
      setError(emailValidation.error)
      setEmailSuggestion(emailValidation.suggestion || '')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/compositores/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailValidation.email,
          password: formData.password,
          accountName: formData.fullName,
          composerName: formData.artistName,
          forceCreate: true,
          partnerAttribution: getStoredPartnerAttribution(),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        if (data.suggestion) {
          setEmailSuggestion(data.suggestion)
        }
        throw new Error(data.error || 'Erro ao cadastrar')
      }

      const successMessage = data.message || 'Cadastro realizado com sucesso! Faça login para continuar.'
      pushGtmEvent('dcc_complete_registration', {
        product_id: 'composer_signup',
        product_name: 'Cadastro de compositor',
        product_type: 'registration',
        event_id: data?.metaRegistrationEventId || null,
        value: 0.01,
        currency: 'BRL',
      })
      if (typeof window !== 'undefined' && typeof (window as any).fbq === 'function') {
        ;(window as any).fbq('track', 'CompleteRegistration', {
          content_name: 'Cadastro de compositor',
          status: 'success',
          currency: 'BRL',
          value: 0.01,
        }, data?.metaRegistrationEventId ? { eventID: data.metaRegistrationEventId } : undefined)
      }
      router.push(
        `/compositores/login?cadastro=sucesso&email=${encodeURIComponent(formData.email)}&mensagem=${encodeURIComponent(successMessage)}`
      )
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-2">
              <span className="gradient-text">Cadastro de Compositor</span>
            </h1>
            <p className="text-gray-400">
              {step === 'account'
                ? 'Crie sua conta com seus dados de acesso.'
                : 'Agora escolha o nome artístico que aparecerá publicamente.'}
            </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8">
            <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-gray-950 p-1 text-sm">
              <div className={`rounded-lg px-3 py-2 text-center font-bold ${step === 'account' ? 'bg-primary-600 text-white' : 'text-gray-500'}`}>
                1. Conta
              </div>
              <div className={`rounded-lg px-3 py-2 text-center font-bold ${step === 'artist' ? 'bg-primary-600 text-white' : 'text-gray-500'}`}>
                2. Pseudônimo
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-900/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm space-y-2">
                  <p>{error}</p>
                  {emailSuggestion && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, email: emailSuggestion })
                        setError('')
                        setEmailSuggestion('')
                      }}
                      className="rounded-lg border border-red-700 bg-red-950/60 px-3 py-2 text-left text-xs font-bold text-red-100 hover:bg-red-900/70"
                    >
                      Corrigir para {emailSuggestion}
                    </button>
                  )}
                </div>
              )}

              {step === 'account' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Seu nome</label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(event) => setFormData({ ...formData, fullName: event.target.value })}
                        required
                        className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                        placeholder="Seu nome normal"
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">Esse nome é usado para sua conta. O nome público vem na próxima etapa.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <div className="relative">
                      <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(event) => {
                          setFormData({ ...formData, email: event.target.value })
                          if (error || emailSuggestion) {
                            setError('')
                            setEmailSuggestion('')
                          }
                        }}
                        required
                        className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                        placeholder="seu@email.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Senha</label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                        required
                        minLength={6}
                        className="w-full pl-10 pr-12 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                        placeholder="Mínimo 6 caracteres"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                      >
                        {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Confirmar senha</label>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })}
                        required
                        className="w-full pl-10 pr-12 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                        placeholder="Digite a senha novamente"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                      >
                        {showConfirmPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-2">Pseudônimo / nome artístico</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={formData.artistName}
                      onChange={(event) => setFormData({ ...formData, artistName: event.target.value })}
                      required
                      className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-primary-500"
                      placeholder="Ex: João da Silva, JS Oficial, O Poeta..."
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Esse será o nome público da sua página de compositor e das suas músicas.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                {step === 'artist' && (
                  <button
                    type="button"
                    onClick={() => {
                      setError('')
                      setStep('account')
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 py-3 font-medium text-gray-200 hover:bg-gray-800"
                  >
                    <FiArrowLeft className="w-4 h-4" /> Voltar
                  </button>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span>Cadastrando...</span>
                  ) : (
                    <>
                      <span>{step === 'account' ? 'Continuar' : 'Finalizar cadastro'}</span>
                      <FiArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 space-y-3">
              <div className="text-center">
                <p className="text-gray-400 text-sm">
                  Já tem uma conta?{' '}
                  <Link href="/compositores/login" className="text-primary-400 hover:text-primary-300">
                    Fazer login
                  </Link>
                </p>
              </div>
              <div className="border-t border-gray-800 pt-4">
                <p className="text-center text-gray-400 text-sm mb-3">
                  Após o cadastro, você poderá fazer uma música grátis no DCC Studio IA.
                </p>
                <Link
                  href="/studio-ia"
                  className="block w-full px-4 py-2 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-lg transition-all font-medium text-center text-sm"
                >
                  Conhecer DCC Studio IA
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
