import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import { asaasRequest, asaasStatusToTopupStatus, findOrCreateAsaasCustomer, getClientIp, isAsaasConfigured, isValidCpfCnpjLength, normalizeDocument, sanitizeAsaasPayment } from '@/lib/asaas'
import { getStudioTopupQuote } from '@/lib/studio-topups'
import { creditStudioTopupOnce } from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'
import { sendApprovedStudioTopupSideEffects } from '@/lib/studio-topup-side-effects'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const clean = (value: unknown, max = 255) => String(value || '').trim().slice(0, max)
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

export async function POST(request: NextRequest) {
  try {
    if (!isAsaasConfigured()) return NextResponse.json({ error: 'Asaas não configurado no servidor' }, { status: 503 })
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const topupId = clean(body.topupId, 100)
    const method = body.method === 'card' ? 'card' : 'pix'
    const customerInput = body.customer || {}
    if (!topupId) return NextResponse.json({ error: 'Recarga inválida' }, { status: 400 })
    if (!clean(customerInput.name, 120)) return NextResponse.json({ error: 'Informe o nome completo.' }, { status: 400 })
    if (!isValidCpfCnpjLength(customerInput.cpfCnpj)) return NextResponse.json({ error: 'Informe um CPF ou CNPJ válido.' }, { status: 400 })

    const { data: currentTopup, error: topupError } = await supabaseAdmin.from('studio_credit_topups').select('*').eq('id', topupId).eq('composer_id', composer.composerId).maybeSingle()
    if (topupError) throw topupError
    if (!currentTopup) return NextResponse.json({ error: 'Recarga não encontrada' }, { status: 404 })
    if (currentTopup.status === 'paid') return NextResponse.json({ success: true, status: 'paid', paymentId: currentTopup.payment_id, topupId: currentTopup.id })

    const quote = getStudioTopupQuote(Number(currentTopup.music_quantity) || 0)
    const expectedAmount = Number(quote.totalPrice)
    if (expectedAmount <= 0 || Math.abs(expectedAmount - Number(currentTopup.amount)) > 0.01) return NextResponse.json({ error: 'Valor da recarga não confere. Atualize a página.' }, { status: 400 })

    const { data: composerData } = await supabaseAdmin.from('dccmusic_composers').select('email, name').eq('id', composer.composerId).maybeSingle()
    const email = clean(customerInput.email || composerData?.email, 254)
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
    const asaasCustomer = await findOrCreateAsaasCustomer({ composerId: composer.composerId, name: clean(customerInput.name || composerData?.name, 120), email, cpfCnpj: customerInput.cpfCnpj })
    const commonPayment = { customer: asaasCustomer.id, value: expectedAmount, dueDate: today(), description: currentTopup.metadata?.package_name || `Recarga DCC Music - ${currentTopup.music_quantity} música(s)`, externalReference: currentTopup.external_reference }

    let payment: any
    let pix: any = null
    if (method === 'pix') {
      payment = await asaasRequest<any>('/payments', { method: 'POST', body: JSON.stringify({ ...commonPayment, billingType: 'PIX' }) })
      pix = await asaasRequest<any>(`/payments/${encodeURIComponent(payment.id)}/pixQrCode`, { method: 'GET' })
    } else {
      const card = body.card || {}
      const holder = body.holder || {}
      const cardNumber = normalizeDocument(card.number)
      const expiryMonth = normalizeDocument(card.expiryMonth).padStart(2, '0')
      const rawYear = normalizeDocument(card.expiryYear)
      const expiryYear = rawYear.length === 2 ? `20${rawYear}` : rawYear
      const ccv = normalizeDocument(card.ccv)
      const postalCode = normalizeDocument(holder.postalCode)
      const addressNumber = clean(holder.addressNumber, 20)
      if (cardNumber.length < 13 || cardNumber.length > 19 || ccv.length < 3 || ccv.length > 4) return NextResponse.json({ error: 'Confira os dados do cartão.' }, { status: 400 })
      if (expiryMonth.length !== 2 || expiryYear.length !== 4) return NextResponse.json({ error: 'Informe a validade do cartão.' }, { status: 400 })
      if (postalCode.length !== 8 || !addressNumber) return NextResponse.json({ error: 'Informe CEP e número do endereço do titular.' }, { status: 400 })
      payment = await asaasRequest<any>('/payments', { method: 'POST', body: JSON.stringify({
        ...commonPayment,
        billingType: 'CREDIT_CARD',
        creditCard: { holderName: clean(card.holderName || customerInput.name, 120), number: cardNumber, expiryMonth, expiryYear, ccv },
        creditCardHolderInfo: { name: clean(customerInput.name, 120), email, cpfCnpj: normalizeDocument(customerInput.cpfCnpj), postalCode, addressNumber, addressComplement: clean(holder.addressComplement, 100) || undefined, mobilePhone: normalizeDocument(holder.mobilePhone) || undefined },
        remoteIp: getClientIp(request.headers),
      }) })
    }

    const paymentId = String(payment.id || '')
    const topupStatus = asaasStatusToTopupStatus(payment.status)
    if (topupStatus === 'paid') {
      const creditResult = await creditStudioTopupOnce({ topup: currentTopup, paymentId, paymentData: sanitizeAsaasPayment(payment), provider: 'asaas', metadata: { asaasCustomerId: asaasCustomer.id, checkout_type: 'asaas_embedded' } })
      if (creditResult.credited) await sendApprovedStudioTopupSideEffects(request, creditResult.topup, paymentId)
      return NextResponse.json({ success: true, status: 'paid', paymentId, topupId: currentTopup.id })
    }

    const safePayment = sanitizeAsaasPayment(payment)
    await supabaseAdmin.from('studio_credit_topups').update({ status: topupStatus, payment_id: paymentId, payment_gateway: 'asaas', metadata: { ...(currentTopup.metadata || {}), asaas_customer_id: asaasCustomer.id, asaas_payment: safePayment, checkout_type: 'asaas_embedded' }, updated_at: new Date().toISOString() }).eq('id', currentTopup.id)
    return NextResponse.json({ success: true, status: topupStatus, pending: topupStatus === 'pending', paymentId, topupId: currentTopup.id, pix: pix ? { encodedImage: pix.encodedImage, payload: pix.payload, expirationDate: pix.expirationDate } : null })
  } catch (error: any) {
    console.error('[Studio IA] Erro ao processar pagamento Asaas:', { name: error?.name, message: error?.message, status: error?.status })
    return NextResponse.json({ error: error?.message || 'Erro ao processar pagamento no Asaas' }, { status: error?.status || 500 })
  }
}
