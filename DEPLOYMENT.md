# 🚀 Vercel Deployment Guide

## Environment Variables

Create a `.env.local` file in your project root with:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Superpowered License Key
NEXT_PUBLIC_SUPERPOWERED_LICENSE=your_superpowered_license_key_here
```

## Vercel Configuration

Your `next.config.ts` is already properly configured with:
- ✅ COOP/COEP headers for SharedArrayBuffer support
- ✅ Correct MIME types for WASM files
- ✅ Proper headers for Superpowered and FFmpeg files

## Deployment Steps

1. **Push to GitHub** (if not already done)
2. **Connect to Vercel**
3. **Set Environment Variables in Vercel Dashboard**
4. **Deploy**

## Important Notes

- Your project uses Superpowered WASM files that need proper MIME types
- AudioWorklet requires COOP/COEP headers (already configured)
- The build process copies worklet files to public directory
- All static assets (WASM, JS) are served from `/public`

## Build Process

The build script automatically:
1. Copies worklet files to public directory
2. Builds Next.js application
3. Optimizes for production

## Testing After Deployment

1. Check that WASM files load correctly
2. Test audio playback functionality
3. Verify all mixer controls work
4. Test on mobile devices
