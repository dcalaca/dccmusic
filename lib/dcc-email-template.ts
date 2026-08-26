export type DccEmailTemplateInput = {
  title: string
  subject: string
  preview?: string | null
  contentHtml: string
  headerLabel?: string
}

export function escapeEmailHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function dccEmailButton(label: string, href: string) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
      <tr>
        <td align="center" style="background:#8018F5;background-image:linear-gradient(90deg,#6F00F5 0%,#A92CE9 100%);border-radius:10px;">
          <a href="${escapeEmailHtml(href)}" style="display:block;padding:15px 22px;font-size:16px;font-weight:800;color:#FFFFFF;text-decoration:none;">
            ${escapeEmailHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `
}

export function buildDccEmailHtml(input: DccEmailTemplateInput) {
  const preview = escapeEmailHtml(input.preview || input.subject)
  const title = escapeEmailHtml(input.title)
  const headerLabel = escapeEmailHtml(input.headerLabel || 'Studio IA')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeEmailHtml(input.subject)}</title>
  <style>
    @media only screen and (max-width:600px){
      .container{width:100%!important;}
      .px{padding-left:22px!important;padding-right:22px!important;}
      h1{font-size:27px!important;line-height:1.16!important;}
      .email-shell{padding:12px 8px!important;}
    }
    a{color:#7C16F8;}
  </style>
</head>
<body style="margin:0;padding:0;background:#09070F;-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;color:#09070F;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preview}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#09070F;">
    <tr>
      <td class="email-shell" align="center" style="padding:24px 12px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid #2A2440;border-radius:16px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <tr>
            <td style="height:5px;background:#7C16F8;background-image:linear-gradient(90deg,#7C16F8 0%,#EC4BC4 52%,#4F9DFF 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="px" style="padding:12px 32px;background:#0B0A11;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <img src="https://www.dccmusic.online/dcc-music-logo.png" width="52" height="52" alt="DCC Music" style="display:block;width:52px;height:52px;border:0;border-radius:50%;">
                  </td>
                  <td align="right" style="font-size:12px;color:#B8B2C2;">${headerLabel}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding:30px 32px 10px;background:#FFFFFF;">
              <h1 style="margin:0;font-size:31px;line-height:1.16;color:#17121F;font-weight:800;letter-spacing:-.02em;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding:4px 32px 30px;background:#FFFFFF;color:#5E5868;font-size:15px;line-height:1.65;">
              ${input.contentHtml}
            </td>
          </tr>
          <tr>
            <td style="background:#0B0A11;padding:24px 32px;border-top:1px solid #252130;">
              <p style="margin:0 0 15px;padding-left:12px;border-left:3px solid #C6F135;font-size:13px;line-height:1.6;color:#D6D2DF;">
                A DCC Music transforma ideias e histórias em músicas com inteligência artificial.
              </p>
              <p style="margin:0 0 11px;font-size:12px;line-height:1.6;color:#817C8E;">
                Precisa de ajuda? <a href="mailto:suporte@dccmusic.online" style="color:#AFA9BE;text-decoration:underline;">suporte@dccmusic.online</a>
              </p>
              <p style="margin:0;font-size:11px;line-height:1.7;color:#686373;">
                <a href="https://www.dccmusic.online/" style="color:#918B9E;text-decoration:underline;">Site</a>
                &nbsp;·&nbsp;
                <a href="https://www.dccmusic.online/studio-ia" style="color:#918B9E;text-decoration:underline;">Studio IA</a>
                &nbsp;·&nbsp;
                <a href="https://blog.dccmusic.online/" style="color:#918B9E;text-decoration:underline;">Blog</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
