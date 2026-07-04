import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
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

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: {
    default: 'DCC Music - Hub Oficial do Artista | Músicas e Vídeos',
    template: '%s | DCC Music',
  },
  description: 'Hub oficial do DCC Music. Assista aos vídeos e ouça as músicas. Explore os últimos lançamentos e descubra os trabalhos. Plataforma completa para compositores e fãs de música.',
  keywords: [
    'DCC Music',
    'música brasileira',
    'vídeos musicais',
    'artista independente',
    'compositor',
    'YouTube música',
    'Spotify',
    'Apple Music',
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
    title: 'DCC Music - Hub Oficial do Artista',
    description: 'Hub oficial do DCC Music. Assista aos vídeos e ouça as músicas. Explore os últimos lançamentos.',
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
    title: 'DCC Music - Hub Oficial do Artista',
    description: 'Hub oficial do DCC Music. Assista aos vídeos e ouça as músicas.',
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

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'DCC Music',
  url: 'https://www.dccmusic.online',
  logo: {
    '@type': 'ImageObject',
    url: 'https://www.dccmusic.online/logopng.png',
    width: 1200,
    height: 630,
  },
  image: 'https://www.dccmusic.online/logopng.png',
  description: 'Hub oficial do DCC Music. Plataforma completa para descobrir músicas e vídeos de compositores talentosos.',
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'suporte@dccmusic.online',
    contactType: 'Suporte',
  },
  sameAs: [
    // Adicione aqui links das redes sociais quando disponíveis
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon-dcc-fundopreto.png" type="image/png" sizes="48x48" />
        <link rel="icon" href="/favicon-dcc-fundopreto.png" type="image/png" sizes="96x96" />
        <link rel="icon" href="/favicon-dcc-fundopreto.png" type="image/png" sizes="192x192" />
        <link rel="shortcut icon" href="/favicon-dcc-fundopreto.png" type="image/png" />
        <link rel="apple-touch-icon" href="/favicon-dcc-fundopreto.png" sizes="180x180" />
        {/* Google Tag Manager */}
        <Script id="google-tag-manager" strategy="beforeInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-5RL7VC34');
          `}
        </Script>
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
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-5RL7VC34"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <Script
          id="dccmusic-organization-jsonld"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {/* Google tag (gtag.js) — GA4 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-CNBQFWQ9QT"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-CNBQFWQ9QT');
            gtag('config', 'AW-16698092699');
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
      </body>
    </html>
  )
}
