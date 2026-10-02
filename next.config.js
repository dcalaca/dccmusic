/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  env: {
    // Suno continua como provedor principal. O renderizador DCC entra apenas
    // quando a geração externa falhar.
    STUDIO_INTERNAL_VIDEO_PILOT: 'false',
    STUDIO_INTERNAL_VIDEO_FALLBACK: 'true',
  },
  async headers() {
    return [{
      source: '/favicon-dcc-fundopreto.png',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
    }]
  },
  images: {
    domains: ['i.ytimg.com', 'i.scdn.co', 'is1-ssl.mzstatic.com'],
  },
  experimental: {
    outputFileTracingIncludes: {
      '/blog': ['./content/blog/**/*'],
      '/blog/**/*': ['./content/blog/**/*'],
      '/api/compositores/studio/download-proxy': [
        './node_modules/@ffmpeg-installer/ffmpeg/**/*',
        './node_modules/@ffmpeg-installer/linux-x64/**/*',
      ],
      '/api/admin/playback': [
        './node_modules/@ffmpeg-installer/ffmpeg/**/*',
        './node_modules/@ffmpeg-installer/linux-x64/**/*',
      ],
      '/api/cron/studio-video-backup': [
        './node_modules/@ffmpeg-installer/ffmpeg/**/*',
        './node_modules/@ffmpeg-installer/linux-x64/**/*',
        './node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2',
      ],
      '/api/compositores/studio/video/preferencia': [
        './node_modules/@ffmpeg-installer/ffmpeg/**/*',
        './node_modules/@ffmpeg-installer/linux-x64/**/*',
        './node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2',
      ],
      '/api/studio/suno/video-callback': [
        './node_modules/@ffmpeg-installer/ffmpeg/**/*',
        './node_modules/@ffmpeg-installer/linux-x64/**/*',
        './node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2',
      ],
    },
    serverComponentsExternalPackages: [
      '@ffmpeg-installer/ffmpeg',
      '@ffmpeg-installer/linux-x64',
    ],
  },
}

module.exports = nextConfig
