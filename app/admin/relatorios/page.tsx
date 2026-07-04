'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { FiFileText, FiDownload, FiSearch, FiFilter, FiX, FiCalendar, FiGlobe, FiMonitor, FiSmartphone, FiTablet, FiUser, FiCpu, FiHelpCircle, FiMusic } from 'react-icons/fi'

interface ClickReport {
  id: string
  linkId: string
  linkTitle: string
  linkShortCode: string
  linkDestination: string
  clickedAt: string
  ipAddress?: string | null
  ipMasked?: string | null
  userAgent?: string | null
  referer?: string | null
  clickType: string
  classificationReason?: string | null
  inferredSource?: string | null
  deviceType?: string | null
  browser?: string | null
  browserVersion?: string | null
  operatingSystem?: string | null
  osVersion?: string | null
  language?: string | null
  country?: string | null
  city?: string | null
  region?: string | null
  asn?: string | null
  isp?: string | null
  latitude?: number | null
  longitude?: number | null
  queryParams?: string | null
  relatedPreviewId?: string | null
}

interface FilterOptions {
  links: Array<{ id: string; title: string; short_code: string }>
  clickTypes: string[]
  deviceTypes: string[]
  browsers: string[]
  sources: string[]
  countries: string[]
}

export default function RelatoriosPage() {
  const [clicks, setClicks] = useState<ClickReport[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [options, setOptions] = useState<FilterOptions | null>(null)
  const [total, setTotal] = useState(0)
  
  // Filtros
  const [filters, setFilters] = useState({
    linkId: '',
    clickType: '',
    deviceType: '',
    browser: '',
    inferredSource: '',
    country: '',
    startDate: '',
    endDate: '',
  })

  useEffect(() => {
    loadOptions()
  }, [])

  const loadOptions = async () => {
    try {
      const response = await fetch('/api/admin/reports/options')
      if (!response.ok) throw new Error('Erro ao carregar opções')
      const data = await response.json()
      setOptions(data)
    } catch (error) {
      console.error('Erro ao carregar opções:', error)
    }
  }

  const loadClicks = async () => {
    try {
      setLoading(true)
      setHasSearched(true)
      const params = new URLSearchParams()
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      params.append('limit', '10000')

      const response = await fetch(`/api/admin/reports/clicks?${params.toString()}`)
      if (!response.ok) throw new Error('Erro ao carregar cliques')
      
      const data = await response.json()
      setClicks(data.clicks)
      setTotal(data.total)
    } catch (error) {
      console.error('Erro ao carregar cliques:', error)
      alert('Erro ao carregar cliques')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setClicks([])
    setTotal(0)
    setHasSearched(false)
  }

  const clearFilters = () => {
    setFilters({
      linkId: '',
      clickType: '',
      deviceType: '',
      browser: '',
      inferredSource: '',
      country: '',
      startDate: '',
      endDate: '',
    })
    setClicks([])
    setTotal(0)
    setHasSearched(false)
  }

  const exportToXLSX = async () => {
    if (clicks.length === 0) {
      alert('Nenhum clique para exportar')
      return
    }

    try {
      // Importar dinamicamente para evitar problemas de SSR
      const XLSX = await import('xlsx')

      // Preparar dados para Excel
      const excelData = clicks.map(click => ({
        'Data/Hora': new Date(click.clickedAt).toLocaleString('pt-BR'),
        'Título do Link': click.linkTitle,
        'Código Curto': click.linkShortCode,
        'URL Destino': click.linkDestination,
        'Tipo': click.clickType,
        'Motivo': click.classificationReason || '',
        'Origem Inferida': click.inferredSource || '',
        'Dispositivo': click.deviceType || '',
        'Navegador': click.browser || '',
        'Versão Navegador': click.browserVersion || '',
        'Sistema Operacional': click.operatingSystem || '',
        'Versão OS': click.osVersion || '',
        'País': click.country || '',
        'Cidade': click.city || '',
        'Região': click.region || '',
        'IP': click.ipMasked || click.ipAddress || '',
        'IP Completo': click.ipAddress || '',
        'ISP': click.isp || '',
        'ASN': click.asn || '',
        'Latitude': click.latitude || '',
        'Longitude': click.longitude || '',
        'Referer': click.referer || '',
        'Idioma': click.language || '',
        'Query Params': click.queryParams || '',
        'User Agent': click.userAgent || '',
      }))

      // Criar workbook
      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Cliques')

      // Exportar
      const fileName = `relatorio-cliques-${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)
    } catch (error) {
      console.error('Erro ao exportar XLSX:', error)
      alert('Erro ao exportar arquivo. Tente novamente.')
    }
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

  // Estatísticas filtradas
  const stats = {
    total: clicks.length,
    human: clicks.filter(c => c.clickType === 'HUMAN_CLICK').length,
    bot: clicks.filter(c => c.clickType === 'BOT_PREVIEW').length,
    unknown: clicks.filter(c => c.clickType === 'UNKNOWN' || !c.clickType).length,
  }

  return (
    <div className="min-h-screen py-4 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">
              <span className="gradient-text">Relatórios de Cliques</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-400">Relatório completo com todas as informações de cliques</p>
          </div>
          <Link
            href="/admin/graficos"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700"
          >
            <FiMusic className="h-4 w-4" />
            Gráficos e fornecedores
          </Link>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Total</div>
            <div className="text-xl sm:text-2xl font-bold text-primary-400">{stats.total}</div>
            <div className="text-xs text-gray-500 mt-1">de {total} total</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-xs sm:text-sm text-gray-400 mb-1 flex items-center gap-1">
              <FiUser className="w-3 h-3" />
              Humanos
            </div>
            <div className="text-xl sm:text-2xl font-bold text-green-400">{stats.human}</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-xs sm:text-sm text-gray-400 mb-1 flex items-center gap-1">
              <FiCpu className="w-3 h-3" />
              Bots
            </div>
            <div className="text-xl sm:text-2xl font-bold text-orange-400">{stats.bot}</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-xs sm:text-sm text-gray-400 mb-1 flex items-center gap-1">
              <FiHelpCircle className="w-3 h-3" />
              Desconhecidos
            </div>
            <div className="text-xl sm:text-2xl font-bold text-yellow-400">{stats.unknown}</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <FiFilter className="w-5 h-5" />
              Filtros
            </h2>
            {(filters.linkId || filters.clickType || filters.deviceType || filters.browser || filters.inferredSource || filters.country || filters.startDate || filters.endDate) && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
              >
                <FiX className="w-4 h-4" />
                Limpar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Link */}
            <div>
              <label className="block text-xs sm:text-sm text-gray-400 mb-2">Link</label>
              <select
                value={filters.linkId}
                onChange={(e) => handleFilterChange('linkId', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              >
                <option value="">Todos os links</option>
                {options?.links.map(link => (
                  <option key={link.id} value={link.id}>{link.title} ({link.short_code})</option>
                ))}
              </select>
            </div>

            {/* Tipo de Clique */}
            <div>
              <label className="block text-xs sm:text-sm text-gray-400 mb-2">Tipo</label>
              <select
                value={filters.clickType}
                onChange={(e) => handleFilterChange('clickType', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              >
                <option value="">Todos os tipos</option>
                <option value="HUMAN_CLICK">Cliques Humanos</option>
                <option value="BOT_PREVIEW">Pré-visualizações</option>
                <option value="UNKNOWN">Desconhecidos</option>
              </select>
            </div>

            {/* Dispositivo */}
            <div>
              <label className="block text-xs sm:text-sm text-gray-400 mb-2">Dispositivo</label>
              <select
                value={filters.deviceType}
                onChange={(e) => handleFilterChange('deviceType', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              >
                <option value="">Todos os dispositivos</option>
                {options?.deviceTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Navegador */}
            <div>
              <label className="block text-xs sm:text-sm text-gray-400 mb-2">Navegador</label>
              <select
                value={filters.browser}
                onChange={(e) => handleFilterChange('browser', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              >
                <option value="">Todos os navegadores</option>
                {options?.browsers.map(browser => (
                  <option key={browser} value={browser}>{browser}</option>
                ))}
              </select>
            </div>

            {/* Origem */}
            <div>
              <label className="block text-xs sm:text-sm text-gray-400 mb-2">Origem</label>
              <select
                value={filters.inferredSource}
                onChange={(e) => handleFilterChange('inferredSource', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              >
                <option value="">Todas as origens</option>
                {options?.sources.map(source => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>

            {/* País */}
            <div>
              <label className="block text-xs sm:text-sm text-gray-400 mb-2">País</label>
              <select
                value={filters.country}
                onChange={(e) => handleFilterChange('country', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              >
                <option value="">Todos os países</option>
                {options?.countries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>

            {/* Data Inicial */}
            <div>
              <label className="block text-xs sm:text-sm text-gray-400 mb-2 flex items-center gap-1">
                <FiCalendar className="w-3 h-3" />
                Data Inicial
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              />
            </div>

            {/* Data Final */}
            <div>
              <label className="block text-xs sm:text-sm text-gray-400 mb-2 flex items-center gap-1">
                <FiCalendar className="w-3 h-3" />
                Data Final
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              />
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="mb-6 flex flex-wrap justify-end gap-3">
          <button
            onClick={loadClicks}
            disabled={loading}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiSearch className="w-5 h-5" />
            Atualizar
          </button>
          <button
            onClick={exportToXLSX}
            disabled={loading || clicks.length === 0}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiDownload className="w-5 h-5" />
            Exportar XLSX ({clicks.length} registros)
          </button>
        </div>

        {/* Tabela de Resultados */}
        {loading ? (
          <div className="text-center py-16">
            <p className="text-gray-400">Carregando cliques...</p>
          </div>
        ) : !hasSearched ? (
          <div className="text-center py-16 bg-gray-900/50 border border-gray-800 rounded-lg">
            <FiFileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Escolha os filtros e clique em Atualizar para consultar os cliques.</p>
          </div>
        ) : clicks.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 border border-gray-800 rounded-lg">
            <FiFileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhum clique encontrado com os filtros selecionados.</p>
          </div>
        ) : (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Data/Hora</th>
                    <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Título do Link</th>
                    <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Código</th>
                    <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tipo</th>
                    <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Dispositivo</th>
                    <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Navegador/OS</th>
                    <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Localização</th>
                    <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">IP</th>
                    <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Origem</th>
                    <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">ISP/ASN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {clicks.map((click) => (
                    <tr key={click.id} className="hover:bg-gray-800/30">
                      <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm whitespace-nowrap">
                        {new Date(click.clickedAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm">
                        <div className="max-w-xs">
                          <div className="font-medium truncate" title={click.linkTitle}>{click.linkTitle}</div>
                        </div>
                      </td>
                      <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm">
                        <div className="text-gray-400 font-mono text-xs">{click.linkShortCode}</div>
                        <a
                          href={`/l/${click.linkShortCode}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-xs truncate max-w-xs block"
                          title={click.linkDestination}
                        >
                          {click.linkDestination.length > 40 
                            ? click.linkDestination.substring(0, 40) + '...'
                            : click.linkDestination}
                        </a>
                      </td>
                      <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm">
                        <div className="flex flex-col gap-1">
                          {getClickTypeBadge(click.clickType)}
                          {click.classificationReason && (
                            <span className="text-xs text-gray-500 truncate max-w-xs" title={click.classificationReason}>
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
                          <span className="capitalize">{click.deviceType || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm">
                        <div>
                          <div>{click.browser || 'N/A'}{click.browserVersion ? ` ${click.browserVersion}` : ''}</div>
                          <div className="text-gray-500 text-xs">{click.operatingSystem || 'N/A'}{click.osVersion ? ` ${click.osVersion}` : ''}</div>
                        </div>
                      </td>
                      <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm text-gray-400">
                        {[click.city, click.region, click.country].filter(Boolean).join(', ') || 'N/A'}
                      </td>
                      <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm font-mono text-gray-400">
                        {click.ipMasked || click.ipAddress || 'N/A'}
                      </td>
                      <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm">
                        <div className="flex flex-col gap-1">
                          {click.inferredSource && (
                            <span className="text-blue-400 font-medium">{click.inferredSource}</span>
                          )}
                          {click.referer && (
                            <a
                              href={click.referer}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 text-xs truncate max-w-xs"
                              title={click.referer}
                            >
                              {new URL(click.referer).hostname}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm text-gray-400">
                        <div className="flex flex-col gap-1">
                          {click.isp && <span className="truncate max-w-xs" title={click.isp}>{click.isp}</span>}
                          {click.asn && <span className="text-xs">ASN: {click.asn}</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
