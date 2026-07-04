import Link from 'next/link'
import { headers } from 'next/headers'
import { recordEmailOptOut } from '@/lib/email-opt-outs'

export const dynamic = 'force-dynamic'

type UnsubscribeState =
  | { title: string; message: string; tone: 'success' | 'error' | 'warning' }

function getClientIp() {
  const headerList = headers()
  return (
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerList.get('x-real-ip') ||
    null
  )
}

export default async function EmailUnsubscribePage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const token = typeof searchParams.token === 'string' ? searchParams.token : ''
  let state: UnsubscribeState

  if (!token) {
    state = {
      title: 'Link inválido',
      message: 'Não encontramos as informações necessárias para fazer o descadastro.',
      tone: 'error',
    }
  } else {
    try {
      const headerList = headers()
      const result = await recordEmailOptOut({
        token,
        userAgent: headerList.get('user-agent'),
        ipAddress: getClientIp(),
      })

      if (result.success) {
        state = {
          title: 'Descadastro confirmado',
          message: 'Pronto. Este e-mail foi removido das próximas campanhas promocionais da DCC Music.',
          tone: 'success',
        }
      } else if (result.reason === 'setup_required') {
        state = {
          title: 'Descadastro ainda não configurado',
          message: 'A estrutura de descadastro ainda precisa ser ativada no banco de dados. Fale com o suporte da DCC Music para remover seu e-mail.',
          tone: 'warning',
        }
      } else {
        state = {
          title: 'Link inválido',
          message: 'Este link de descadastro não é válido. Se quiser sair da lista, responda ao e-mail pedindo a remoção.',
          tone: 'error',
        }
      }
    } catch {
      state = {
        title: 'Não foi possível descadastrar agora',
        message: 'Tente novamente em alguns minutos ou responda ao e-mail pedindo a remoção.',
        tone: 'error',
      }
    }
  }

  const toneClass = {
    success: 'border-green-800 bg-green-950/25 text-green-100',
    warning: 'border-yellow-800 bg-yellow-950/25 text-yellow-100',
    error: 'border-red-800 bg-red-950/25 text-red-100',
  }[state.tone]

  return (
    <main className="min-h-screen bg-black px-4 py-12 text-white">
      <section className={`mx-auto max-w-xl rounded-3xl border p-6 shadow-2xl ${toneClass}`}>
        <p className="mb-2 text-sm font-black uppercase tracking-wide text-white/60">DCC Music</p>
        <h1 className="text-3xl font-black">{state.title}</h1>
        <p className="mt-4 leading-relaxed">{state.message}</p>
        <p className="mt-4 text-sm text-white/60">
          Você ainda poderá receber e-mails transacionais importantes, como confirmação de pagamento, senha e avisos da sua conta.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-black text-black hover:bg-gray-200"
        >
          Voltar para o site
        </Link>
      </section>
    </main>
  )
}
