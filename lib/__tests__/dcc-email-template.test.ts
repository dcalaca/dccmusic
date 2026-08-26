import { describe, expect, it } from 'vitest'
import { buildDccEmailHtml, dccEmailButton } from '../dcc-email-template'

describe('DCC email template', () => {
  it('renders the approved brand structure', () => {
    const html = buildDccEmailHtml({
      subject: 'Assunto de teste',
      title: 'Título de teste',
      preview: 'Prévia de teste',
      contentHtml: '<p>Conteúdo</p>',
    })

    expect(html).toContain('https://www.dccmusic.online/dcc-music-logo.png')
    expect(html).toContain('background:#0B0A11')
    expect(html).toContain('background:#FFFFFF')
    expect(html).toContain('border-left:3px solid #C6F135')
    expect(html).toContain('Título de teste')
    expect(html).toContain('<p>Conteúdo</p>')
  })

  it('escapes dynamic button values', () => {
    const html = dccEmailButton('Criar <agora>', 'https://example.com/?a=1&b=2')

    expect(html).toContain('Criar &lt;agora&gt;')
    expect(html).toContain('a=1&amp;b=2')
  })
})
