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
      '/api/admin/playback': ['./node_modules/@ffmpeg-installer/ffmpeg/**/*'],
    },
  },
}

module.exports = nextConfig
