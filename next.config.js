/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['i.ytimg.com', 'i.scdn.co', 'is1-ssl.mzstatic.com'],
  },
  experimental: {
    outputFileTracingIncludes: {
      '/api/compositores/studio/stems/export': [
        './node_modules/@ffmpeg-installer/ffmpeg/**/*',
      ],
    },
  },
}

module.exports = nextConfig
