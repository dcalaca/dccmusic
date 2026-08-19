import { describe, expect, it } from 'vitest'
import { asaasStatusToTopupStatus, isValidCpfCnpjLength, normalizeDocument } from '../asaas'

describe('Asaas helpers', () => {
  it('normaliza documentos sem manter caracteres', () => {
    expect(normalizeDocument('123.456.789-01')).toBe('12345678901')
  })

  it('aceita somente comprimentos de CPF e CNPJ', () => {
    expect(isValidCpfCnpjLength('123.456.789-01')).toBe(true)
    expect(isValidCpfCnpjLength('12.345.678/0001-90')).toBe(true)
    expect(isValidCpfCnpjLength('123')).toBe(false)
  })

  it('mapeia os estados que liberam, aguardam e estornam crédito', () => {
    expect(asaasStatusToTopupStatus('CONFIRMED')).toBe('paid')
    expect(asaasStatusToTopupStatus('RECEIVED')).toBe('paid')
    expect(asaasStatusToTopupStatus('PENDING')).toBe('pending')
    expect(asaasStatusToTopupStatus('REFUNDED')).toBe('refunded')
  })
})
