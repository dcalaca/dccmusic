import Link from 'next/link'
import { requireAuth } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase'
import * as db from '@/lib/db'
import { getComposerStatement } from '@/lib/composer-statement'
import { getStudioCoverImageUrl } from '@/lib/studio-cover-url'
import { createStudioVoiceAssetUrl } from '@/lib/studio-voice-assets'
import { FiArrowLeft, FiFileText, FiMusic, FiClock, FiImage, FiCreditCard, FiDollarSign, FiMic } from 'react-icons/fi'
import CopyButton from '@/components/CopyButton'

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
    second: '2-digit',
  })
}

function formatMoney(value?: number | null) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDuration(value?: number | string | null) {
  const totalSeconds = Math.round(Number(value) || 0)
  if (!totalSeconds) return null
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatFileSize(bytes?: number | null) {
  const safeBytes = Number(bytes) || 0
  if (!safeBytes) return 'Tamanho não informado'
  return `${(safeBytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

function getSiteUrl() {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.dccmusic.online').replace(/\/$/, '')
}

const voiceStatusLabels: Record<string, string> = {
  source_uploaded: 'Áudio base recebido',
  validation_processing: 'Gerando frase de verificação',
  awaiting_verification: 'Aguardando áudio de verificação',
  voice_processing: 'Criando voz clonada',
  ready: 'Pronta para usar',
  failed: 'Falhou',
  archived: 'Arquivada',
}

function groupByProject(rows: any[] | null | undefined) {
  return (rows || []).reduce((acc: Record<string, any[]>, row: any) => {
    if (!acc[row.project_id]) acc[row.project_id] = []
    acc[row.project_id].push(row)
    return acc
  }, {})
}

function extractVoicePreference(description?: string | null) {
  if (!description) return null
  const match = description.match(/Preferência de voz:\s*(.+)/i)
  return match?.[1]?.trim() || null
}

function extractIdea(description?: string | null) {
  if (!description) return null
  return description
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .find((part) => part && !/^Preferência de voz:/i.test(part)) || null
}

export default async function AdminComposerStudioPage({
  params,
}: {
  params: { id: string }
}) {
  await requireAuth()

  const composer = await db.getComposerById(params.id)
  if (!composer) {
    return (
      <div className="min-h-screen py-10 text-center text-gray-400">
        Compositor não encontrado.
      </div>
    )
  }

  const { data: projects, error: projectsError } = await supabaseAdmin
    .from('studio_projects')
    .select('*')
    .eq('composer_id', params.id)
    .order('updated_at', { ascending: false })

  if (projectsError) {
    throw new Error(projectsError.message)
  }

  const projectIds = (projects || []).map((project: any) => project.id)

  const voicesPromise = supabaseAdmin
    .from('studio_voice_profiles')
    .select('*')
    .eq('composer_id', params.id)
    .order('created_at', { ascending: false })

  const [lyricsResult, versionsResult, coversResult, generationsResult, voicesResult] = projectIds.length > 0
    ? await Promise.all([
        supabaseAdmin
          .from('studio_lyrics')
          .select('*')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('studio_versions')
          .select('*')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('studio_covers')
          .select('*')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('studio_generations')
          .select('id, project_id, status, provider, provider_task_id, request_payload, error_message, created_at, updated_at')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false }),
        voicesPromise,
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        await voicesPromise,
      ]

  const dataErrors = [lyricsResult.error, versionsResult.error, coversResult.error, generationsResult.error, voicesResult.error].filter(Boolean)
  if (dataErrors.length > 0) {
    throw new Error(dataErrors.map((error: any) => error.message).join(' | '))
  }

  const lyricsByProject = groupByProject(lyricsResult.data)
  const versionsByProject = groupByProject(versionsResult.data)
  const coversByProject = groupByProject(coversResult.data)
  const generationsByProject = groupByProject(generationsResult.data)
  const coverUrlById = new Map<string, string | null>()
  await Promise.all((coversResult.data || []).map(async (cover: any) => {
    coverUrlById.set(cover.id, await getStudioCoverImageUrl(cover))
  }))
  const voices = await Promise.all((voicesResult.data || []).map(async (voice: any) => ({
    ...voice,
    sourceAudioUrl: await createStudioVoiceAssetUrl(voice.source_audio_path, voice.source_audio_storage_provider).catch(() => null),
    verifyAudioUrl: await createStudioVoiceAssetUrl(voice.verify_audio_path, voice.verify_audio_storage_provider).catch(() => null),
  })))

  const totalLyrics = (lyricsResult.data || []).length
  const totalVersions = (versionsResult.data || []).length
  const statement = await getComposerStatement(params.id)

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Link href="/admin/compositores" className="mb-8 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300">
            <FiArrowLeft /> Voltar para compositores
          </Link>

          <div className="mb-8">
            <h1 className="text-4xl font-bold">
              <span className="gradient-text">Studio IA de {composer.name}</span>
            </h1>
            <p className="mt-2 text-gray-400">
              {composer.email || 'Sem e-mail'} · /{composer.slug}
            </p>
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
              <FiMusic className="mb-3 h-6 w-6 text-primary-300" />
              <p className="text-3xl font-black">{projects?.length || 0}</p>
              <p className="text-sm text-gray-400">projetos criados</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
              <FiFileText className="mb-3 h-6 w-6 text-purple-300" />
              <p className="text-3xl font-black">{totalLyrics}</p>
              <p className="text-sm text-gray-400">letras salvas/geradas</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
              <FiMusic className="mb-3 h-6 w-6 text-green-300" />
              <p className="text-3xl font-black">{totalVersions}</p>
              <p className="text-sm text-gray-400">áudios disponíveis</p>
            </div>
          </div>

          <section id="extrato" className="mb-8 rounded-3xl border border-gray-800 bg-gray-950/70 p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-black text-white">
                  <FiCreditCard className="text-green-300" /> Extrato financeiro e créditos
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  Pagamentos do compositor, recargas avulsas e movimentações de créditos do Studio IA.
                </p>
              </div>
              <div className="rounded-2xl border border-green-900/60 bg-green-950/20 px-4 py-3">
                <p className="text-xs font-bold uppercase text-green-200/70">Total pago</p>
                <p className="text-2xl font-black text-green-300">{formatMoney(statement.summary.totalPaid)}</p>
              </div>
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-5">
              <div className="rounded-2xl border border-gray-800 bg-black/35 p-4">
                <p className="text-xs font-bold uppercase text-gray-500">Planos</p>
                <p className="mt-1 text-xl font-black text-white">{formatMoney(statement.summary.planPaid)}</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-black/35 p-4">
                <p className="text-xs font-bold uppercase text-gray-500">Destaques</p>
                <p className="mt-1 text-xl font-black text-white">{formatMoney(statement.summary.featuredPaid)}</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-black/35 p-4">
                <p className="text-xs font-bold uppercase text-gray-500">Recargas</p>
                <p className="mt-1 text-xl font-black text-primary-300">{formatMoney(statement.summary.topupPaid)}</p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-black/35 p-4">
                <p className="text-xs font-bold uppercase text-gray-500">Créditos liberados</p>
                <p className="mt-1 text-xl font-black text-purple-300">{statement.summary.boughtCredits}</p>
                {statement.summary.studioPlanName && (
                  <p className="mt-1 text-xs text-gray-500">{statement.summary.studioPlanName}</p>
                )}
              </div>
              <div className="rounded-2xl border border-gray-800 bg-black/35 p-4">
                <p className="text-xs font-bold uppercase text-gray-500">Saldo atual</p>
                <p className="mt-1 text-xl font-black text-green-300">{statement.summary.currentCreditBalance}</p>
                <p className="mt-1 text-xs text-gray-500">{statement.summary.currentMusicBalance} música(s)</p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-bold text-white">
                  <FiDollarSign className="text-green-300" /> Pagamentos e recargas
                </h3>
                {statement.payments.length === 0 ? (
                  <p className="rounded-2xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-500">
                    Nenhum pagamento registrado para este compositor.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {statement.payments.map((payment: any) => (
                      <div key={`${payment.type}-${payment.id}`} className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-bold text-white">{payment.label}</p>
                            <p className="mt-1 text-sm text-gray-400">{payment.description}</p>
                            <p className="mt-1 text-xs text-gray-500">{formatDate(payment.date)}</p>
                            {payment.paymentId && <p className="mt-1 break-all text-xs text-gray-500">{payment.paymentIdLabel || 'ID pagamento'}: {payment.paymentId}</p>}
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-black text-green-300">{formatMoney(payment.amount)}</p>
                            <p className="mt-1 text-xs text-gray-400">{payment.statusLabel}</p>
                            {payment.credits ? <p className="mt-1 text-xs text-purple-300">{payment.credits} créditos</p> : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {statement.pendingTopups.length > 0 && (
                  <details className="mt-4 rounded-2xl border border-yellow-900/60 bg-yellow-950/10 p-4">
                    <summary className="cursor-pointer text-sm font-bold text-yellow-200">
                      {statement.pendingTopups.length} tentativa(s) de recarga pendente(s)
                    </summary>
                    <div className="mt-3 space-y-3">
                      {statement.pendingTopups.map((payment: any) => (
                        <div key={`pending-${payment.id}`} className="rounded-xl border border-yellow-900/50 bg-black/25 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-bold text-yellow-100">{payment.label}</p>
                              <p className="mt-1 text-sm text-gray-400">{payment.description}</p>
                              <p className="mt-1 text-xs text-gray-500">{formatDate(payment.date)}</p>
                              {payment.paymentId && <p className="mt-1 break-all text-xs text-gray-500">{payment.paymentIdLabel}: {payment.paymentId}</p>}
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="font-black text-yellow-200">{formatMoney(payment.amount)}</p>
                              <p className="mt-1 text-xs text-yellow-200/80">Aguardando pagamento</p>
                              <p className="mt-1 text-xs text-gray-500">{payment.pendingCredits} créditos ainda não liberados</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 font-bold text-white">
                  <FiCreditCard className="text-primary-300" /> Movimentação de créditos
                </h3>
                {statement.creditMovements.length === 0 ? (
                  <p className="rounded-2xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-500">
                    Nenhuma movimentação de crédito registrada.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {statement.creditMovements.map((movement: any) => (
                      <div key={movement.id} className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-white">{movement.label}</p>
                            <p className="mt-1 text-sm text-gray-400">{movement.description}</p>
                            <p className="mt-1 text-xs text-gray-500">{formatDate(movement.date)}</p>
                            {movement.paymentId && <p className="mt-1 break-all text-xs text-gray-500">Pagamento: {movement.paymentId}</p>}
                            {typeof movement.balanceAfter === 'number' && (
                              <p className="mt-1 text-xs font-bold text-primary-200">
                                Saldo após: {movement.balanceAfter}
                              </p>
                            )}
                          </div>
                          <p className={`shrink-0 font-black ${movement.direction === 'credit' ? 'text-green-300' : movement.direction === 'ignored' ? 'text-gray-400' : 'text-yellow-300'}`}>
                            {movement.direction === 'credit' ? '+' : movement.direction === 'ignored' ? '' : '-'}{movement.amount}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section id="vozes" className="mb-8 rounded-3xl border border-gray-800 bg-gray-950/70 p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="flex items-center gap-2 text-2xl font-black text-white">
                <FiMic className="text-purple-300" /> Vozes enviadas pelo compositor
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                Use estes players para ouvir o áudio base enviado, o áudio de verificação e conferir qual ID de voz ficou disponível na Suno.
              </p>
            </div>

            {voices.length === 0 ? (
              <p className="rounded-2xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-500">
                Este compositor ainda não enviou nenhuma voz.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {voices.map((voice: any) => (
                  <article key={voice.id} className="rounded-3xl border border-gray-800 bg-black/35 p-4 sm:p-5">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-purple-300">
                          {voiceStatusLabels[voice.status] || voice.status}
                        </p>
                        <h3 className="mt-1 text-lg font-black text-white">{voice.display_name || 'Voz sem nome'}</h3>
                        <p className="mt-1 text-xs text-gray-500">Enviada em {formatDate(voice.created_at)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {voice.is_available && <span className="rounded-full bg-green-950 px-3 py-1 font-bold text-green-300">disponível</span>}
                        {voice.status === 'archived' && <span className="rounded-full bg-gray-800 px-3 py-1 text-gray-300">arquivada</span>}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-3">
                        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-bold text-white">Áudio base enviado pelo usuário</p>
                          <p className="text-xs text-gray-500">{formatFileSize(voice.source_audio_size_bytes)}</p>
                        </div>
                        {voice.sourceAudioUrl ? (
                          <audio controls src={voice.sourceAudioUrl} className="w-full" />
                        ) : (
                          <p className="text-sm text-gray-500">Áudio base sem URL disponível.</p>
                        )}
                        <p className="mt-2 break-all text-xs text-gray-600">Arquivo: {voice.source_audio_path || 'não informado'}</p>
                      </div>

                      <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-3">
                        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-bold text-white">Áudio de verificação</p>
                          <p className="text-xs text-gray-500">{formatFileSize(voice.verify_audio_size_bytes)}</p>
                        </div>
                        {voice.verifyAudioUrl ? (
                          <audio controls src={voice.verifyAudioUrl} className="w-full" />
                        ) : (
                          <p className="text-sm text-gray-500">O usuário ainda não enviou áudio de verificação.</p>
                        )}
                        {voice.verify_audio_path && (
                          <p className="mt-2 break-all text-xs text-gray-600">Arquivo: {voice.verify_audio_path}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3">
                        <p className="text-[11px] uppercase text-gray-500">Trecho vocal usado na validação</p>
                        <p className="mt-1 text-sm font-bold text-white">
                          {voice.vocal_start_s ?? 0}s até {voice.vocal_end_s ?? 20}s
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3">
                        <p className="text-[11px] uppercase text-gray-500">ID da voz na Suno</p>
                        <p className="mt-1 break-all text-sm font-bold text-white">{voice.voice_id || 'Ainda não gerado'}</p>
                      </div>
                    </div>

                    {voice.error_message && (
                      <p className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/20 p-3 text-sm text-red-200">
                        {voice.error_message}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {(projects || []).length === 0 ? (
            <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-10 text-center text-gray-400">
              Este compositor ainda não criou projetos no Studio IA.
            </div>
          ) : (
            <div className="space-y-6">
              {(projects || []).map((project: any) => {
                const lyrics = lyricsByProject[project.id] || []
                const versions = versionsByProject[project.id] || []
                const covers = coversByProject[project.id] || []
                const generations = generationsByProject[project.id] || []
                const currentCover = covers.find((cover: any) => cover.is_current) || covers[0]
                const voicePreference = extractVoicePreference(project.description)
                const idea = extractIdea(project.description)
                const composerProjectUrl = `${getSiteUrl()}/compositores/admin/studio-ia/projetos/${project.id}`

                return (
                  <section id={`project-${project.id}`} key={project.id} className="scroll-mt-24 overflow-hidden rounded-3xl border border-gray-800 bg-gray-950/70">
                    <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
                      <aside className="border-b border-gray-800 bg-black/40 p-5 lg:border-b-0 lg:border-r">
                        <div className="mb-4 aspect-square overflow-hidden rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-purple-950">
                          {currentCover && coverUrlById.get(currentCover.id) ? (
                            <img src={coverUrlById.get(currentCover.id) || ''} alt={project.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-gray-600">
                              <FiImage className="h-16 w-16" />
                            </div>
                          )}
                        </div>
                        <h2 className="text-xl font-black text-white">{project.title}</h2>
                        <p className="mt-1 text-sm text-gray-400">{project.style || 'Livre'} · {project.mood || 'Sem clima'}</p>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-gray-800 px-3 py-1 text-gray-300">{project.status}</span>
                          {project.public_slug && <span className="rounded-full bg-green-950 px-3 py-1 text-green-300">publicado</span>}
                        </div>
                        <p className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                          <FiClock /> Atualizado em {formatDate(project.updated_at)}
                        </p>
                        <div className="mt-4">
                          <CopyButton text={composerProjectUrl} label="Copiar URL do projeto" />
                        </div>
                      </aside>

                      <main className="space-y-6 p-5">
                        <div className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                          <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-primary-200">
                            Preferências da criação
                          </h3>
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3">
                              <p className="text-[11px] uppercase text-gray-500">Estilo / gênero</p>
                              <p className="mt-1 text-sm font-bold text-white">{project.style || 'Livre'}</p>
                            </div>
                            <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3">
                              <p className="text-[11px] uppercase text-gray-500">Clima</p>
                              <p className="mt-1 text-sm font-bold text-white">{project.mood || 'Livre'}</p>
                            </div>
                            <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3">
                              <p className="text-[11px] uppercase text-gray-500">Estrutura</p>
                              <p className="mt-1 text-sm font-bold text-white">{project.structure || 'Livre'}</p>
                            </div>
                            <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3">
                              <p className="text-[11px] uppercase text-gray-500">Quantidade</p>
                              <p className="mt-1 text-sm font-bold text-white">{project.line_count || 'Não informado'}</p>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3">
                              <p className="text-[11px] uppercase text-gray-500">Tipo/característica de voz</p>
                              <p className="mt-1 text-sm font-bold text-white">{voicePreference || 'IA escolheu automaticamente'}</p>
                            </div>
                            <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3">
                              <p className="text-[11px] uppercase text-gray-500">Ideia/tema informado</p>
                              <p className="mt-1 line-clamp-3 text-sm text-gray-200">{idea || 'Não informado'}</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
                            <FiFileText className="text-purple-300" /> Letras
                          </h3>
                          {lyrics.length === 0 ? (
                            <p className="rounded-2xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-500">
                              Nenhuma letra registrada neste projeto.
                            </p>
                          ) : (
                            <div className="space-y-4">
                              {lyrics.map((lyric: any, index: number) => (
                                <details key={lyric.id} open={index === 0} className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                                  <summary className="cursor-pointer text-sm font-bold text-purple-200">
                                    {lyric.is_current ? 'Letra atual' : 'Letra anterior'} · {formatDate(lyric.created_at)}
                                  </summary>
                                  <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-gray-950 p-4 text-sm leading-relaxed text-gray-200">
                                    {lyric.content}
                                  </pre>
                                </details>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
                            <FiMusic className="text-green-300" /> Músicas geradas
                          </h3>
                          {versions.length === 0 ? (
                            <p className="rounded-2xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-500">
                              Nenhum áudio disponível neste projeto.
                            </p>
                          ) : (
                            <div className="space-y-5">
                              {versions.map((version: any, index: number) => {
                                const audioUrl = version.audio_url || version.stream_audio_url
                                const duration = formatDuration(version.duration)
                                const versionNumber = versions.length - index
                                return (
                                  <article key={version.id} className="rounded-3xl border border-gray-700 bg-black/40 p-4 sm:p-5">
                                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                      <div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-green-300">
                                          Música gerada #{versionNumber}
                                        </p>
                                        <h4 className="mt-1 font-black text-white">
                                          {version.version_name || version.style || 'Versão gerada'}
                                        </h4>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                                          <span>{formatDate(version.created_at)}</span>
                                          {duration && <span>· Duração {duration}</span>}
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {version.is_current && <span className="rounded-full bg-green-950 px-3 py-1 text-xs font-bold text-green-300">atual</span>}
                                        {version.model && <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">{version.model}</span>}
                                      </div>
                                    </div>
                                    {audioUrl ? (
                                      <audio controls src={audioUrl} className="w-full" />
                                    ) : (
                                      <p className="text-sm text-gray-500">Áudio sem URL registrada.</p>
                                    )}
                                    {version.style && (
                                      <p className="mt-3 rounded-2xl border border-gray-800 bg-gray-950/70 px-3 py-2 text-xs text-gray-400">
                                        <strong className="text-gray-200">Estilo enviado:</strong> {version.style}
                                      </p>
                                    )}
                                  </article>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        {generations.length > 0 && (
                          <div>
                            <h3 className="mb-3 text-lg font-bold">Histórico de geração</h3>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {generations.map((generation: any) => (
                                <div key={generation.id} className="rounded-xl border border-gray-800 bg-black/30 p-3 text-xs text-gray-400">
                                  <p><strong className="text-gray-200">Status:</strong> {generation.status}</p>
                                  <p><strong className="text-gray-200">Fornecedor:</strong> {generation.provider || 'não informado'}</p>
                                  <p><strong className="text-gray-200">Criado:</strong> {formatDate(generation.created_at)}</p>
                                  {generation.request_payload?.personaId ? (
                                    <p className="mt-1 break-all text-green-300">
                                      <strong>Voz enviada para a Suno:</strong> {generation.request_payload.personaId}
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-yellow-200">Sem voz personalizada nesta geração.</p>
                                  )}
                                  {generation.error_message && <p className="mt-1 text-red-300">{generation.error_message}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </main>
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
