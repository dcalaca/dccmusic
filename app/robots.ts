import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://www.dccmusic.online'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/compositores/admin/',
          '/compositores/login',
          '/compositores/cadastro',
          '/compositores/checkout',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
