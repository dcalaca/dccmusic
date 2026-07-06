import { requireAuth } from '@/lib/auth-helpers'
import Link from 'next/link'
import {
  FiBarChart2,
  FiBell,
  FiAlertTriangle,
  FiDollarSign,
  FiEye,
  FiFileText,
  FiLink,
  FiMail,
  FiMessageCircle,
  FiMusic,
  FiPlayCircle,
  FiSettings,
  FiStar,
  FiTag,
  FiTrendingUp,
  FiUser,
  FiUsers,
  FiZap,
} from 'react-icons/fi'
import AdminOnlineCard from './AdminOnlineCard'
import AdminMusicCodeLookup from './AdminMusicCodeLookup'

const adminGroups = [
  {
    title: 'Conteúdo',
    description: 'Cadastro e organização do catálogo público.',
    items: [
      {
        href: '/admin/musicas',
        title: 'Músicas',
        description: 'Adicionar, editar ou remover músicas',
        icon: FiMusic,
      },
      {
        href: '/admin/videos',
        title: 'Vídeos',
        description: 'Adicionar, editar ou remover vídeos do YouTube',
        icon: FiPlayCircle,
      },
      {
        href: '/admin/generos',
        title: 'Gêneros',
        description: 'Criar e gerenciar gêneros musicais',
        icon: FiTag,
      },
      {
        href: '/admin/quadro-avisos',
        title: 'Quadro de avisos',
        description: 'Criar, ativar ou desativar avisos para usuários logados',
        icon: FiBell,
        accent: 'purple',
      },
    ],
  },
  {
    title: 'Comunidade',
    description: 'Usuários, compositores, comentários e avaliações.',
    items: [
      {
        href: '/admin/compositores',
        title: 'Compositores',
        description: 'Controle, edição e gerenciamento de compositores',
        icon: FiUser,
      },
      {
        href: '/admin/compositores/saldos',
        title: 'Saldos de Compositores',
        description: 'Ver créditos e saldos do Studio IA por compositor',
        icon: FiZap,
        accent: 'purple',
      },
      {
        href: '/admin/usuarios',
        title: 'Usuários',
        description: 'Gerenciar usuários que avaliam e comentam músicas',
        icon: FiUsers,
      },
      {
        href: '/admin/interacoes',
        title: 'Comentários e Notas',
        description: 'Moderar comentários e excluir avaliações indevidas',
        icon: FiMessageCircle,
        accent: 'blue',
      },
    ],
  },
  {
    title: 'Vendas e Marketing',
    description: 'Receita, divulgação, parceiros e campanhas.',
    items: [
      {
        href: '/admin/financeiro',
        title: 'Financeiro',
        description: 'Entrada, custos, lucro estimado, anúncios, Resend, Vercel e pagamentos',
        icon: FiDollarSign,
        accent: 'green',
      },
      {
        href: '/admin/parceiros',
        title: 'Parceiros / Afiliados',
        description: 'Criar parceiros, links e acompanhar conversões',
        icon: FiTrendingUp,
        accent: 'cyan',
      },
      {
        href: '/admin/email-campanhas',
        title: 'Campanhas de E-mail',
        description: 'Enviar e agendar e-mails para compositores e usuários cadastrados',
        icon: FiMail,
        accent: 'fuchsia',
      },
      {
        href: '/admin/links',
        title: 'Links Rastreáveis',
        description: 'Criar e gerenciar links com rastreamento de cliques',
        icon: FiLink,
      },
    ],
  },
  {
    title: 'Studio IA',
    description: 'Planos, cupons e configurações do Studio IA.',
    items: [
      {
        href: '/admin/studio-planos',
        title: 'Planos Studio IA',
        description: 'Administrar planos separados do DCC Studio IA',
        icon: FiZap,
        accent: 'purple',
      },
      {
        href: '/admin/cupons',
        title: 'Cupons Studio IA',
        description: 'Criar cupons promocionais ou grátis de músicas para clientes',
        icon: FiTag,
        accent: 'purple',
      },
      {
        href: '/admin/studio-abusos',
        title: 'Abuso no Grátis',
        description: 'Ver IPs usando letras grátis com várias contas',
        icon: FiAlertTriangle,
        accent: 'purple',
      },
      {
        href: '/admin/planos',
        title: 'Planos DCC Music',
        description: 'Criar e gerenciar planos de assinatura',
        icon: FiStar,
      },
    ],
  },
  {
    title: 'Relatórios e Configurações',
    description: 'Métricas, anúncios e histórico de acessos.',
    items: [
      {
        href: '/admin/graficos',
        title: 'Gráficos',
        description: 'Acompanhar músicas, letras, capas, vozes e cadastros por dia',
        icon: FiBarChart2,
        accent: 'cyan',
      },
      {
        href: '/admin/visualizacoes',
        title: 'Visualizações',
        description: 'Histórico por vídeo e por música: data, IP e origem',
        icon: FiEye,
      },
      {
        href: '/admin/graficos-visualizacoes',
        title: 'Gráficos de Visualizações',
        description: 'Ranking por período das músicas mais ouvidas e vídeos mais vistos',
        icon: FiBarChart2,
        accent: 'cyan',
      },
      {
        href: '/admin/relatorios',
        title: 'Relatórios',
        description: 'Relatórios completos de cliques e análises',
        icon: FiFileText,
      },
      {
        href: '/admin/ads',
        title: 'Configuração Ads',
        description: 'Analisar Meta Ads, custo por cadastro e pausar anúncios ruins',
        icon: FiSettings,
        accent: 'blue',
      },
    ],
  },
]

const accentClasses: Record<string, string> = {
  default: 'border-gray-800 bg-gray-900/50 hover:border-primary-500 group-hover:text-primary-400',
  blue: 'border-blue-800 bg-gradient-to-br from-blue-950/50 via-gray-900/70 to-black hover:border-blue-400 group-hover:text-blue-300',
  cyan: 'border-cyan-800 bg-gradient-to-br from-cyan-950/50 via-gray-900/70 to-black hover:border-cyan-400 group-hover:text-cyan-300',
  fuchsia: 'border-fuchsia-800 bg-gradient-to-br from-fuchsia-950/50 via-gray-900/70 to-black hover:border-fuchsia-400 group-hover:text-fuchsia-300',
  green: 'border-green-800 bg-gradient-to-br from-green-950/50 via-gray-900/70 to-black hover:border-green-400 group-hover:text-green-300',
  purple: 'border-purple-800 bg-gradient-to-br from-purple-950/50 via-gray-900/70 to-black hover:border-purple-400 group-hover:text-purple-300',
}

function AdminCard({ item }: { item: typeof adminGroups[number]['items'][number] }) {
  const Icon = item.icon
  const accent = accentClasses[item.accent || 'default']

  return (
    <Link
      href={item.href}
      className={`group rounded-2xl border p-5 transition-all ${accent}`}
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold transition-colors">{item.title}</h3>
        <Icon className="h-6 w-6 text-gray-400 transition-colors" />
      </div>
      <p className="text-sm leading-6 text-gray-400">{item.description}</p>
    </Link>
  )
}

export default async function AdminPage() {
  await requireAuth()

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-bold">
              <span className="gradient-text">Painel Admin</span>
            </h1>
            <p className="text-gray-400">Gerencie o site por áreas, sem precisar procurar em uma lista gigante.</p>
          </div>
          <Link
            href="/admin/interacoes"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-black text-white hover:bg-primary-700"
          >
            <FiMessageCircle />
            Comentários e Notas
          </Link>
        </div>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-black text-white">Visão geral</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <AdminOnlineCard />
          </div>
        </section>

        <section className="mb-8">
          <AdminMusicCodeLookup />
        </section>

        <div className="space-y-8">
          {adminGroups.map((group) => (
            <section key={group.title} className="rounded-3xl border border-gray-800 bg-black/20 p-5 sm:p-6">
              <div className="mb-5">
                <h2 className="text-2xl font-black">
                  <span className="gradient-text">{group.title}</span>
                </h2>
                <p className="mt-1 text-sm text-gray-400">{group.description}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => (
                  <AdminCard key={item.href} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
