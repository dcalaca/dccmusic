import Link from 'next/link'
import { FiArrowLeft, FiHeadphones, FiMusic, FiShield } from 'react-icons/fi'
import { requireAuth } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

const tools = [
  { href: '/admin/playback-mureka', title: 'Separar voz e playback · Mureka', description: 'Envie uma música ou escolha uma produção DCC e baixe o instrumental e a voz isolada em WAV. Usa o saldo da API Mureka.', icon: FiHeadphones },
  { href: '/admin/transcricao-mureka', title: 'Transcrição Mureka', description: 'Gere arquivos de partitura e acordes a partir de um áudio.', icon: FiMusic },
  { href: '/admin/limpar-metadados', title: 'Limpar metadados', description: 'Remova informações de identificação presentes nos metadados de um MP3.', icon: FiShield },
  { href: '/admin/playback', title: 'Playback · Suno', description: 'Acesse a ferramenta de separação de voz e instrumental pela Suno.', icon: FiHeadphones },
]

export default async function AudioToolsPage() {
  await requireAuth()
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 text-white">
    <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-purple-300"><FiArrowLeft /> Voltar ao admin</Link>
    <h1 className="mt-7 text-3xl font-black sm:text-4xl">Ferramentas de áudio</h1>
    <p className="mt-3 text-gray-300">Separação de voz, transcrição e tratamento de arquivos em um só lugar.</p>
    <div className="mt-8 grid gap-5 sm:grid-cols-2">
      {tools.map(({ href, title, description, icon: Icon }) => <Link key={href} href={href} className="rounded-3xl border border-purple-500/25 bg-gradient-to-br from-purple-950/50 to-gray-950 p-6 transition hover:border-purple-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400">
        <Icon aria-hidden="true" className="h-7 w-7 text-purple-300" />
        <h2 className="mt-4 text-xl font-black">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">{description}</p>
        <span className="mt-5 inline-block text-sm font-bold text-purple-300">Abrir ferramenta →</span>
      </Link>)}
    </div>
  </main>
}
