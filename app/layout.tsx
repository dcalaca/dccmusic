import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import NoticeBoard from '@/components/NoticeBoard'
import ActivityHeartbeat from '@/components/ActivityHeartbeat'
import PartnerAttribution from '@/components/PartnerAttribution'
import TikTokTestPageView from '@/components/TikTokTestPageView'
import GtmPageEvents from '@/components/GtmEvents'
import LocalizationProvider from '@/components/LocalizationProvider'
import { getLocaleForCountry, normalizeCountry } from '@/lib/localization'
import { createDccI18n } from '@/i18n/i18next'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = headers()
  const country = normalizeCountry(
    requestHeaders.get('x-dcc-country') ||
    requestHeaders.get('x-vercel-ip-country') ||
    requestHeaders.get('cf-ipcountry')
  )
  const locale = getLocaleForCountry(country)
  const i18n = await createDccI18n(locale)
  const t = i18n.t.bind(i18n)
  const title = t('home.metadata.title')
  const description = t('home.metadata.description')
  const openGraphDescription = t('home.metadata.openGraphDescription')

  return {
    title: {
      default: title,
      template: '%s | DCC Music',
    },
    description,
    keywords: [
      'DCC Music',
      t('studioLanding.keywordStudio'),
      t('studioLanding.keywordAiMusic'),
      t('studioLanding.keywordCreate'),
      t('studioLanding.keywordLyrics'),
    ],
    authors: [{ name: 'DCC Music' }],
    creator: 'DCC Music',
    publisher: 'DCC Music',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL('https://www.dccmusic.online'),
    alternates: {
      canonical: '/',
    },
    openGraph: {
      type: 'website',
      locale: locale.replace('-', '_'),
      url: 'https://www.dccmusic.online',
      siteName: 'DCC Music',
      title,
      description: openGraphDescription,
      images: [
        {
          url: '/logopng.png',
          width: 880,
          height: 409,
          alt: 'DCC Music Logo',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: openGraphDescription,
      images: ['/logopng.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      // Adicione aqui códigos de verificação quando disponíveis
      // google: 'seu-codigo-google',
      // yandex: 'seu-codigo-yandex',
    },
    icons: {
      icon: { url: '/favicon-dcc-fundopreto.png', type: 'image/png' },
      apple: '/favicon-dcc-fundopreto.png',
    },
  }
}

const entityGraphSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.dccmusic.online/#organization',
      name: 'DCC Music',
      alternateName: 'DCC Music - Studio IA',
      url: 'https://www.dccmusic.online',
      logo: {
        '@type': 'ImageObject',
        '@id': 'https://www.dccmusic.online/#logo',
        url: 'https://www.dccmusic.online/dcc-music-logo.png',
        width: 1254,
        height: 1254,
      },
      image: {
        '@type': 'ImageObject',
        '@id': 'https://www.dccmusic.online/#brand-image',
        url: 'https://www.dccmusic.online/logopng.png',
        width: 880,
        height: 409,
      },
      sameAs: [
        'https://www.youtube.com/@dccmusic.online',
        'https://www.instagram.com/dccmusic.online/',
        'https://www.tiktok.com/@dccmusic.online',
        'https://www.facebook.com/profile.php?id=61571000874301',
      ],
      description: 'Plataforma brasileira para criar músicas com inteligência artificial, gerar cifras, organizar projetos e divulgar obras de compositores.',
      email: 'suporte@dccmusic.online',
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'suporte@dccmusic.online',
        contactType: 'customer support',
        availableLanguage: ['Portuguese', 'Spanish', 'English'],
      },
      areaServed: [
        { '@type': 'Country', name: 'Brazil' },
        { '@type': 'Country', name: 'Paraguay' },
        { '@type': 'Country', name: 'Colombia' },
      ],
      knowsAbout: [
        'music creation with artificial intelligence',
        'songwriting',
        'chord charts',
        'chorded lyrics',
        'independent composers',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://www.dccmusic.online/#website',
      url: 'https://www.dccmusic.online',
      name: 'DCC Music',
      description: 'Plataforma de criação musical com IA, transcrição musical, músicas, vídeos e perfis públicos de compositores.',
      publisher: { '@id': 'https://www.dccmusic.online/#organization' },
      about: { '@id': 'https://www.dccmusic.online/#organization' },
      inLanguage: ['pt-BR', 'pt-PT', 'en-US', 'en-GB', 'es-ES', 'es-MX', 'es-CO', 'es-PY'],
    },
    {
      '@type': 'WebApplication',
      '@id': 'https://www.dccmusic.online/studio-ia#application',
      name: 'DCC Studio IA',
      alternateName: 'Studio IA da DCC Music',
      url: 'https://www.dccmusic.online/studio-ia',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires a modern web browser',
      description: 'Ambiente web da DCC Music para transformar ideias e letras em projetos musicais com apoio de inteligência artificial, incluindo letra, áudio, versões, capas e publicação pública.',
      publisher: { '@id': 'https://www.dccmusic.online/#organization' },
      inLanguage: ['pt-BR', 'pt-PT', 'en-US', 'en-GB', 'es-ES', 'es-MX', 'es-CO', 'es-PY'],
      featureList: [
        'Criação de letras com IA',
        'Geração de música',
        'Versões de música',
        'Capas para projetos',
        'Projetos salvos',
        'Publicação e compartilhamento',
      ],
    },
    {
      '@type': 'Service',
      '@id': 'https://www.dccmusic.online/transcricao-musical#service',
      name: 'Cifra da Música - DCC Music',
      url: 'https://www.dccmusic.online/transcricao-musical',
      serviceType: 'Musical transcription',
      description: 'Serviço da DCC Music que organiza letras e acordes em cifras prontas para tocar e imprimir.',
      provider: { '@id': 'https://www.dccmusic.online/#organization' },
      areaServed: [
        { '@type': 'Country', name: 'Brazil' },
        { '@type': 'Country', name: 'Paraguay' },
        { '@type': 'Country', name: 'Colombia' },
      ],
    },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const country = normalizeCountry(headers().get('x-dcc-country'))
  const locale = getLocaleForCountry(country)
  return (
    <html lang={locale} data-country={country} className="dark">
      <head>
        {process.env.NODE_ENV === 'production' ? (
          <Script id="dcc-production-console" strategy="beforeInteractive">
            {`
              (function () {
                var methods = ['log', 'info', 'debug', 'warn', 'error'];
                for (var index = 0; index < methods.length; index += 1) {
                  try {
                    Object.defineProperty(window.console, methods[index], {
                      configurable: true,
                      writable: true,
                      value: function () {}
                    });
                  } catch (_) {
                    window.console[methods[index]] = function () {};
                  }
                }
              })();
            `}
          </Script>
        ) : null}
        {/* ChatGPT Ads Measurement Pixel */}
        <Script id="openai-ads-pixel" strategy="beforeInteractive">
          {`
            !function(w,d,s,u){if(w.oaiq)return;var q=function(){q.q.push(arguments)};q.q=[];w.oaiq=q;var j=d.createElement(s);j.async=1;j.src=u;var f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(j,f)}(window,document,"script","https://bzrcdn.openai.com/sdk/oaiq.min.js");
            oaiq("init",{pixelId:"7P9kR7YDnZBmFo76pXpiAq",debug:true});
          `}
        </Script>
        {/* Verificação de propriedade (sistema Carimbo) */}
        <meta name="carimbo-verificacao" content="dc3620ace28fd5285c2a3fa2" />
        <link rel="manifest" href="/manifest.json" />
        {/* Google AdSense - Deve estar no <head> */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9334585043588754"
          crossOrigin="anonymous"
        />
        {/* TikTok Pixel */}
        <Script id="tiktok-pixel" strategy="beforeInteractive">
          {`
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
              ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
              ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
              for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
              ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
              ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;
              ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
              n=d.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;
              e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
              ttq.load('D8CPURJC77U9J3L26K8G');
              ttq.page();
            }(window, document, 'ttq');
          `}
        </Script>
      </head>
      <body className={inter.className}>
        <Script
          id="dccmusic-entity-graph-jsonld"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entityGraphSchema) }}
        />
        {/* Google tag (gtag.js) — IDs ativos do Analytics e Google Ads */}
        <Script id="google-gtag-stub" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', 'G-CNBQFWQ9QT');
            gtag('config', 'AW-18367449265');
          `}
        </Script>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-CNBQFWQ9QT"
          strategy="afterInteractive"
        />
        {/* Microsoft Clarity */}
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "y5zbvxwvh2");
          `}
        </Script>
        {/* Meta Pixel */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1706895963831738');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=1706895963831738&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        <LocalizationProvider initialCountry={country}>
        <div className="min-h-screen flex flex-col bg-black text-white">
          <Header />
          <ActivityHeartbeat />
          <Suspense fallback={null}>
            <PartnerAttribution />
            <GtmPageEvents />
            <TikTokTestPageView />
          </Suspense>
          <NoticeBoard />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
        </LocalizationProvider>
      </body>
    </html>
  )
}
