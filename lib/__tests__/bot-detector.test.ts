// Testes unitários para o sistema de detecção de bots
import { classifyClick, inferSource, areRelated } from '../bot-detector'

describe('Bot Detector', () => {
  describe('classifyClick', () => {
    it('deve classificar facebookexternalhit como BOT_PREVIEW', () => {
      const result = classifyClick({
        userAgent: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        referer: undefined,
        accept: '*/*',
        acceptLanguage: undefined,
        acceptEncoding: undefined,
      })
      
      expect(result.type).toBe('BOT_PREVIEW')
      expect(result.reason).toContain('facebookexternalhit')
      expect(result.confidence).toBe('high')
    })

    it('deve classificar Twitterbot como BOT_PREVIEW', () => {
      const result = classifyClick({
        userAgent: 'Twitterbot/1.0',
        referer: undefined,
        accept: '*/*',
        acceptLanguage: undefined,
        acceptEncoding: undefined,
      })
      
      expect(result.type).toBe('BOT_PREVIEW')
      expect(result.reason.toLowerCase()).toContain('twitterbot')
    })

    it('deve classificar TelegramBot como BOT_PREVIEW', () => {
      const result = classifyClick({
        userAgent: 'TelegramBot (like TwitterBot)',
        referer: undefined,
        accept: '*/*',
        acceptLanguage: undefined,
        acceptEncoding: undefined,
      })
      
      expect(result.type).toBe('BOT_PREVIEW')
    })

    it('deve classificar navegador Chrome real como HUMAN_CLICK', () => {
      const result = classifyClick({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        referer: 'https://example.com',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        acceptLanguage: 'pt-BR,pt;q=0.9,en-US;q=0.8',
        acceptEncoding: 'gzip, deflate, br',
      })
      
      expect(result.type).toBe('HUMAN_CLICK')
      expect(result.confidence).toBe('high')
    })

    it('deve classificar WhatsApp WebView como HUMAN_CLICK quando tem sinais de navegação', () => {
      const result = classifyClick({
        userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 WhatsApp/2.23.5.72',
        referer: undefined,
        accept: 'text/html,application/xhtml+xml',
        acceptLanguage: 'pt-BR,pt;q=0.9',
        acceptEncoding: 'gzip, deflate',
      })
      
      expect(result.type).toBe('HUMAN_CLICK')
      expect(result.inferredSource).toBe('WhatsApp')
    })

    it('deve classificar WhatsApp sem sinais de navegação como BOT_PREVIEW ou UNKNOWN', () => {
      const result = classifyClick({
        userAgent: 'WhatsApp/2.23.5.72',
        referer: undefined,
        accept: '*/*',
        acceptLanguage: undefined,
        acceptEncoding: undefined,
      })
      
      expect(['BOT_PREVIEW', 'UNKNOWN']).toContain(result.type)
      expect(result.inferredSource).toBe('WhatsApp')
    })

    it('deve classificar como UNKNOWN quando User-Agent está ausente', () => {
      const result = classifyClick({
        userAgent: null,
        referer: undefined,
        accept: undefined,
        acceptLanguage: undefined,
        acceptEncoding: undefined,
      })
      
      expect(result.type).toBe('UNKNOWN')
      expect(result.reason).toContain('User-Agent ausente')
    })

    it('deve classificar navegador Safari mobile como HUMAN_CLICK', () => {
      const result = classifyClick({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        referer: 'https://instagram.com',
        accept: 'text/html,application/xhtml+xml',
        acceptLanguage: 'pt-BR,pt;q=0.9',
        acceptEncoding: 'gzip, br',
      })
      
      expect(result.type).toBe('HUMAN_CLICK')
    })

    it('deve inferir origem do referrer quando disponível', () => {
      const result = classifyClick({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        referer: 'https://www.facebook.com',
        accept: 'text/html',
        acceptLanguage: 'pt-BR',
        acceptEncoding: 'gzip',
      })
      
      expect(result.inferredSource).toBe('Facebook')
    })

    it('deve inferir origem do User-Agent quando referrer não disponível', () => {
      const result = classifyClick({
        userAgent: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Instagram 123.0.0.0.0',
        referer: undefined,
        accept: 'text/html',
        acceptLanguage: 'pt-BR',
        acceptEncoding: 'gzip',
      })
      
      expect(result.inferredSource).toBe('Instagram')
    })
  })

  describe('inferSource', () => {
    it('deve inferir WhatsApp do User-Agent', () => {
      const source = inferSource('WhatsApp/2.23.5.72', undefined)
      expect(source).toBe('WhatsApp')
    })

    it('deve inferir Facebook do referrer', () => {
      const source = inferSource(undefined, 'https://www.facebook.com/somepage')
      expect(source).toBe('Facebook')
    })

    it('deve priorizar referrer sobre User-Agent', () => {
      const source = inferSource('WhatsApp/2.23.5.72', 'https://www.instagram.com')
      expect(source).toBe('Instagram')
    })

    it('deve retornar undefined quando não há sinais', () => {
      const source = inferSource('Mozilla/5.0', 'https://example.com')
      expect(source).toBeUndefined()
    })
  })

  describe('areRelated', () => {
    it('deve detectar preview seguido de clique humano do mesmo IP', () => {
      const preview = {
        ipAddress: '192.168.1.100',
        clickedAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutos atrás
        type: 'BOT_PREVIEW' as const,
      }
      
      const human = {
        ipAddress: '192.168.1.100',
        clickedAt: new Date(),
        type: 'HUMAN_CLICK' as const,
      }
      
      expect(areRelated(preview, human, 10)).toBe(true)
    })

    it('não deve relacionar cliques de IPs diferentes', () => {
      const preview = {
        ipAddress: '192.168.1.100',
        clickedAt: new Date(Date.now() - 2 * 60 * 1000),
        type: 'BOT_PREVIEW' as const,
      }
      
      const human = {
        ipAddress: '192.168.1.200',
        clickedAt: new Date(),
        type: 'HUMAN_CLICK' as const,
      }
      
      expect(areRelated(preview, human, 10)).toBe(false)
    })

    it('não deve relacionar cliques fora da janela de tempo', () => {
      const preview = {
        ipAddress: '192.168.1.100',
        clickedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutos atrás
        type: 'BOT_PREVIEW' as const,
      }
      
      const human = {
        ipAddress: '192.168.1.100',
        clickedAt: new Date(),
        type: 'HUMAN_CLICK' as const,
      }
      
      expect(areRelated(preview, human, 10)).toBe(false)
    })

    it('não deve relacionar dois cliques do mesmo tipo', () => {
      const click1 = {
        ipAddress: '192.168.1.100',
        clickedAt: new Date(Date.now() - 2 * 60 * 1000),
        type: 'HUMAN_CLICK' as const,
      }
      
      const click2 = {
        ipAddress: '192.168.1.100',
        clickedAt: new Date(),
        type: 'HUMAN_CLICK' as const,
      }
      
      expect(areRelated(click1, click2, 10)).toBe(false)
    })
  })
})
