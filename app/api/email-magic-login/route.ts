import { NextRequest, NextResponse } from 'next/server'
import { consumeMagicLoginToken } from '@/lib/email-magic-login'

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

function buildSuccessHtml(input: Awaited<ReturnType<typeof consumeMagicLoginToken>>) {
  const authPayload = jsonForScript(input)

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Entrando na DCC Music...</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #030712; color: #f9fafb; font-family: Arial, Helvetica, sans-serif; }
      main { max-width: 520px; padding: 28px; border: 1px solid #4c1d95; border-radius: 18px; background: #050816; text-align: center; }
      p { color: #cbd5e1; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <h1>Entrando na sua conta...</h1>
      <p id="status">Aguarde um instante. Você será redirecionado automaticamente.</p>
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
          status.textContent = 'Não foi possível salvar o login neste navegador. Tente abrir o link novamente.';
        }
      })();
    </script>
  </body>
</html>`
}

function buildErrorHtml(message: string) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Link inválido - DCC Music</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #030712; color: #f9fafb; font-family: Arial, Helvetica, sans-serif; }
      main { max-width: 560px; padding: 28px; border: 1px solid #7f1d1d; border-radius: 18px; background: #050816; text-align: center; }
      p { color: #cbd5e1; line-height: 1.6; }
      a { color: #c084fc; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <h1>Não foi possível entrar automaticamente</h1>
      <p>${escapeHtml(message)}</p>
      <p>Você ainda pode entrar normalmente pela página de login.</p>
      <p><a href="/compositores/login">Login de compositor</a> · <a href="/login">Login de usuário</a></p>
    </main>
  </body>
</html>`
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') || ''
    const result = await consumeMagicLoginToken(token)

    return htmlPage(buildSuccessHtml(result))
  } catch (error: any) {
    console.error('[EMAIL MAGIC LOGIN] Erro ao autenticar:', error)
    return htmlPage(buildErrorHtml(error?.message || 'O link está inválido ou expirado.'), 400)
  }
}
