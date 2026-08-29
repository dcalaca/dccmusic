/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: {
    domains: ['i.ytimg.com', 'i.scdn.co', 'is1-ssl.mzstatic.com'],
  },
  experimental: {
    outputFileTracingIncludes: {
      '/blog': ['./content/blog/**/*'],
      '/blog/**/*': ['./content/blog/**/*'],
      '/api/admin/playback': [
        './node_modules/@ffmpeg-installer/ffmpeg/**/*',
        './node_modules/@ffmpeg-installer/linux-x64/**/*',
      ],
      '/api/cron/studio-video-backup': [
        './node_modules/@ffmpeg-installer/ffmpeg/**/*',
        './node_modules/@ffmpeg-installer/linux-x64/**/*',
      ],
      '/api/compositores/studio/video/preferencia': [
        './node_modules/@ffmpeg-installer/ffmpeg/**/*',
        './node_modules/@ffmpeg-installer/linux-x64/**/*',
      ],
    },
    serverComponentsExternalPackages: [
      '@ffmpeg-installer/ffmpeg',
      '@ffmpeg-installer/linux-x64',
    ],
  },
}

module.exports = nextConfig
