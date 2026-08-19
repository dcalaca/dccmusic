'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { FiCheckCircle, FiX } from 'react-icons/fi'
import { getMercadoPagoPublicKey, isMercadoPagoInSiteCheckoutEnabled } from '@/lib/mp-in-site-checkout'

const MP_SCRIPT_SRC = 'https://sdk.mercadopago.com/js/v2'

function loadMercadoPagoScript() {
  if (typeof window === 'undefined') return Promise.resolve()
  if ((window as any).MercadoPago) return Promise.resolve()

  const existing = document.querySelector(`script[src="${MP_SCRIPT_SRC}"]`) as HTMLScriptElement | null
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      if ((window as any).MercadoPago) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Não foi possível carregar o Mercado Pago')), { once: true })
    })
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = MP_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Não foi possível carregar o Mercado Pago'))
    document.body.appendChild(script)
  })
}

type PixInfo = {
  qrCode?: string | null
  qrCodeBase64?: string | null
  ticketUrl?: string | null
  paymentId?: string | null
}

async function copyText(text: string) {
  if (!text) return false

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Celular em HTTP (ex.: 192.168.x.x) não tem clipboard seguro.
  }

  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.left = '0'
  field.style.top = '0'
  field.style.opacity = '0'
  document.body.appendChild(field)
  field.focus()
  field.select()
  field.setSelectionRange(0, text.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  } finally {
    document.body.removeChild(field)
  }
  return ok
}

export function MercadoPagoPaymentBrick({
  amount,
  email,
  onSubmitPayment,
  onCheckStatus,
  onPaid,
}: {
  amount: number
  email?: string | null
  onSubmitPayment: (formData: any) => Promise<any>
  onCheckStatus?: (paymentId?: string | null) => Promise<any>
  onPaid: (result: any) => void
}) {
  const reactId = useId().replace(/:/g, '')
  const containerId = `mp-payment-${reactId}`
  const controllerRef = useRef<{ unmount?: () => void } | null>(null)
  const onPaidRef = useRef(onPaid)
  const onCheckStatusRef = useRef(onCheckStatus)
  const [error, setError] = useState('')
  const [pix, setPix] = useState<PixInfo | null>(null)
  const [paid, setPaid] = useState(false)
  const [pixCopied, setPixCopied] = useState(false)
  const [checkingPayment, setCheckingPayment] = useState(false)

  onPaidRef.current = onPaid
  onCheckStatusRef.current = onCheckStatus

  useEffect(() => {
    let cancelled = false
    const publicKey = getMercadoPagoPublicKey()
    if (!publicKey || !amount || pix || paid) return

    ;(async () => {
      try {
        await loadMercadoPagoScript()
        if (cancelled || !(window as any).MercadoPago) return

        const mp = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' })
        const bricksBuilder = mp.bricks()
        controllerRef.current = await bricksBuilder.create('payment', containerId, {
          initialization: {
            amount,
            payer: email ? { email } : undefined,
          },
          customization: {
            visual: {
              style: { theme: 'dark' },
            },
            paymentMethods: {
              creditCard: 'all',
              debitCard: 'all',
              prepaidCard: 'all',
              bankTransfer: 'all',
              maxInstallments: 12,
            },
          },
          callbacks: {
            onReady: () => {},
            onError: (brickError: any) => {
              console.error('[MP Payment Brick]', brickError)
            },
            onSubmit: ({ formData }: { formData: any }) => {
              return new Promise<void>((resolve, reject) => {
                onSubmitPayment(formData)
                  .then((result) => {
                    if (result?.status === 'paid' || result?.status === 'approved') {
                      setPaid(true)
                      onPaidRef.current(result)
                      resolve()
                      return
                    }

                    const pixData = result?.payment?.point_of_interaction?.transaction_data
                    if (pixData?.qr_code || pixData?.qr_code_base64) {
                      setPix({
                        qrCode: pixData.qr_code,
                        qrCodeBase64: pixData.qr_code_base64,
                        ticketUrl: pixData.ticket_url,
                        paymentId: result?.paymentId || result?.payment?.id || null,
                      })
                      resolve()
                      return
                    }

                    if (result?.pending) {
                      resolve()
                      return
                    }

                    reject(new Error(result?.error || 'Não foi possível concluir o pagamento.'))
                  })
                  .catch((submitError) => reject(submitError))
              })
            },
          },
        })
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Não foi possível abrir o pagamento no site.')
      }
    })()

    return () => {
      cancelled = true
      controllerRef.current?.unmount?.()
      controllerRef.current = null
    }
  }, [amount, containerId, email, paid, pix])

  useEffect(() => {
    if (!pix || paid) return

    let cancelled = false
    let inFlight = false

    const checkStatus = async () => {
      if (cancelled || inFlight || !onCheckStatusRef.current) return
      inFlight = true
      setCheckingPayment(true)
      try {
        const result = await onCheckStatusRef.current(pix.paymentId)
        if (cancelled) return
        if (result?.status === 'paid' || result?.status === 'approved') {
          setPaid(true)
          onPaidRef.current(result)
        }
      } catch {
        // Continua tentando até o Mercado Pago confirmar.
      } finally {
        inFlight = false
        if (!cancelled) setCheckingPayment(false)
      }
    }

    void checkStatus()
    const interval = window.setInterval(checkStatus, 3000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkStatus()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [paid, pix])

  if (paid) {
    return (
      <div className="py-6 text-center">
        <FiCheckCircle className="mx-auto mb-3 h-10 w-10 text-green-400" />
        <p className="font-bold text-white">Pagamento aprovado</p>
      </div>
    )
  }

  if (pix) {
    return (
      <div className="space-y-3 text-center">
        <p className="font-bold text-white">Pague com Pix neste celular</p>
        <p className="text-sm text-gray-300">
          Copie o código, pague no banco e volte aqui. Quando o Mercado Pago confirmar, esta tela vai sozinha para o sucesso.
        </p>
        {pix.qrCodeBase64 ? (
          <img
            src={`data:image/png;base64,${pix.qrCodeBase64}`}
            alt="QR Code Pix"
            className="mx-auto w-52 rounded-xl bg-white p-2"
          />
        ) : null}
        {pix.qrCode ? (
          <button
            type="button"
            onClick={async () => {
              const ok = await copyText(pix.qrCode || '')
              if (!ok) {
                setError('Não deu para copiar sozinho. Segure o código abaixo e toque em Copiar.')
                return
              }
              setError('')
              setPixCopied(true)
              window.setTimeout(() => setPixCopied(false), 2500)
            }}
            className="w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-bold text-white"
          >
            {pixCopied ? 'Código copiado!' : 'Copiar código Pix'}
          </button>
        ) : null}
        {pix.qrCode ? (
          <textarea
            readOnly
            value={pix.qrCode}
            onFocus={(event) => event.currentTarget.select()}
            className="h-20 w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-200"
            aria-label="Código Pix"
          />
        ) : null}
        {pix.ticketUrl ? (
          <a href={pix.ticketUrl} target="_blank" rel="noreferrer" className="block text-sm text-primary-300">
            Abrir Pix no banco
          </a>
        ) : null}
        <p className="text-sm text-primary-200">
          {checkingPayment
            ? 'Conferindo se o Mercado Pago já reconheceu o pagamento...'
            : 'Assim que o pagamento for reconhecido, você vai para a tela de recarga com sucesso.'}
        </p>
        <button
          type="button"
          onClick={async () => {
            if (!onCheckStatusRef.current) return
            setCheckingPayment(true)
            try {
              const result = await onCheckStatusRef.current(pix.paymentId)
              if (result?.status === 'paid' || result?.status === 'approved') {
                setPaid(true)
                onPaidRef.current(result)
                return
              }
              setError('')
            } catch (err: any) {
              setError(err.message || 'Ainda não deu para confirmar. Tente de novo em alguns segundos.')
            } finally {
              setCheckingPayment(false)
            }
          }}
          className="w-full rounded-lg border border-gray-600 px-4 py-3 text-sm font-bold text-white"
        >
          Já paguei — conferir agora
        </button>
        {error ? <p className="text-center text-sm text-red-300">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-gray-300">Pague com Pix ou cartão, sem sair do DCC Music.</p>
      <div id={containerId} className="min-h-[120px]" />
      {error ? <p className="text-center text-sm text-red-300">{error}</p> : null}
    </div>
  )
}

export function MercadoPagoPaymentOverlay({
  amount,
  email,
  onSubmitPayment,
  onCheckStatus,
  onPaid,
  onClose,
  onUseFallback,
}: {
  amount: number
  email?: string | null
  onSubmitPayment: (formData: any) => Promise<any>
  onCheckStatus?: (paymentId?: string | null) => Promise<any>
  onPaid: (result: any) => void
  onClose: () => void
  onUseFallback?: () => void | Promise<void>
}) {
  const [fallbackLoading, setFallbackLoading] = useState(false)
  const [fallbackError, setFallbackError] = useState('')

  const useFallback = async () => {
    if (!onUseFallback || fallbackLoading) return
    try {
      setFallbackLoading(true)
      setFallbackError('')
      await onUseFallback()
    } catch (error: any) {
      setFallbackError(error?.message || 'Pagamento alternativo indisponível.')
    } finally {
      setFallbackLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4">
      <div className="relative max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-gray-700 bg-gray-900 p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
          title="Fechar"
        >
          <FiX className="h-5 w-5" />
        </button>
        <h2 className="mb-4 pr-8 text-xl font-black text-white">Pagamento</h2>
        <MercadoPagoPaymentBrick
          amount={amount}
          email={email}
          onSubmitPayment={onSubmitPayment}
          onCheckStatus={onCheckStatus}
          onPaid={onPaid}
        />
        {onUseFallback ? (
          <button
            type="button"
            onClick={() => void useFallback()}
            disabled={fallbackLoading}
            className="mt-4 w-full rounded-xl border border-gray-600 px-4 py-3 text-sm font-bold text-gray-200 hover:border-primary-400 hover:text-white"
          >
            {fallbackLoading ? 'Abrindo Stripe...' : 'Usar pagamento alternativo (Stripe)'}
          </button>
        ) : null}
        {fallbackError ? <p className="mt-2 text-center text-sm text-red-300">{fallbackError}</p> : null}
      </div>
    </div>
  )
}

export function MercadoPagoWalletBrick({
  preferenceId,
  initPoint,
}: {
  preferenceId: string
  initPoint?: string | null
}) {
  const reactId = useId().replace(/:/g, '')
  const containerId = `mp-wallet-${reactId}`
  const controllerRef = useRef<{ unmount?: () => void } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const publicKey = getMercadoPagoPublicKey()
    if (!publicKey || !preferenceId) return

    ;(async () => {
      try {
        await loadMercadoPagoScript()
        if (cancelled || !(window as any).MercadoPago) return

        const mp = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' })
        const bricksBuilder = mp.bricks()
        controllerRef.current = await bricksBuilder.create('wallet', containerId, {
          initialization: {
            preferenceId,
            redirectMode: 'modal',
          },
          customization: {
            theme: 'dark',
            texts: {
              valueProp: 'smart_option',
            },
          },
        })
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Não foi possível abrir o pagamento no site.')
      }
    })()

    return () => {
      cancelled = true
      controllerRef.current?.unmount?.()
      controllerRef.current = null
    }
  }, [containerId, preferenceId])

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-gray-300">Pague aqui mesmo, sem sair do DCC Music.</p>
      <div id={containerId} className="min-h-[52px]" />
      {error ? (
        <div className="space-y-2 text-center">
          <p className="text-sm text-red-300">{error}</p>
          {initPoint ? (
            <a
              href={initPoint}
              className="inline-flex rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700"
            >
              Continuar no Mercado Pago
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function useMercadoPagoCheckout() {
  const [session, setSession] = useState<{ preferenceId: string; initPoint: string | null } | null>(null)

  const startCheckout = (input: { preferenceId?: string | null; initPoint?: string | null }) => {
    const initPoint = input.initPoint || null
    if (isMercadoPagoInSiteCheckoutEnabled() && input.preferenceId) {
      setSession({ preferenceId: input.preferenceId, initPoint })
      return
    }
    if (!initPoint) {
      throw new Error('Mercado Pago não retornou o link de pagamento.')
    }
    window.location.href = initPoint
  }

  const checkoutUi = session ? (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <button
          type="button"
          onClick={() => setSession(null)}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
          title="Fechar"
        >
          <FiX className="h-5 w-5" />
        </button>
        <h2 className="mb-4 pr-8 text-xl font-black text-white">Pagamento</h2>
        <MercadoPagoWalletBrick preferenceId={session.preferenceId} initPoint={session.initPoint} />
      </div>
    </div>
  ) : null

  return { startCheckout, checkoutUi, inSite: isMercadoPagoInSiteCheckoutEnabled() }
}
