import type { TFunction } from 'i18next'

type StudioTopupError = {
  errorCode?: string
}

export function studioTopupError(t: TFunction, data: StudioTopupError | null | undefined, fallbackKey: string) {
  const key = data?.errorCode ? `payment.topup.errors.${data.errorCode}` : fallbackKey
  return t(key, { defaultValue: t(fallbackKey) })
}
