import Link from 'next/link'
import { FiCheckCircle, FiXCircle, FiMail } from 'react-icons/fi'
import { verifyComposerEmailToken } from '@/lib/composer-email-verification'

export const dynamic = 'force-dynamic'

export default async function VerifyComposerEmailPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const token = searchParams.token || ''
  const result = token
    ? await verifyComposerEmailToken(token).catch((error) => {
        console.error('[EMAIL VERIFY] Erro ao validar token:', error)
        return { ok: false, reason: 'error' }
      })
    : { ok: false, reason: 'missing' }

  const success = result.ok

  const title = success
    ? 'E-mail confirmado com sucesso'
    : 'Não foi possível confirmar seu e-mail'
  const message = success
    ? 'Sua conta de compositor foi ativada. Agora você já pode fazer login e usar o DCC Music.'
    : 'O link pode estar expirado, já ter sido usado ou estar incorreto. Solicite um novo link na tela de login.'

  return (
    <div className="min-h-screen py-8 flex items-center justify-center">
      <div className="container mx-auto px-4">
        <div className={`mx-auto max-w-md rounded-3xl border p-8 text-center ${
          success
            ? 'border-green-800 bg-green-950/30'
            : 'border-red-800 bg-red-950/30'
        }`}>
          {success ? (
            <FiCheckCircle className="mx-auto mb-4 h-16 w-16 text-green-300" />
          ) : (
            <FiXCircle className="mx-auto mb-4 h-16 w-16 text-red-300" />
          )}
          <h1 className="mb-3 text-3xl font-black">{title}</h1>
          <p className="mb-6 text-gray-300">{message}</p>
          <Link
            href="/compositores/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 px-5 py-3 font-bold text-white"
          >
            <FiMail />
            Ir para login
          </Link>
        </div>
      </div>
    </div>
  )
}
