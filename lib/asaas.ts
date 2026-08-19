const DEFAULT_ASAAS_API_URL = 'https://api.asaas.com/v3'

export type AsaasBillingType = 'PIX' | 'CREDIT_CARD'

export function isAsaasConfigured() {
  return Boolean(process.env.ASAAS_API_KEY?.trim())
}

export function getAsaasApiUrl() {
  return (process.env.ASAAS_API_URL || DEFAULT_ASAAS_API_URL).replace(/\/+$/, '')
}

function getAsaasApiKey() {
  const apiKey = process.env.ASAAS_API_KEY?.trim()
  if (!apiKey) throw new Error('ASAAS_API_KEY não configurada no servidor')
  return apiKey
}

export class AsaasApiError extends Error {
  status: number
  details: any

  constructor(message: string, status: number, details: any) {
    super(message)
    this.name = 'AsaasApiError'
    this.status = status
    this.details = details
  }
}

export async function asaasRequest<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getAsaasApiUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers: {
      accept: 'application/json',
      access_token: getAsaasApiKey(),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data?.errors?.map((error: any) => error?.description).filter(Boolean).join(' ') ||
      data?.message || `Erro ${response.status} ao comunicar com o Asaas`
    throw new AsaasApiError(message, response.status, data)
  }

  return data as T
}

export function normalizeDocument(value: unknown) {
  return String(value || '').replace(/\D/g, '')
}

export function isValidCpfCnpjLength(value: unknown) {
  const digits = normalizeDocument(value)
  return digits.length === 11 || digits.length === 14
}

export function getClientIp(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip') || undefined
}

export function asaasStatusToTopupStatus(status: unknown) {
  const normalized = String(status || '').toUpperCase()
  if (['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(normalized)) return 'paid'
  if (['REFUNDED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE'].includes(normalized)) return 'refunded'
  if (['DELETED', 'CANCELLED'].includes(normalized)) return 'cancelled'
  if (['OVERDUE'].includes(normalized)) return 'failed'
  return 'pending'
}

export function sanitizeAsaasPayment(payment: any) {
  if (!payment) return null
  return {
    id: payment.id,
    status: payment.status,
    billingType: payment.billingType,
    value: payment.value,
    netValue: payment.netValue,
    customer: payment.customer,
    externalReference: payment.externalReference,
    invoiceUrl: payment.invoiceUrl,
    confirmedDate: payment.confirmedDate,
    paymentDate: payment.paymentDate,
    creditCard: payment.creditCard ? {
      creditCardNumber: payment.creditCard.creditCardNumber,
      creditCardBrand: payment.creditCard.creditCardBrand,
    } : undefined,
  }
}

export async function findOrCreateAsaasCustomer(input: {
  composerId: string
  name: string
  email: string
  cpfCnpj: string
}) {
  const externalReference = `dcc-composer:${input.composerId}`
  const query = new URLSearchParams({ externalReference, limit: '1' })
  const existing = await asaasRequest<any>(`/customers?${query.toString()}`, { method: 'GET' })
  if (existing?.data?.[0]?.id) return existing.data[0]

  return asaasRequest<any>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      cpfCnpj: normalizeDocument(input.cpfCnpj),
      externalReference,
      notificationDisabled: true,
    }),
  })
}
