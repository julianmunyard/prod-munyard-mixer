import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  ...(isProd && {
    async headers() {
      return [
        // 🔒 Required for FFmpeg to work with WebAssembly threading
        {
          source: '/ffmpeg/:path*',
          headers: [
            { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
            { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          ],
        },
        // ✅ Set proper MIME type for WASM
        {
          source: '/ffmpeg/(.*)\\.wasm',
          headers: [
            { key: 'Content-Type', value: 'application/wasm' },
          ],
        },
        // ✅ Set MIME for worker
        {
          source: '/ffmpeg/(.*)\\.worker\\.js',
          headers: [
            { key: 'Content-Type', value: 'application/javascript' },
          ],
        },
        // ✅ JS files fallback
        {
          source: '/ffmpeg/(.*)\\.js',
          headers: [
            { key: 'Content-Type', value: 'application/javascript' },
          ],
        },
      ];
    },
  }),
};

export default nextConfig;
