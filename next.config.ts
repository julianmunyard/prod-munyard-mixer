import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  async headers() {
    return [
      {
        source: '/static/ffmpeg/:path*',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Content-Type', value: 'application/javascript' },
        ],
      },
      {
        source: '/static/ffmpeg/:file*.wasm',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
        ],
      },
      {
        source: '/static/ffmpeg/:file*.worker.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
        ],
      },
    ]
  },
}

export default nextConfig
