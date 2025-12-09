import type { NextConfig } from 'next';

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Don't bundle FFmpeg on the server side
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@ffmpeg/ffmpeg': 'commonjs @ffmpeg/ffmpeg',
        '@ffmpeg/core': 'commonjs @ffmpeg/core',
      });
    } else {
      // Client-side: resolve FFmpeg properly
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // Disable image optimization in development to avoid localhost issues with external URLs
    unoptimized: process.env.NODE_ENV === 'development',
    // Enable image optimization in production only
    ...(process.env.NODE_ENV === 'production' && {
      formats: ['image/avif', 'image/webp'],
      deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
      imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
      minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    }),
  },
  async headers() {
    return [
      // ✅ Required for SharedArrayBuffer (needed by FFmpeg.wasm for MP3 conversion)
      // Apply to all pages to ensure SharedArrayBuffer is available everywhere
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
      // ✅ Ensure WASM files are served with correct MIME types
      {
        source: '/ffmpeg/:file*.wasm',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
        ],
      },
      {
        source: '/superpowered/:file*.wasm',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
        ],
      },
    ];
  },
};

export default nextConfig;

