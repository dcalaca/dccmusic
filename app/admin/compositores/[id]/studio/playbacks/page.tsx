import Link from 'next/link'
import { requireAuth } from '@/lib/auth-helpers'
import * as db from '@/lib/db'
import {
  getComposerSavedPlaybackAssets,
  listComposerPlaybackExports,
  recoverLegacyPlaybackAssets,
} from '@/lib/studio-playback-admin'
import { FiArrowLeft, FiDownload, FiHeadphones, FiMic, FiRefreshCw } from 'react-icons/fi'

export const dynamic = 'force-dynamic'

function formatDate(value?: string | null) {
  if (!value) return 'Data não informada'
  return new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSize(bytes?: number | null) {
  const value = Number(bytes) || 0
  if (!value) return null
  return `${(value / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

export default async function AdminComposerPlaybacksPage({ params }: { params: { id: string } }) {
  await requireAuth()
  const composer = await db.getComposerById(params.id)
  if (!composer) {
    return <div className="min-h-screen py-10 text-center text-gray-400">Compositor não encontrado.</div>
  }

  let recovered = 0
  let recoveryError = ''
  try {
    const result = await recoverLegacyPlaybackAssets(params.id)
    recovered = result.recovered
  } catch (error: any) {
    console.error('[Admin Playback] Recuperação automática falhou:', error)
    recoveryError = error?.message || 'Não foi possível executar a recuperação automática.'
  }

  const [savedAssets, allExports] = await Promise.all([
    getComposerSavedPlaybackAssets(params.id),
    listComposerPlaybackExports(params.id),
  ])

  const linkedPaths = new Set<string>()
  savedAssets.forEach((asset: any) => {
    if (asset.playbackPath) linkedPaths.add(asset.playbackPath)
    if (asset.vocalPath) linkedPaths.add(asset.vocalPath)
  })
  const unlinked = allExports.filter((row) => !linkedPaths.has(row.path))

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Link href={`/admin/compositores/${params.id}`} className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
          <FiArrowLeft /> Voltar para {composer.name}
        </Link>

        <div className="mb-8 rounded-3xl border border-cyan-900/60 bg-cyan-950/20 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-black text-white">Playbacks e vozes de {composer.name}</h1>
              <p className="mt-2 text-sm text-gray-400">
                Arquivo administrativo para suporte. Ouça e baixe sem consumir créditos do usuário.
              </p>
            </div>
            <Link href={`/admin/compositores/${params.id}/studio/playbacks`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-700 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-950">
              <FiRefreshCw /> Atualizar
            </Link>
          </div>
          {recovered > 0 && (
            <p className="mt-4 rounded-xl border border-green-800 bg-green-950/30 p-3 text-sm font-bold text-green-200">
              {recovered} separação(ões) antiga(s) recuperada(s) e vinculada(s) ao projeto automaticamente.
            </p>
          )}
          {recoveryError && (
            <p className="mt-4 rounded-xl border border-yellow-800 bg-yellow-950/20 p-3 text-sm text-yellow-200">
              Recuperação automática: {recoveryError}
            </p>
          )}
        </div>

        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black text-white">Arquivos salvos nos projetos</h2>
            <p className="mt-1 text-sm text-gray-400">Estas separações também ficam disponíveis para o próprio compositor quando ele abrir a versão correspondente.</p>
          </div>

          {savedAssets.length === 0 ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5 text-sm text-gray-400">Nenhuma separação vinculada a projeto ainda.</div>
          ) : (
            <div className="space-y-4">
              {savedAssets.map((asset: any) => (
                <article key={asset.id} className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-white">{asset.projectTitle}</h3>
                      <p className="text-sm text-gray-400">{asset.versionName || 'Versão da música'} · {formatDate(asset.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {asset.recovered && <span className="rounded-full bg-green-950 px-3 py-1 text-xs font-bold text-green-300">recuperado</span>}
                      {asset.separationProvider && <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">{asset.separationProvider}</span>}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-cyan-900/50 bg-black/30 p-4">
                      <p className="mb-3 flex items-center gap-2 font-black text-cyan-200"><FiHeadphones /> Playback / instrumental</p>
                      {asset.playbackUrl ? <audio controls src={asset.playbackUrl} className="w-full" /> : <p className="text-sm text-gray-500">Arquivo indisponível.</p>}
                      {asset.playbackUrl && <a href={asset.playbackUrl} download className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 font-bold text-white hover:bg-cyan-600"><FiDownload /> Baixar playback</a>}
                    </div>
                    <div className="rounded-2xl border border-purple-900/50 bg-black/30 p-4">
                      <p className="mb-3 flex items-center gap-2 font-black text-purple-200"><FiMic /> Voz isolada</p>
                      {asset.vocalUrl ? <audio controls src={asset.vocalUrl} className="w-full" /> : <p className="text-sm text-gray-500">Arquivo indisponível.</p>}
                      {asset.vocalUrl && <a href={asset.vocalUrl} download className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-3 font-bold text-white hover:bg-purple-600"><FiDownload /> Baixar voz</a>}
                    </div>
                  </div>

                  <Link href={`/admin/compositores/${params.id}/studio?project=${encodeURIComponent(asset.projectId)}`} className="mt-4 inline-flex text-sm font-bold text-primary-300 hover:text-primary-200">
                    Abrir projeto completo →
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-black text-white">Arquivos antigos ainda não vinculados</h2>
            <p className="mt-1 text-sm text-gray-400">
              Área de segurança para arquivos existentes no storage. Eles continuam acessíveis ao administrador mesmo quando uma separação antiga não pôde ser associada automaticamente ao projeto.
            </p>
          </div>
          {unlinked.length === 0 ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5 text-sm text-gray-400">Nenhum arquivo antigo solto encontrado.</div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {unlinked.map((row) => (
                <div key={`${row.provider}-${row.path}`} className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white">{row.name}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatDate(row.createdAt)}{formatSize(row.sizeBytes) ? ` · ${formatSize(row.sizeBytes)}` : ''}</p>
                      <p className="mt-1 text-xs font-bold text-gray-400">{row.kind === 'playback' ? 'Playback' : row.kind === 'vocal' ? 'Voz isolada' : 'Áudio exportado'}</p>
                    </div>
                    <span className="rounded-full bg-gray-800 px-2 py-1 text-[11px] text-gray-400">{row.provider}</span>
                  </div>
                  {row.url && <audio controls src={row.url} className="mt-3 w-full" />}
                  {row.url && <a href={row.url} download className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"><FiDownload /> Baixar arquivo</a>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
