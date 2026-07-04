import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'
import { studioMonthKey } from '@/lib/studio'
import Link from 'next/link'
import { FiAlertTriangle, FiArrowLeft, FiUser } from 'react-icons/fi'

export const dynamic = 'force-dynamic'

interface FreeLyricTransaction {
  composer_id: string
  created_at: string
  metadata?: {
    ip?: string | null
    userAgent?: string | null
    composerEmail?: string | null
    composerName?: string | null
  } | null
}

interface ComposerRow {
  id: string
  name: string
  email?: string | null
  slug?: string | null
}

function formatDate(date: string) {
  return new Date(date).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function StudioAbusePage() {
  await requireAuth()
  const monthKey = studioMonthKey()

  const { data: transactions, error } = await supabaseAdmin
    .from('studio_credit_transactions')
    .select('composer_id, created_at, metadata')
    .eq('action', 'lyric_generation_free')
    .eq('month_key', monthKey)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) throw error

  const composerIds = Array.from(new Set((transactions || []).map((item: FreeLyricTransaction) => item.composer_id).filter(Boolean)))
  const { data: composers } = composerIds.length > 0
    ? await supabaseAdmin
        .from('dccmusic_composers')
        .select('id, name, email, slug')
        .in('id', composerIds)
    : { data: [] as ComposerRow[] }

  const composerById = new Map((composers || []).map((composer: ComposerRow) => [composer.id, composer]))
  const byIp = new Map<string, FreeLyricTransaction[]>()

  for (const transaction of (transactions || []) as FreeLyricTransaction[]) {
    const ip = transaction.metadata?.ip || 'unknown'
    if (!byIp.has(ip)) byIp.set(ip, [])
    byIp.get(ip)!.push(transaction)
  }

  const suspicious = Array.from(byIp.entries())
    .map(([ip, rows]) => {
      const uniqueComposers = Array.from(new Set(rows.map((row) => row.composer_id)))
      return {
        ip,
        total: rows.length,
        uniqueComposers,
        rows,
      }
    })
    .filter((item) => item.ip !== 'unknown' && (item.uniqueComposers.length >= 2 || item.total >= 6))
    .sort((a, b) => b.uniqueComposers.length - a.uniqueComposers.length || b.total - a.total)

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
          <FiArrowLeft /> Voltar ao admin
        </Link>

        <div className="mb-8 rounded-3xl border border-yellow-800 bg-yellow-950/20 p-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-yellow-700 bg-yellow-900/40 px-4 py-2 text-sm font-bold text-yellow-200">
            <FiAlertTriangle /> Monitoramento do grátis
          </div>
          <h1 className="text-4xl font-black text-white">Possível abuso no Studio IA</h1>
          <p className="mt-2 max-w-3xl text-gray-400">
            Mostra IPs que usaram letras grátis com várias contas neste mês. Isso não bloqueia ninguém automaticamente, apenas ajuda você a identificar abuso.
          </p>
          <p className="mt-3 text-sm text-gray-500">Mês analisado: {monthKey} · Letras grátis no mês: {(transactions || []).length}</p>
        </div>

        {suspicious.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8 text-center text-gray-300">
            Nenhum IP suspeito encontrado neste mês.
          </div>
        ) : (
          <div className="space-y-5">
            {suspicious.map((item) => (
              <div key={item.ip} className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="font-mono text-xl font-black text-white">{item.ip}</h2>
                    <p className="text-sm text-gray-400">
                      {item.total} letras grátis · {item.uniqueComposers.length} conta(s) diferente(s)
                    </p>
                  </div>
                  <span className="rounded-full border border-yellow-800 bg-yellow-900/40 px-3 py-1 text-xs font-bold text-yellow-200">
                    Revisar
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {item.uniqueComposers.map((composerId) => {
                    const composer = composerById.get(composerId)
                    const composerRows = item.rows.filter((row) => row.composer_id === composerId)
                    return (
                      <div key={composerId} className="rounded-xl border border-gray-800 bg-black/30 p-4">
                        <div className="mb-2 flex items-center gap-2 text-white">
                          <FiUser className="text-primary-300" />
                          <span className="font-bold">{composer?.name || composerRows[0]?.metadata?.composerName || 'Compositor'}</span>
                        </div>
                        <p className="text-sm text-gray-400">{composer?.email || composerRows[0]?.metadata?.composerEmail || 'Sem e-mail'}</p>
                        <p className="mt-2 text-xs text-gray-500">
                          {composerRows.length} letra(s) grátis · último uso: {formatDate(composerRows[0].created_at)}
                        </p>
                        {composer?.id && (
                          <Link href={`/admin/compositores/${composer.id}`} className="mt-3 inline-block text-sm font-bold text-primary-300 hover:text-primary-200">
                            Abrir perfil admin
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
