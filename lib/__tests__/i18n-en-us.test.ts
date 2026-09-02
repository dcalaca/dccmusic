import { describe, expect, it } from 'vitest'
import { translateToAmericanEnglish } from '@/lib/i18n-en-us'
import { faqsEnUs } from '@/lib/faq-en-us'

describe('localização en-US', () => {
  it('traduz os blocos públicos sem misturar português e inglês', () => {
    expect(translateToAmericanEnglish('A força do DCC Music em números')).toBe('DCC Music by the numbers')
    expect(translateToAmericanEnglish('Músicas IA entregues')).toBe('AI songs delivered')
    expect(translateToAmericanEnglish('Por que escolher a SomVibe?')).toBe('Why choose SomVibe?')
    expect(translateToAmericanEnglish('Todos os compositores')).toBe('All songwriters')
    expect(translateToAmericanEnglish('Você já possui este plano ativo.')).toBe('You already have this plan active.')
  })

  it('traduz quantidades dinâmicas do diretório', () => {
    expect(translateToAmericanEnglish('1 música publicada')).toBe('1 published song')
    expect(translateToAmericanEnglish('65 músicas publicadas')).toBe('65 published songs')
  })

  it('traduz o conteúdo dinâmico dos planos Premium', () => {
    expect(translateToAmericanEnglish('plano Mensal - Básico')).toBe('Monthly Plan - Basic')
    expect(translateToAmericanEnglish('Cadastro ilimitado de músicas')).toBe('Unlimited song publishing')
    expect(translateToAmericanEnglish('Plano já ativo')).toBe('Plan already active')
    expect(translateToAmericanEnglish('5 postagens em destaque grátis por mês')).toBe('5 free featured posts per month')
  })

  it('traduz a compra de créditos sem plural incorreto', () => {
    expect(translateToAmericanEnglish('Quantas músicas você quer comprar?')).toBe('How many songs do you want to buy?')
    expect(translateToAmericanEnglish('1 músicas')).toBe('1 song')
    expect(translateToAmericanEnglish('30 músicas')).toBe('30 songs')
    expect(translateToAmericanEnglish('Pagamento seguro via Pix ou cartão')).toBe('Secure card payment')
  })

  it('possui FAQ americano completo', () => {
    expect(faqsEnUs.length).toBeGreaterThanOrEqual(6)
    expect(faqsEnUs.flatMap((category) => category.questions).length).toBeGreaterThanOrEqual(25)
    expect(faqsEnUs[0].questions[0].question).toBe('What is DCC Music?')
  })
})
