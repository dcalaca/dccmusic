import { NextRequest, NextResponse } from 'next/server'
import { consumeMagicLoginToken, MagicLoginError } from '@/lib/email-magic-login'
import { createDccI18n } from '@/i18n'
import { getLocaleForCountry, normalizeCountry } from '@/lib/localization'

export const dynamic = 'force-dynamic'

function htmlPage(content: string, status = 200) {
  return new NextResponse(content, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

function escapeHtml(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function jsonForScript(value: any) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

async function getRequestTranslator(request: NextRequest) {
  const country = normalizeCountry(
    request.cookies.get('dcc_country')?.value ||
    request.headers.get('x-dcc-country') ||
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry')
  )
  const locale = getLocaleForCountry(country)
  const i18n = await createDccI18n(locale)
  return { t: i18n.t.bind(i18n), locale }
}

function buildSuccessHtml(
  input: Awaited<ReturnType<typeof consumeMagicLoginToken>>,
  copy: { title: string; heading: string; redirecting: string; saveError: string },
  locale: string
) {
  const authPayload = jsonForScript(input)
  const saveError = jsonForScript(copy.saveError)

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(copy.title)}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #030712; color: #f9fafb; font-family: Arial, Helvetica, sans-serif; }
      main { max-width: 520px; padding: 28px; border: 1px solid #4c1d95; border-radius: 18px; background: #050816; text-align: center; }
      p { color: #cbd5e1; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(copy.heading)}</h1>
      <p id="status">${escapeHtml(copy.redirecting)}</p>
    </main>
    <script>
      (function () {
        var payload = ${authPayload};
        var status = document.getElementById('status');

        try {
          if (payload.authType === 'composer') {
            localStorage.setItem('composer_token', payload.token);
            localStorage.setItem('composer_data', JSON.stringify(payload.user));
            localStorage.removeItem('composer_token_temp');
            window.dispatchEvent(new Event('authChange'));
          } else {
            localStorage.setItem('site_user_token', payload.token);
            localStorage.setItem('site_user_data', JSON.stringify(payload.user));
            localStorage.removeItem('site_user_token_temp');
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('authChange', { detail: { authenticated: true, user: payload.user } }));
          }

          window.location.replace(payload.redirectPath || '/');
        } catch (error) {
          status.textContent = ${saveError};
        }
      })();
    </script>
  </body>
</html>`
}

function buildErrorHtml(
  message: string,
  copy: { title: string; heading: string; fallback: string; signIn: string; createAccount: string },
  locale: string
) {
  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(copy.title)} - DCC Music</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #030712; color: #f9fafb; font-family: Arial, Helvetica, sans-serif; }
      main { max-width: 560px; padding: 28px; border: 1px solid #7f1d1d; border-radius: 18px; background: #050816; text-align: center; }
      p { color: #cbd5e1; line-height: 1.6; }
      a { color: #c084fc; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(copy.heading)}</h1>
      <p>${escapeHtml(message)}</p>
      <p>${escapeHtml(copy.fallback)}</p>
      <p><a href="/compositores/login">${escapeHtml(copy.signIn)}</a> · <a href="/compositores/cadastro">${escapeHtml(copy.createAccount)}</a></p>
    </main>
  </body>
</html>`
}

export async function GET(request: NextRequest) {
  const { t, locale } = await getRequestTranslator(request)

  try {
    const token = request.nextUrl.searchParams.get('token') || ''
    const result = await consumeMagicLoginToken(token)

    return htmlPage(buildSuccessHtml(result, {
      title: t('emailMagic.enteringTitle'),
      heading: t('emailMagic.enteringHeading'),
      redirecting: t('emailMagic.redirecting'),
      saveError: t('emailMagic.saveError'),
    }, locale))
  } catch (error: any) {
    console.error('[EMAIL MAGIC LOGIN] Erro ao autenticar:', error)
    const errorCode = error instanceof MagicLoginError ? error.code : 'invalid'
    const message = t(`emailMagic.errors.${errorCode}`, { defaultValue: t('emailMagic.errors.invalid') })

    return htmlPage(buildErrorHtml(message, {
      title: t('emailMagic.invalidTitle'),
      heading: t('emailMagic.errorHeading'),
      fallback: t('emailMagic.loginFallback'),
      signIn: t('emailMagic.signIn'),
      createAccount: t('emailMagic.createAccount'),
    }, locale), 400)
  }
}
