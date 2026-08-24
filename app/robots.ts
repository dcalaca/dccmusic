import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://www.dccmusic.online'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Áreas técnicas/privadas: não têm valor para busca orgânica.
          '/admin',
          '/api/',
          '/login',
          '/minha-conta',
          '/email',
          '/compositores/admin',
          '/compositores/login',
          '/compositores/cadastro',
          '/compositores/checkout',
          '/compositores/pagamento',
          '/compositores/esqueci-senha',
          '/compositores/redefinir-senha',
          '/compositores/trocar-senha',
          '/compositores/verificar-email',
          '/compositores-cadastro',
        ],
      },
    ],
    sitemap: [`${baseUrl}/sitemap.xml`, 'https://blog.dccmusic.online/sitemap.xml'],
  }
}
