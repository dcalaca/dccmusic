import type { TFunction } from 'i18next'

export function composerVideoError(t: TFunction, data: { errorCode?: string }, status: number, fallback: 'create' | 'update' | 'delete') {
  const keys: Record<string, string> = {
    unauthorized: 'unauthorized',
    subscriptionRequired: 'subscriptionRequired',
    videoNotFound: 'notFound',
    titleRequired: 'titleRequired',
  }
  const key = data?.errorCode && keys[data.errorCode]
  if (key) return t(`videos.form.errors.${key}`)
  if (status === 401) return t('videos.form.errors.unauthorized')
  if (status === 403) return t('videos.form.errors.subscriptionRequired')
  if (status === 404) return t('videos.form.errors.notFound')
  return t(`videos.form.errors.${fallback}`)
}
