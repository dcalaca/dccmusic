import type { TFunction } from 'i18next'

export class ComposerVoiceUiError extends Error {}

const voiceErrorKeys: Record<string, string> = {
  unauthorized: 'voices.apiErrors.unauthorized',
  voiceLimitReached: 'voices.apiErrors.voiceLimitReached',
  displayNameRequired: 'voices.apiErrors.displayNameRequired',
  consentRequired: 'voices.apiErrors.consentRequired',
  sourceAudioRequired: 'voices.apiErrors.sourceAudioRequired',
  duplicateAwaitingVerification: 'voices.apiErrors.duplicateAwaitingVerification',
  duplicateVoiceName: 'voices.apiErrors.duplicateVoiceName',
  invalidAction: 'voices.apiErrors.invalidAction',
  voiceNotFound: 'voices.apiErrors.voiceNotFound',
  reactivationUnavailable: 'voices.apiErrors.reactivationUnavailable',
  sourceAudioMissing: 'voices.apiErrors.sourceAudioMissing',
  recoverExpiredOnly: 'voices.apiErrors.recoverExpiredOnly',
  duplicateActiveVoice: 'voices.apiErrors.duplicateActiveVoice',
  validationPhraseNotReady: 'voices.apiErrors.validationPhraseNotReady',
  verificationAudioRequired: 'voices.apiErrors.verificationAudioRequired',
  fileTooLargeDirect: 'voices.errors.fileTooLargeDirect',
}

export function composerVoiceApiError(
  t: TFunction,
  data: { errorCode?: string; voiceName?: string; limit?: number },
  fallback: string
) {
  const key = data?.errorCode ? voiceErrorKeys[data.errorCode] : undefined
  return key
    ? t(key, { name: data.voiceName, count: data.limit })
    : t(`voices.errors.${fallback}`)
}

export function composerVoiceUiError(error: unknown, t: TFunction, fallback: string) {
  return error instanceof ComposerVoiceUiError
    ? error.message
    : t(`voices.errors.${fallback}`)
}
