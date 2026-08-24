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

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: {
    default: 'DCC Music - Studio IA, Partitura e Cifra | Músicas e Vídeos',
    template: '%s | DCC Music',
  },
  description: 'Crie músicas com IA no Studio IA, gere partitura, cifra e MusicXML, ouça lançamentos e divulgue seu trabalho. Plataforma completa para compositores e fãs de música no Brasil.',
  keywords: [
    'DCC Music',
    'Studio IA',
    'música com inteligência artificial',
    'partitura e cifra',
    'transcrição musical',
    'MusicXML',
    'letra cifrada',
    'música brasileira',
    'vídeos musicais',
    'artista independente',
    'compositor',
    'criar música com IA',
    'plataforma musical',
    'música online',
    'clipes musicais',
    'lançamentos musicais',
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
    locale: 'pt_BR',
    url: 'https://www.dccmusic.online',
    siteName: 'DCC Music',
    title: 'DCC Music - Studio IA, Partitura e Cifra',
    description: 'Crie músicas com IA, gere partitura e cifra, ouça lançamentos e divulgue seu trabalho na plataforma DCC Music.',
    images: [
      {
        url: '/logopng.png',
        width: 1200,
        height: 630,
        alt: 'DCC Music Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DCC Music - Studio IA, Partitura e Cifra',
    description: 'Crie músicas com IA, gere partitura e cifra e explore lançamentos no DCC Music.',
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
    icon: [
      { url: '/favicon-dcc-fundopreto.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-dcc-fundopreto.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon-dcc-fundopreto.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon-dcc-fundopreto.png',
    apple: '/favicon-dcc-fundopreto.png',
  },
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
        url: 'https://www.dccmusic.online/logopng.png',
        width: 1200,
        height: 630,
      },
      image: { '@id': 'https://www.dccmusic.online/#logo' },
      description: 'Plataforma brasileira para criar músicas com inteligência artificial, gerar partitura, MusicXML e letra cifrada, organizar projetos e divulgar obras de compositores.',
      email: 'suporte@dccmusic.online',
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'suporte@dccmusic.online',
        contactType: 'customer support',
        availableLanguage: ['Portuguese', 'Spanish'],
      },
      areaServed: [
        { '@type': 'Country', name: 'Brazil' },
        { '@type': 'Country', name: 'Paraguay' },
        { '@type': 'Country', name: 'Colombia' },
      ],
      knowsAbout: [
        'music creation with artificial intelligence',
        'songwriting',
        'musical transcription',
        'sheet music',
        'MusicXML',
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
      inLanguage: ['pt-BR', 'es-PY', 'es-CO'],
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
      inLanguage: ['pt-BR', 'es-PY', 'es-CO'],
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
      name: 'Partitura e Cifra - DCC Music',
      url: 'https://www.dccmusic.online/transcricao-musical',
      serviceType: 'Musical transcription',
      description: 'Serviço da DCC Music que transforma áudio compatível em materiais musicais como partitura em PDF, MusicXML e letra cifrada, com metadados musicais quando disponíveis.',
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
        <link rel="icon" href="/favicon-dcc-fundopreto.png" type="image/png" sizes="48x48" />
        <link rel="icon" href="/favicon-dcc-fundopreto.png" type="image/png" sizes="96x96" />
        <link rel="icon" href="/favicon-dcc-fundopreto.png" type="image/png" sizes="192x192" />
        <link rel="shortcut icon" href="/favicon-dcc-fundopreto.png" type="image/png" />
        <link rel="apple-touch-icon" href="/favicon-dcc-fundopreto.png" sizes="180x180" />
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
