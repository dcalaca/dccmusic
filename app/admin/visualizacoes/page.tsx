'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { FiEye, FiArrowLeft, FiCalendar, FiVideo, FiGlobe, FiMonitor, FiMusic, FiDownload } from 'react-icons/fi'

interface VideoViewRow {
  id: string
  videoId: string
  videoTitle: string
  videoSlug: string
  viewedAt: string
  ipAddress?: string | null
  userAgent?: string | null
  referer?: string | null
}

interface MusicViewRow {
  id: string
  musicId: string
  musicTitle: string
  musicSlug: string
  viewedAt: string
  ipAddress?: string | null
  userAgent?: string | null
  referer?: string | null
}

type TabKey = 'videos' | 'musics'

export default function AdminVisualizacoesPage() {
  const [tab, setTab] = useState<TabKey>('videos')

  const [videoViews, setVideoViews] = useState<VideoViewRow[]>([])
  const [videos, setVideos] = useState<{ id: string; title: string; slug: string }[]>([])
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoSearched, setVideoSearched] = useState(false)
  const [videoTotal, setVideoTotal] = useState(0)
  const [videoQueryError, setVideoQueryError] = useState<string | null>(null)
  const [videoPage, setVideoPage] = useState(1)
  const [videoFilters, setVideoFilters] = useState({
    videoId: '',
    startDate: '',
    endDate: '',
  })

  const [musicViews, setMusicViews] = useState<MusicViewRow[]>([])
  const [musics, setMusics] = useState<{ id: string; title: string; slug: string }[]>([])
  const [musicLoading, setMusicLoading] = useState(false)
  const [musicSearched, setMusicSearched] = useState(false)
  const [musicTotal, setMusicTotal] = useState(0)
  const [musicQueryError, setMusicQueryError] = useState<string | null>(null)
  const [musicPage, setMusicPage] = useState(1)
  const [musicFilters, setMusicFilters] = useState({
    musicId: '',
    startDate: '',
    endDate: '',
  })

  const [videoExporting, setVideoExporting] = useState(false)
  const [musicExporting, setMusicExporting] = useState(false)

  const limit = 50

  const exportFilename = (prefix: string) => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${prefix}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.xlsx`
  }

  const exportVideoViewsXlsx = async () => {
    setVideoExporting(true)
    try {
      const params = new URLSearchParams()
      if (videoFilters.videoId) params.set('videoId', videoFilters.videoId)
      if (videoFilters.startDate) params.set('startDate', videoFilters.startDate)
      if (videoFilters.endDate) params.set('endDate', videoFilters.endDate)

      const res = await fetch(`/api/admin/video-views/export?${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || `Erro HTTP ${res.status}`)
        return
      }
      if (data.queryError) {
        alert(`Erro no banco: ${data.queryError}`)
        return
      }
      const views = (data.views || []) as VideoViewRow[]
      if (views.length === 0) {
        alert('Nenhuma linha para exportar com o filtro atual.')
        return
      }

      const sheetRows = views.map((row) => ({
        'Data/hora': new Date(row.viewedAt).toLocaleString('pt-BR'),
        Vídeo: row.videoTitle,
        Slug: row.videoSlug,
        IP: row.ipAddress ?? '',
        Referrer: row.referer ?? '',
        'User-Agent': row.userAgent ?? '',
        'ID registro': row.id,
      }))

      const ws = XLSX.utils.json_to_sheet(sheetRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Vídeos')
      XLSX.writeFile(wb, exportFilename('visualizacoes-videos'))

      if (data.truncated) {
        alert(
          `Exportadas ${views.length} linhas. O limite máximo por arquivo foi atingido; pode haver registros adicionais.`,
        )
      }
    } catch (e) {
      console.error(e)
      alert('Falha ao exportar.')
    } finally {
      setVideoExporting(false)
    }
  }

  const exportMusicViewsXlsx = async () => {
    setMusicExporting(true)
    try {
      const params = new URLSearchParams()
      if (musicFilters.musicId) params.set('musicId', musicFilters.musicId)
      if (musicFilters.startDate) params.set('startDate', musicFilters.startDate)
      if (musicFilters.endDate) params.set('endDate', musicFilters.endDate)

      const res = await fetch(`/api/admin/music-views/export?${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || `Erro HTTP ${res.status}`)
        return
      }
      if (data.queryError) {
        alert(`Erro no banco: ${data.queryError}`)
        return
      }
      const views = (data.views || []) as MusicViewRow[]
      if (views.length === 0) {
        alert('Nenhuma linha para exportar com o filtro atual.')
        return
      }

      const sheetRows = views.map((row) => ({
        'Data/hora': new Date(row.viewedAt).toLocaleString('pt-BR'),
        Música: row.musicTitle,
        Slug: row.musicSlug,
        IP: row.ipAddress ?? '',
        Referrer: row.referer ?? '',
        'User-Agent': row.userAgent ?? '',
        'ID registro': row.id,
      }))

      const ws = XLSX.utils.json_to_sheet(sheetRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Músicas')
      XLSX.writeFile(wb, exportFilename('visualizacoes-musicas'))

      if (data.truncated) {
        alert(
          `Exportadas ${views.length} linhas. O limite máximo por arquivo foi atingido; pode haver registros adicionais.`,
        )
      }
    } catch (e) {
      console.error(e)
      alert('Falha ao exportar.')
    } finally {
      setMusicExporting(false)
    }
  }

  useEffect(() => {
    const loadVideos = async () => {
      try {
        const res = await fetch('/api/admin/video-views/videos')
        if (res.ok) {
          const data = await res.json()
          setVideos(data.videos || [])
        }
      } catch (e) {
        console.error(e)
      }
    }
    loadVideos()
  }, [])

  useEffect(() => {
    const loadMusics = async () => {
      try {
        const res = await fetch('/api/admin/music-views/musics')
        if (res.ok) {
          const data = await res.json()
          setMusics(data.musics || [])
        }
      } catch (e) {
        console.error(e)
      }
    }
    loadMusics()
  }, [])

  const loadVideoViews = async (page = videoPage) => {
    setVideoLoading(true)
    setVideoSearched(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (videoFilters.videoId) params.set('videoId', videoFilters.videoId)
      if (videoFilters.startDate) params.set('startDate', videoFilters.startDate)
      if (videoFilters.endDate) params.set('endDate', videoFilters.endDate)

      const res = await fetch(`/api/admin/video-views?${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setVideoQueryError(data.error || `Erro HTTP ${res.status}`)
        setVideoViews([])
        setVideoTotal(0)
        return
      }
      setVideoQueryError(data.queryError || null)
      setVideoViews(data.views || [])
      setVideoTotal(typeof data.total === 'number' ? data.total : 0)
    } catch (e) {
      console.error(e)
      setVideoQueryError('Falha ao carregar dados')
      setVideoViews([])
      setVideoTotal(0)
    } finally {
      setVideoLoading(false)
    }
  }

  const loadMusicViews = async (page = musicPage) => {
    setMusicLoading(true)
    setMusicSearched(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (musicFilters.musicId) params.set('musicId', musicFilters.musicId)
      if (musicFilters.startDate) params.set('startDate', musicFilters.startDate)
      if (musicFilters.endDate) params.set('endDate', musicFilters.endDate)

      const res = await fetch(`/api/admin/music-views?${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMusicQueryError(data.error || `Erro HTTP ${res.status}`)
        setMusicViews([])
        setMusicTotal(0)
        return
      }
      setMusicQueryError(data.queryError || null)
      setMusicViews(data.views || [])
      setMusicTotal(typeof data.total === 'number' ? data.total : 0)
    } catch (e) {
      console.error(e)
      setMusicQueryError('Falha ao carregar dados')
      setMusicViews([])
      setMusicTotal(0)
    } finally {
      setMusicLoading(false)
    }
  }

  const videoTotalPages = Math.max(1, Math.ceil(videoTotal / limit))
  const musicTotalPages = Math.max(1, Math.ceil(musicTotal / limit))

  const clearVideoFilters = () => {
    setVideoFilters({ videoId: '', startDate: '', endDate: '' })
    setVideoPage(1)
    setVideoViews([])
    setVideoTotal(0)
    setVideoQueryError(null)
    setVideoSearched(false)
  }

  const clearMusicFilters = () => {
    setMusicFilters({ musicId: '', startDate: '', endDate: '' })
    setMusicPage(1)
    setMusicViews([])
    setMusicTotal(0)
    setMusicQueryError(null)
    setMusicSearched(false)
  }

  const missingVideoTable =
    videoQueryError &&
    (/does not exist|não existe|42P01|Could not find|schema cache/i.test(videoQueryError) ||
      /relation/i.test(videoQueryError))

  const missingMusicTable =
    musicQueryError &&
    (/does not exist|não existe|42P01|Could not find|schema cache/i.test(musicQueryError) ||
      /relation/i.test(musicQueryError))

  const activeError = tab === 'videos' ? videoQueryError : musicQueryError
  const activeMissing = tab === 'videos' ? missingVideoTable : missingMusicTable

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 text-sm"
        >
          <FiArrowLeft className="w-4 h-4" />
          Voltar ao painel
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
              <FiEye className="w-8 h-8 text-primary-400" />
              <span className="gradient-text">Gerenciar Visualizações</span>
            </h1>
            <p className="text-gray-400 mt-2">
              Registro de aberturas das páginas públicas: vídeos e músicas (data, IP, origem quando
              disponíveis).
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-gray-800 pb-1">
          <button
            type="button"
            onClick={() => setTab('videos')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              tab === 'videos'
                ? 'bg-gray-800 text-white border border-b-0 border-gray-700'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FiVideo className="w-4 h-4" />
            Vídeos
          </button>
          <button
            type="button"
            onClick={() => setTab('musics')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              tab === 'musics'
                ? 'bg-gray-800 text-white border border-b-0 border-gray-700'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FiMusic className="w-4 h-4" />
            Músicas
          </button>
        </div>

        {activeError && (
          <div
            className={`mb-6 rounded-lg border p-4 text-sm ${
              activeMissing
                ? 'border-amber-700 bg-amber-950/40 text-amber-100'
                : 'border-red-800 bg-red-950/40 text-red-200'
            }`}
          >
            <p className="font-semibold mb-1">
              {activeMissing
                ? 'Tabela de log ainda não existe ou não foi encontrada'
                : 'Erro ao consultar o banco'}
            </p>
            <p className="text-xs opacity-90 mb-2 font-mono break-all">{activeError}</p>
            {activeMissing && tab === 'videos' && (
              <p className="text-xs">
                Execute <strong>SQL-CRIAR-VIDEO-VIEWS-LOG.sql</strong> no Supabase. Confira também{' '}
                <strong>SUPABASE_SERVICE_ROLE_KEY</strong> no deploy.
              </p>
            )}
            {activeMissing && tab === 'musics' && (
              <p className="text-xs">
                Execute <strong>SQL-CRIAR-MUSIC-VIEWS-LOG.sql</strong> no Supabase (coluna{' '}
                <code className="text-amber-200/90">view_count</code> + tabela{' '}
                <code className="text-amber-200/90">dccmusic_music_views</code>).
              </p>
            )}
          </div>
        )}

        {tab === 'videos' && (
          <>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Vídeo</label>
                  <select
                    value={videoFilters.videoId}
                    onChange={(e) => {
                      setVideoPage(1)
                      setVideoFilters((f) => ({ ...f, videoId: e.target.value }))
                      setVideoViews([])
                      setVideoTotal(0)
                      setVideoSearched(false)
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                  >
                    <option value="">Todos</option>
                    {videos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Data inicial</label>
                  <input
                    type="date"
                    value={videoFilters.startDate}
                    onChange={(e) => {
                      setVideoPage(1)
                      setVideoFilters((f) => ({ ...f, startDate: e.target.value }))
                      setVideoViews([])
                      setVideoTotal(0)
                      setVideoSearched(false)
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Data final</label>
                  <input
                    type="date"
                    value={videoFilters.endDate}
                    onChange={(e) => {
                      setVideoPage(1)
                      setVideoFilters((f) => ({ ...f, endDate: e.target.value }))
                      setVideoViews([])
                      setVideoTotal(0)
                      setVideoSearched(false)
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVideoPage(1)
                      loadVideoViews(1)
                    }}
                    disabled={videoLoading}
                    className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                  >
                    Atualizar
                  </button>
                  <button
                    type="button"
                    onClick={clearVideoFilters}
                    className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm"
                  >
                    Limpar filtros
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                <strong>Dica:</strong> a lista só inclui acessos após criar a tabela de log. O contador
                antigo do vídeo não é importado linha a linha.
              </p>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex flex-wrap justify-between items-center gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-400">
                    {videoLoading ? 'Carregando…' : `${videoTotal} visualização(ões) no filtro`}
                  </span>
                  <button
                    type="button"
                    onClick={exportVideoViewsXlsx}
                    disabled={videoExporting || videoLoading}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiDownload className="w-4 h-4" />
                    {videoExporting ? 'Exportando…' : 'Exportar XLSX'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={videoPage <= 1 || videoLoading}
                    onClick={() => {
                      const nextPage = Math.max(1, videoPage - 1)
                      setVideoPage(nextPage)
                      loadVideoViews(nextPage)
                    }}
                    className="px-3 py-1 text-sm bg-gray-800 rounded disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-gray-400">
                    Página {videoPage} / {videoTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={videoPage >= videoTotalPages || videoLoading}
                    onClick={() => {
                      const nextPage = videoPage + 1
                      setVideoPage(nextPage)
                      loadVideoViews(nextPage)
                    }}
                    className="px-3 py-1 text-sm bg-gray-800 rounded disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-800/60 text-xs uppercase text-gray-400">
                    <tr>
                      <th className="px-3 py-3">Data / hora</th>
                      <th className="px-3 py-3">Vídeo</th>
                      <th className="px-3 py-3 hidden lg:table-cell">IP</th>
                      <th className="px-3 py-3 hidden xl:table-cell">Referrer</th>
                      <th className="px-3 py-3 hidden md:table-cell">User-Agent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {videoLoading ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                          Carregando…
                        </td>
                      </tr>
                    ) : !videoSearched ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                          Escolha os filtros e clique em Atualizar para consultar visualizações de vídeos.
                        </td>
                      </tr>
                    ) : videoViews.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-gray-500 space-y-2">
                          <p>Nenhum registro encontrado.</p>
                          {!videoQueryError && (
                            <p className="text-xs max-w-lg mx-auto text-gray-600">
                              Tente{' '}
                              <button
                                type="button"
                                onClick={clearVideoFilters}
                                className="underline text-primary-400"
                              >
                                limpar filtros
                              </button>
                              .
                            </p>
                          )}
                        </td>
                      </tr>
                    ) : (
                      videoViews.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-3 whitespace-nowrap text-gray-300">
                            <span className="inline-flex items-center gap-1">
                              <FiCalendar className="w-3 h-3 text-gray-500" />
                              {new Date(row.viewedAt).toLocaleString('pt-BR')}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {row.videoSlug ? (
                              <Link
                                href={`/videos/${row.videoSlug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-start gap-2 text-primary-400 hover:text-primary-300"
                              >
                                <FiVideo className="w-4 h-4 shrink-0 mt-0.5" />
                                <span className="font-medium">{row.videoTitle}</span>
                              </Link>
                            ) : (
                              <span className="text-gray-400">{row.videoTitle}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 hidden lg:table-cell text-gray-400 font-mono text-xs">
                            {row.ipAddress || '—'}
                          </td>
                          <td
                            className="px-3 py-3 hidden xl:table-cell text-gray-400 text-xs max-w-xs truncate"
                            title={row.referer || ''}
                          >
                            {row.referer ? (
                              <span className="inline-flex items-center gap-1">
                                <FiGlobe className="w-3 h-3 shrink-0" />
                                {row.referer}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td
                            className="px-3 py-3 hidden md:table-cell text-gray-500 text-xs max-w-md truncate"
                            title={row.userAgent || ''}
                          >
                            {row.userAgent ? (
                              <span className="inline-flex items-center gap-1">
                                <FiMonitor className="w-3 h-3 shrink-0" />
                                {row.userAgent}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'musics' && (
          <>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Música</label>
                  <select
                    value={musicFilters.musicId}
                    onChange={(e) => {
                      setMusicPage(1)
                      setMusicFilters((f) => ({ ...f, musicId: e.target.value }))
                      setMusicViews([])
                      setMusicTotal(0)
                      setMusicSearched(false)
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                  >
                    <option value="">Todas</option>
                    {musics.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Data inicial</label>
                  <input
                    type="date"
                    value={musicFilters.startDate}
                    onChange={(e) => {
                      setMusicPage(1)
                      setMusicFilters((f) => ({ ...f, startDate: e.target.value }))
                      setMusicViews([])
                      setMusicTotal(0)
                      setMusicSearched(false)
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Data final</label>
                  <input
                    type="date"
                    value={musicFilters.endDate}
                    onChange={(e) => {
                      setMusicPage(1)
                      setMusicFilters((f) => ({ ...f, endDate: e.target.value }))
                      setMusicViews([])
                      setMusicTotal(0)
                      setMusicSearched(false)
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMusicPage(1)
                      loadMusicViews(1)
                    }}
                    disabled={musicLoading}
                    className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                  >
                    Atualizar
                  </button>
                  <button
                    type="button"
                    onClick={clearMusicFilters}
                    className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm"
                  >
                    Limpar filtros
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Cada linha é uma abertura de <code className="text-gray-400">/musicas/…</code>. Ordene por
                “Mais vistos” na listagem pública usando o contador agregado.
              </p>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex flex-wrap justify-between items-center gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-400">
                    {musicLoading ? 'Carregando…' : `${musicTotal} visualização(ões) no filtro`}
                  </span>
                  <button
                    type="button"
                    onClick={exportMusicViewsXlsx}
                    disabled={musicExporting || musicLoading}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiDownload className="w-4 h-4" />
                    {musicExporting ? 'Exportando…' : 'Exportar XLSX'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={musicPage <= 1 || musicLoading}
                    onClick={() => {
                      const nextPage = Math.max(1, musicPage - 1)
                      setMusicPage(nextPage)
                      loadMusicViews(nextPage)
                    }}
                    className="px-3 py-1 text-sm bg-gray-800 rounded disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-gray-400">
                    Página {musicPage} / {musicTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={musicPage >= musicTotalPages || musicLoading}
                    onClick={() => {
                      const nextPage = musicPage + 1
                      setMusicPage(nextPage)
                      loadMusicViews(nextPage)
                    }}
                    className="px-3 py-1 text-sm bg-gray-800 rounded disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-800/60 text-xs uppercase text-gray-400">
                    <tr>
                      <th className="px-3 py-3">Data / hora</th>
                      <th className="px-3 py-3">Música</th>
                      <th className="px-3 py-3 hidden lg:table-cell">IP</th>
                      <th className="px-3 py-3 hidden xl:table-cell">Referrer</th>
                      <th className="px-3 py-3 hidden md:table-cell">User-Agent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {musicLoading ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                          Carregando…
                        </td>
                      </tr>
                    ) : !musicSearched ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                          Escolha os filtros e clique em Atualizar para consultar visualizações de músicas.
                        </td>
                      </tr>
                    ) : musicViews.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-gray-500 space-y-2">
                          <p>Nenhum registro encontrado.</p>
                          {!musicQueryError && (
                            <p className="text-xs max-w-lg mx-auto text-gray-600">
                              Tente{' '}
                              <button
                                type="button"
                                onClick={clearMusicFilters}
                                className="underline text-primary-400"
                              >
                                limpar filtros
                              </button>{' '}
                              ou rode o SQL de migração e abra uma música no site.
                            </p>
                          )}
                        </td>
                      </tr>
                    ) : (
                      musicViews.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-3 whitespace-nowrap text-gray-300">
                            <span className="inline-flex items-center gap-1">
                              <FiCalendar className="w-3 h-3 text-gray-500" />
                              {new Date(row.viewedAt).toLocaleString('pt-BR')}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {row.musicSlug ? (
                              <Link
                                href={`/musicas/${row.musicSlug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-start gap-2 text-primary-400 hover:text-primary-300"
                              >
                                <FiMusic className="w-4 h-4 shrink-0 mt-0.5" />
                                <span className="font-medium">{row.musicTitle}</span>
                              </Link>
                            ) : (
                              <span className="text-gray-400">{row.musicTitle}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 hidden lg:table-cell text-gray-400 font-mono text-xs">
                            {row.ipAddress || '—'}
                          </td>
                          <td
                            className="px-3 py-3 hidden xl:table-cell text-gray-400 text-xs max-w-xs truncate"
                            title={row.referer || ''}
                          >
                            {row.referer ? (
                              <span className="inline-flex items-center gap-1">
                                <FiGlobe className="w-3 h-3 shrink-0" />
                                {row.referer}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td
                            className="px-3 py-3 hidden md:table-cell text-gray-500 text-xs max-w-md truncate"
                            title={row.userAgent || ''}
                          >
                            {row.userAgent ? (
                              <span className="inline-flex items-center gap-1">
                                <FiMonitor className="w-3 h-3 shrink-0" />
                                {row.userAgent}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
