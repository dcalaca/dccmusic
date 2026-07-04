import Link from 'next/link'
import { FiArrowLeft, FiArrowRight, FiMic, FiUploadCloud, FiZap } from 'react-icons/fi'

export default function ImproveMusicPage() {
  return (
    <div className="min-h-screen py-5 sm:py-7">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Link href="/compositores/admin/studio-ia" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-300 transition hover:text-primary-200">
            <FiArrowLeft /> Voltar ao Studio IA
          </Link>

          <section className="relative mb-5 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.28),transparent_34%),linear-gradient(135deg,rgba(8,8,12,0.98),rgba(17,24,39,0.94),rgba(49,15,80,0.68))] p-4 shadow-2xl shadow-purple-950/25 sm:p-6">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="relative">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-purple-100">
                <FiZap /> Melhorar música
              </div>
              <h1 className="max-w-3xl text-2xl font-black leading-tight text-white sm:text-4xl">
                Como você quer enviar sua música?
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
                Escolha o caminho mais fácil: enviar um áudio pronto ou gravar uma ideia agora pelo microfone.
              </p>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Link
              href="/compositores/admin/studio-ia/melhorar/musica-pronta"
              className="group rounded-[1.75rem] border border-purple-300/15 bg-gradient-to-br from-purple-950/35 via-gray-950 to-black p-5 shadow-2xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-primary-300/50"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-purple-600 text-white">
                <FiUploadCloud className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-black text-white">Enviar música pronta</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                Use quando você já tem uma gravação, demo, guia, voz e violão ou áudio do celular.
              </p>
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-primary-100">
                <span>Escolher arquivo</span>
                <FiArrowRight className="transition group-hover:translate-x-1" />
              </div>
            </Link>

            <Link
              href="/compositores/admin/studio-ia/melhorar/gravar"
              className="group rounded-[1.75rem] border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-950/35 via-gray-950 to-black p-5 shadow-2xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-fuchsia-300/50"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white">
                <FiMic className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-black text-white">Gravar agora</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                Use quando você quer cantar no próprio site. Depois a IA mostra a letra que entendeu para você revisar.
              </p>
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-fuchsia-100">
                <span>Abrir gravador</span>
                <FiArrowRight className="transition group-hover:translate-x-1" />
              </div>
            </Link>
          </div>

          <div className="mt-4 rounded-2xl border border-yellow-700/50 bg-yellow-950/15 p-4 text-sm leading-relaxed text-yellow-100">
            <strong>Importante:</strong> cantar no microfone ajuda muito quem não gosta de digitar. A IA pode errar algumas palavras, então sempre mostramos a letra antes para você corrigir.
          </div>
        </div>
      </div>
    </div>
  )
}
