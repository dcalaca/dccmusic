'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface LinkData {
  id: string
  title: string
  destinationUrl: string
  shortCode: string
  trackedUrl: string
  clickCount: number
  createdAt: string
}

export default function LinksPage() {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    title: '',
    destinationUrl: '',
    createdBy: '',
    notes: '',
    expiresAt: '',
  })
  const [createdLink, setCreatedLink] = useState<LinkData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setCreatedLink(null)

    try {
      const body: any = {
        title: formData.title,
        destinationUrl: formData.destinationUrl,
      }

      if (formData.createdBy) body.createdBy = formData.createdBy
      if (formData.notes) body.notes = formData.notes
      if (formData.expiresAt) body.expiresAt = formData.expiresAt

      const response = await fetch('/api/links/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(t('trackedLinks.errors.create'))
      }

      const link = await response.json()
      setCreatedLink(link)
      setFormData({
        title: '',
        destinationUrl: '',
        createdBy: '',
        notes: '',
        expiresAt: '',
      })
    } catch (err: any) {
      setError(err.message || t('trackedLinks.errors.create'))
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow-md rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {t('trackedLinks.title')}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                {t('trackedLinks.fields.title')} *
              </label>
              <input
                type="text"
                id="title"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('trackedLinks.placeholders.title')}
              />
            </div>

            <div>
              <label htmlFor="destinationUrl" className="block text-sm font-medium text-gray-700 mb-1">
                {t('trackedLinks.fields.destinationUrl')} *
              </label>
              <input
                type="url"
                id="destinationUrl"
                required
                value={formData.destinationUrl}
                onChange={(e) => setFormData({ ...formData, destinationUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('trackedLinks.placeholders.url')}
              />
            </div>

            <div>
              <label htmlFor="createdBy" className="block text-sm font-medium text-gray-700 mb-1">
                {t('trackedLinks.fields.createdBy')} ({t('trackedLinks.optional')})
              </label>
              <input
                type="text"
                id="createdBy"
                value={formData.createdBy}
                onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('trackedLinks.placeholders.email')}
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                {t('trackedLinks.fields.notes')} ({t('trackedLinks.optional')})
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('trackedLinks.placeholders.notes')}
              />
            </div>

            <div>
              <label htmlFor="expiresAt" className="block text-sm font-medium text-gray-700 mb-1">
                {t('trackedLinks.fields.expiresAt')} ({t('trackedLinks.optional')})
              </label>
              <input
                type="datetime-local"
                id="expiresAt"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('trackedLinks.creating') : t('trackedLinks.title')}
            </button>
          </form>

          {createdLink && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <h2 className="text-lg font-semibold text-green-900 mb-2">
                {t('trackedLinks.successTitle')}
              </h2>
              <div className="space-y-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">{t('trackedLinks.trackedLink')}:</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      readOnly
                      value={createdLink.trackedUrl}
                      className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(createdLink.trackedUrl)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      {copied ? t('common.actions.copied') : t('common.actions.copy')}
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  <p><strong>{t('trackedLinks.code')}:</strong> {createdLink.shortCode}</p>
                  <p><strong>{t('trackedLinks.clicks')}:</strong> {createdLink.clickCount}</p>
                </div>
                <div className="mt-3">
                  <a
                    href={`/api/links/${createdLink.shortCode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm underline"
                  >
                    {t('trackedLinks.viewStats')} →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {t('trackedLinks.howItWorks')}
          </h2>
          <ul className="space-y-2 text-gray-700">
            <li>{t('trackedLinks.steps.1')}</li>
            <li>{t('trackedLinks.steps.2')}</li>
            <li>{t('trackedLinks.steps.3')}
              <ul className="ml-4 mt-1 space-y-1 text-sm text-gray-600">
                <li>• {t('trackedLinks.data.ip')}</li>
                <li>• {t('trackedLinks.data.device')}</li>
                <li>• {t('trackedLinks.data.referrer')}</li>
                <li>• {t('trackedLinks.data.dateTime')}</li>
              </ul>
            </li>
            <li>{t('trackedLinks.steps.4')}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
