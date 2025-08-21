import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      // ✅ Apply COOP/COEP globally (needed for SharedArrayBuffer + AudioWorklet + Superpowered)
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },

      // ✅ Ensure ffmpeg WASM is served with correct MIME
      {
        source: '/ffmpeg/:file*.wasm',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
        ],
      },
      {
        source: '/ffmpeg/:file*.worker.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
        ],
      },

      // ✅ Add the same for Superpowered if you self-host their wasm/js in /public
      {
        source: '/superpowered/:file*.wasm',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
        ],
      },
      {
        source: '/superpowered/:file*.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
        ],
      },

      // ✅ And for your mixer-processor worklet (so it serves cleanly)
      {
        source: '/mixer-processor.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
        ],
      },
    ];
  },
};

export default nextConfig;
