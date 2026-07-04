'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiArrowLeft, FiExternalLink, FiCopy, FiCheck, FiChevronDown, FiChevronUp, FiGlobe, FiMonitor, FiSmartphone, FiTablet, FiUser, FiCpu, FiHelpCircle, FiDownload } from 'react-icons/fi'

interface LinkStats {
  id: string
  title: string
  destinationUrl: string
  shortCode: string
  clickCount: number
  totalClicks: number
  uniqueClicks: number
  humanClicks: number
  botPreviews: number
  unknownClicks: number
  uniqueHumanClicks: number
  conversionRate: number
  clicks: Array<{
    id: string
    ipAddress?: string | null
    userAgent?: string | null
    referer?: string | null
    clickedAt: Date
    country?: string | null
    city?: string | null
    browser?: string | null
    browserVersion?: string | null
    operatingSystem?: string | null
    osVersion?: string | null
    deviceType?: string | null
    language?: string | null
    queryParams?: string | null
    region?: string | null
    clickType?: 'BOT_PREVIEW' | 'HUMAN_CLICK' | 'UNKNOWN' | null
    classificationReason?: string | null
    inferredSource?: string | null
    relatedPreviewId?: string | null
    asn?: string | null
    isp?: string | null
    ipMasked?: string | null
  }>
}

export default function EstatisticasPage() {
  const params = useParams()
  const router = useRouter()
  const shortCode = params.shortCode as string
  const [stats, setStats] = useState<LinkStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [filterDevice, setFilterDevice] = useState<string>('all')
  const [filterBrowser, setFilterBrowser] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all') // all, HUMAN_CLICK, BOT_PREVIEW, UNKNOWN
  const [filterSource, setFilterSource] = useState<string>('all')

  useEffect(() => {
    if (shortCode) {
      loadStats()
    }
  }, [shortCode])

  const loadStats = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/links/${shortCode}`)
      
      if (!response.ok) {
        throw new Error('Erro ao carregar estatísticas')
      }
      
      const data = await response.json()
      setStats(data)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar estatísticas')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Erro ao copiar:', err)
    }
  }

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    return ''
  }

  const toggleRowExpansion = (clickId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(clickId)) {
      newExpanded.delete(clickId)
    } else {
      newExpanded.add(clickId)
    }
    setExpandedRows(newExpanded)
  }

  const getDeviceIcon = (deviceType?: string | null) => {
    switch (deviceType) {
      case 'mobile':
        return <FiSmartphone className="w-4 h-4" />
      case 'tablet':
        return <FiTablet className="w-4 h-4" />
      case 'desktop':
        return <FiMonitor className="w-4 h-4" />
      default:
        return <FiGlobe className="w-4 h-4" />
    }
  }

  const formatLocation = (click: LinkStats['clicks'][0]) => {
    const parts: string[] = []
    if (click.city) parts.push(click.city)
    if (click.region) parts.push(click.region)
    if (click.country) parts.push(click.country)
    return parts.length > 0 ? parts.join(', ') : 'N/A'
  }

  const formatBrowserInfo = (click: LinkStats['clicks'][0]) => {
    if (click.browser) {
      return `${click.browser}${click.browserVersion ? ` ${click.browserVersion}` : ''}`
    }
    return 'N/A'
  }

  const formatOSInfo = (click: LinkStats['clicks'][0]) => {
    if (click.operatingSystem) {
      return `${click.operatingSystem}${click.osVersion ? ` ${click.osVersion}` : ''}`
    }
    return 'N/A'
  }
  
  const getClickTypeBadge = (clickType?: string | null) => {
    switch (clickType) {
      case 'HUMAN_CLICK':
        return <span className="px-2 py-1 bg-green-900/50 text-green-300 rounded text-xs">Humano</span>
      case 'BOT_PREVIEW':
        return <span className="px-2 py-1 bg-orange-900/50 text-orange-300 rounded text-xs">Bot</span>
      case 'UNKNOWN':
        return <span className="px-2 py-1 bg-yellow-900/50 text-yellow-300 rounded text-xs">Desconhecido</span>
      default:
        return <span className="px-2 py-1 bg-gray-700 text-gray-400 rounded text-xs">N/A</span>
    }
  }
  
  const exportToCSV = () => {
    if (!stats) return
    
    const headers = [
      'Data/Hora',
      'Tipo',
      'Motivo',
      'Origem',
      'IP',
      'IP Mascarado',
      'Dispositivo',
      'Navegador',
      'OS',
      'País',
      'Cidade',
      'Região',
      'ISP',
      'ASN',
      'Referer',
      'User Agent'
    ]
    
    const rows = filteredClicks.map(click => [
      new Date(click.clickedAt).toLocaleString('pt-BR'),
      click.clickType || 'UNKNOWN',
      click.classificationReason || '',
      click.inferredSource || '',
      click.ipAddress || '',
      click.ipMasked || '',
      click.deviceType || '',
      formatBrowserInfo(click),
      formatOSInfo(click),
      click.country || '',
      click.city || '',
      click.region || '',
      click.isp || '',
      click.asn || '',
      click.referer || '',
      click.userAgent || ''
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `cliques-${stats.shortCode}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Filtrar cliques
  const filteredClicks = stats?.clicks.filter(click => {
    if (filterDevice !== 'all' && click.deviceType !== filterDevice) return false
    if (filterBrowser !== 'all' && click.browser !== filterBrowser) return false
    if (filterType !== 'all' && click.clickType !== filterType) return false
    if (filterSource !== 'all' && click.inferredSource !== filterSource) return false
    return true
  }) || []
  
  // Obter fontes únicas para filtro
  const uniqueSources = Array.from(new Set(
    stats?.clicks
      .map(c => c.inferredSource)
      .filter(s => s) as string[]
  ))

  // Estatísticas filtradas
  const deviceStats = {
    desktop: stats?.clicks.filter(c => c.deviceType === 'desktop').length || 0,
    mobile: stats?.clicks.filter(c => c.deviceType === 'mobile').length || 0,
    tablet: stats?.clicks.filter(c => c.deviceType === 'tablet').length || 0,
  }

  const browserStats = new Map<string, number>()
  stats?.clicks.forEach(click => {
    if (click.browser) {
      browserStats.set(click.browser, (browserStats.get(click.browser) || 0) + 1)
    }
  })

  if (loading) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-16">
            <p className="text-gray-400">Carregando estatísticas...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-16">
            <p className="text-red-400 mb-4">{error || 'Link não encontrado'}</p>
            <Link
              href="/admin/links"
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              Voltar para Links
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const trackedUrl = `${getBaseUrl()}/l/${stats.shortCode}`

  return (
    <div className="min-h-screen py-4 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <Link
          href="/admin/links"
          className="inline-flex items-center space-x-2 text-gray-400 hover:text-white mb-4 sm:mb-6 transition-colors text-sm sm:text-base"
        >
          <FiArrowLeft className="w-4 h-4" />
          <span>Voltar para Links</span>
        </Link>

        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            <span className="gradient-text">Estatísticas do Link</span>
          </h1>
          <h2 className="text-lg sm:text-xl text-gray-300 mb-4 break-words">{stats.title}</h2>

          {/* Link Rastreável */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Link Rastreável:
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                readOnly
                value={trackedUrl}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-xs sm:text-sm text-white break-all"
              />
              <button
                onClick={() => copyToClipboard(trackedUrl)}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-md transition-colors flex items-center justify-center space-x-2 text-sm whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <FiCheck className="w-4 h-4" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <FiCopy className="w-4 h-4" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* URL de Destino */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              URL de Destino:
            </label>
            <a
              href={stats.destinationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 flex items-start sm:items-center space-x-2 break-all text-sm"
            >
              <span className="break-all">{stats.destinationUrl}</span>
              <FiExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0" />
            </a>
          </div>

          {/* Estatísticas Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-400 mb-1 flex items-center gap-2">
                <FiGlobe className="w-4 h-4" />
                Total de Hits
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-primary-400">{stats.totalClicks}</div>
              <div className="text-xs text-gray-500 mt-1">Todos os acessos</div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-400 mb-1 flex items-center gap-2">
                <FiUser className="w-4 h-4" />
                Cliques Humanos
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-green-400">{stats.humanClicks}</div>
              <div className="text-xs text-gray-500 mt-1">{stats.uniqueHumanClicks} únicos</div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-400 mb-1 flex items-center gap-2">
                <FiCpu className="w-4 h-4" />
                Pré-visualizações
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-orange-400">{stats.botPreviews}</div>
              <div className="text-xs text-gray-500 mt-1">Bots/Crawlers</div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-400 mb-1 flex items-center gap-2">
                <FiHelpCircle className="w-4 h-4" />
                Conversão Real
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-yellow-400">
                {stats.totalClicks > 0
                  ? Math.round(stats.conversionRate * 100)
                  : 0}
                %
              </div>
              <div className="text-xs text-gray-500 mt-1">Baseado em humanos</div>
            </div>
          </div>
          
          {/* Estatísticas Detalhadas */}
          {stats.unknownClicks > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3 mb-4">
              <div className="text-sm text-yellow-300">
                <strong>{stats.unknownClicks}</strong> cliques não classificados (requerem revisão)
              </div>
            </div>
          )}

          {/* Estatísticas por Dispositivo */}
          {stats.totalClicks > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs sm:text-sm text-gray-400">Desktop</div>
                  <FiMonitor className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-blue-400">{deviceStats.desktop}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {stats.totalClicks > 0 ? Math.round((deviceStats.desktop / stats.totalClicks) * 100) : 0}%
                </div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs sm:text-sm text-gray-400">Mobile</div>
                  <FiSmartphone className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-green-400">{deviceStats.mobile}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {stats.totalClicks > 0 ? Math.round((deviceStats.mobile / stats.totalClicks) * 100) : 0}%
                </div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs sm:text-sm text-gray-400">Tablet</div>
                  <FiTablet className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-purple-400">{deviceStats.tablet}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {stats.totalClicks > 0 ? Math.round((deviceStats.tablet / stats.totalClicks) * 100) : 0}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lista de Cliques */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 sm:p-6">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-4">
              <span className="gradient-text">Histórico de Cliques</span>
            </h2>
            
            {/* Filtros */}
            {stats.clicks.length > 0 && (
              <div className="space-y-3">
                {/* Grid de filtros - 2 colunas no mobile, mais no desktop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white w-full"
                  >
                    <option value="all">Todos os tipos</option>
                    <option value="HUMAN_CLICK">Cliques Humanos</option>
                    <option value="BOT_PREVIEW">Pré-visualizações</option>
                    <option value="UNKNOWN">Não classificados</option>
                  </select>
                  <select
                    value={filterDevice}
                    onChange={(e) => setFilterDevice(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white w-full"
                  >
                    <option value="all">Todos os dispositivos</option>
                    <option value="desktop">Desktop</option>
                    <option value="mobile">Mobile</option>
                    <option value="tablet">Tablet</option>
                  </select>
                  <select
                    value={filterBrowser}
                    onChange={(e) => setFilterBrowser(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white w-full"
                  >
                    <option value="all">Todos os navegadores</option>
                    {Array.from(browserStats.keys()).map(browser => (
                      <option key={browser} value={browser}>{browser}</option>
                    ))}
                  </select>
                  {uniqueSources.length > 0 && (
                    <select
                      value={filterSource}
                      onChange={(e) => setFilterSource(e.target.value)}
                      className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white w-full"
                    >
                      <option value="all">Todas as origens</option>
                      {uniqueSources.map(source => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </select>
                  )}
                </div>
                {/* Botão Exportar CSV em linha separada para garantir que não saia do card */}
                <div className="w-full">
                  <button
                    onClick={() => exportToCSV()}
                    className="w-full sm:w-auto px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm text-white flex items-center justify-center gap-2"
                  >
                    <FiDownload className="w-4 h-4" />
                    Exportar CSV
                  </button>
                </div>
              </div>
            )}
          </div>

          {filteredClicks.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm sm:text-base">
              {stats.clicks.length === 0 
                ? 'Nenhum clique registrado ainda.'
                : 'Nenhum clique encontrado com os filtros selecionados.'}
            </div>
          ) : (
            <>
              {/* Versão Mobile/Tablet: Cards */}
              <div className="block lg:hidden space-y-3">
                {filteredClicks.map((click) => {
                  const isExpanded = expandedRows.has(click.id)
                  return (
                    <div
                      key={click.id}
                      className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 cursor-pointer"
                      onClick={() => toggleRowExpansion(click.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="text-xs text-gray-400 mb-1">
                            {new Date(click.clickedAt).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            {getDeviceIcon(click.deviceType)}
                            <span className="text-sm font-medium capitalize">{click.deviceType || 'Unknown'}</span>
                          </div>
                        </div>
                        {isExpanded ? (
                          <FiChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        ) : (
                          <FiChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-500 text-xs">Tipo:</span>
                          <div className="mt-1">{getClickTypeBadge(click.clickType)}</div>
                          {click.classificationReason && (
                            <div className="text-xs text-gray-500 mt-1">{click.classificationReason}</div>
                          )}
                        </div>
                        {click.inferredSource && (
                          <div>
                            <span className="text-gray-500 text-xs">Origem Inferida:</span>
                            <div className="text-blue-400 font-medium">{click.inferredSource}</div>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500 text-xs">Navegador:</span>
                          <div className="text-gray-300 font-medium">{formatBrowserInfo(click)}</div>
                          <div className="text-xs text-gray-500">{formatOSInfo(click)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Localização:</span>
                          <div className="text-gray-300">{formatLocation(click)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">IP:</span>
                          <div className="text-gray-300 font-mono text-xs">{click.ipMasked || click.ipAddress || 'N/A'}</div>
                        </div>
                        {click.referer && (
                          <div>
                            <span className="text-gray-500 text-xs">Referer:</span>
                            <a
                              href={click.referer}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-400 hover:text-blue-300 text-xs break-all block"
                            >
                              {new URL(click.referer).hostname}
                            </a>
                          </div>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-700 space-y-3 text-xs">
                          <div>
                            <div className="text-gray-400 mb-1 font-medium">Informações Técnicas</div>
                            <div className="space-y-1 text-gray-300">
                              <div><span className="text-gray-500">User Agent:</span></div>
                              <div className="font-mono break-all text-xs bg-gray-900/50 p-2 rounded">{click.userAgent || 'N/A'}</div>
                              {click.language && (
                                <div><span className="text-gray-500">Idioma:</span> {click.language}</div>
                              )}
                              {click.queryParams && (
                                <div>
                                  <span className="text-gray-500">Query Params:</span>
                                  <div className="font-mono break-all bg-gray-900/50 p-2 rounded mt-1">{click.queryParams}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Versão Desktop: Tabela */}
              <div className="hidden lg:block overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Data/Hora
                      </th>
                      <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Tipo
                      </th>
                      <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Dispositivo
                      </th>
                      <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Navegador / OS
                      </th>
                      <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Localização
                      </th>
                      <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        IP
                      </th>
                      <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Origem
                      </th>
                      <th className="px-3 lg:px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                        Detalhes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredClicks.map((click) => {
                      const isExpanded = expandedRows.has(click.id)
                      return (
                        <>
                          <tr key={click.id} className="hover:bg-gray-800/30 cursor-pointer" onClick={() => toggleRowExpansion(click.id)}>
                            <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm">
                              {new Date(click.clickedAt).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm">
                              <div className="flex flex-col gap-1">
                                {getClickTypeBadge(click.clickType)}
                                {click.classificationReason && (
                                  <span className="text-xs text-gray-500" title={click.classificationReason}>
                                    {click.classificationReason.length > 30 
                                      ? click.classificationReason.substring(0, 30) + '...'
                                      : click.classificationReason}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm">
                              <div className="flex items-center gap-2">
                                {getDeviceIcon(click.deviceType)}
                                <span className="capitalize">{click.deviceType || 'Unknown'}</span>
                              </div>
                            </td>
                            <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm text-gray-300">
                              <div className="space-y-1">
                                <div className="font-medium">{formatBrowserInfo(click)}</div>
                                <div className="text-xs text-gray-500">{formatOSInfo(click)}</div>
                              </div>
                            </td>
                            <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm text-gray-400">
                              {formatLocation(click)}
                            </td>
                            <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm text-gray-400 font-mono text-xs">
                              {click.ipMasked || click.ipAddress || 'N/A'}
                            </td>
                            <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm">
                              <div className="flex flex-col gap-1">
                                {click.inferredSource && (
                                  <span className="text-blue-400 font-medium text-xs">{click.inferredSource}</span>
                                )}
                                {click.referer ? (
                                  <a
                                    href={click.referer}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-400 hover:text-blue-300 truncate max-w-xs block text-xs"
                                    title={click.referer}
                                  >
                                    {new URL(click.referer).hostname}
                                  </a>
                                ) : (
                                  <span className="text-gray-500 text-xs">Direto</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 lg:px-4 py-3 text-center">
                              {isExpanded ? (
                                <FiChevronUp className="w-4 h-4 mx-auto text-gray-400" />
                              ) : (
                                <FiChevronDown className="w-4 h-4 mx-auto text-gray-400" />
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-gray-800/20">
                              <td colSpan={8} className="px-3 lg:px-4 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <div className="text-gray-400 mb-2 font-medium">Informações Técnicas</div>
                                    <div className="space-y-1 text-gray-300">
                                      {click.classificationReason && (
                                        <div><span className="text-gray-500">Motivo:</span> {click.classificationReason}</div>
                                      )}
                                      {click.inferredSource && (
                                        <div><span className="text-gray-500">Origem Inferida:</span> {click.inferredSource}</div>
                                      )}
                                      {click.isp && (
                                        <div><span className="text-gray-500">ISP:</span> {click.isp}</div>
                                      )}
                                      {click.asn && (
                                        <div><span className="text-gray-500">ASN:</span> {click.asn}</div>
                                      )}
                                      <div><span className="text-gray-500">User Agent:</span> <span className="font-mono text-xs break-all">{click.userAgent || 'N/A'}</span></div>
                                      {click.language && (
                                        <div><span className="text-gray-500">Idioma:</span> {click.language}</div>
                                      )}
                                      {click.queryParams && (
                                        <div><span className="text-gray-500">Query Params:</span> <span className="font-mono text-xs">{click.queryParams}</span></div>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-gray-400 mb-2 font-medium">Detalhes do Dispositivo</div>
                                    <div className="space-y-1 text-gray-300">
                                      {click.browser && (
                                        <div><span className="text-gray-500">Navegador:</span> {formatBrowserInfo(click)}</div>
                                      )}
                                      {click.operatingSystem && (
                                        <div><span className="text-gray-500">Sistema:</span> {formatOSInfo(click)}</div>
                                      )}
                                      {click.deviceType && (
                                        <div><span className="text-gray-500">Tipo:</span> <span className="capitalize">{click.deviceType}</span></div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
