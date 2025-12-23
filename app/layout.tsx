
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Munyard Mixer',
  description: 'Interactive stem player for music mixing - Play music in the background',
  keywords: 'music, audio, stem player, mixer, audio player, music player',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
return (
  <html lang="en">
    <head>
      {/* Viewport - Essential for responsive scaling on mobile */}
      {/* Updated for Chrome Android compatibility - removed maximum-scale to prevent zoom issues */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, viewport-fit=cover" />
      
      {/* Favicon */}
      <link rel="icon" type="image/x-icon" href="/munyard-icon.ico" />
      <link rel="shortcut icon" href="/munyard-icon.ico" />
      {/* PWA manifest removed to prevent install prompts */}
      {/* <link rel="manifest" href="/manifest.json" /> */}
      <meta name="theme-color" content="#FFE5E5" />
      
      {/* iOS Safari Status Bar - Match cream background */}
      {/* PWA install prompts disabled */}
      <meta name="apple-mobile-web-app-capable" content="no" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="mobile-web-app-capable" content="no" />
      <meta name="format-detection" content="telephone=no" />

      {/* iMessage / Social Link Previews */}
      <meta property="og:title" content="Munyard Mixer" />
      <meta property="og:description" content="Stem player experience by Julian Munyard." />
      <meta property="og:image" content="/og-image.png" />
      <meta property="og:url" content="https://munyardmixer.com" />
      <meta name="twitter:card" content="summary_large_image" />
      
      {/* Prevent iOS from treating this as a web page */}
      <meta name="apple-itunes-app" content="app-id=" />
      
      {/* Suppress PWA install prompts */}
      <Script id="suppress-install-prompt" strategy="beforeInteractive">
        {`
          // Prevent PWA install prompts
          window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
          });
        `}
      </Script>
      
      {/* Fix Chrome Android viewport zoom issue */}
      <Script id="chrome-android-viewport-fix" strategy="beforeInteractive">
        {`
          (function() {
            // Detect Chrome on Android
            const isChromeAndroid = /Android/.test(navigator.userAgent) && /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
            
            if (isChromeAndroid) {
              // Force correct viewport scale on Chrome Android
              const setViewportScale = function() {
                const viewport = document.querySelector('meta[name="viewport"]');
                if (viewport) {
                  const screenWidth = window.screen.width || window.innerWidth;
                  const devicePixelRatio = window.devicePixelRatio || 1;
                  const idealWidth = screenWidth / devicePixelRatio;
                  
                  // Set viewport to match actual device width
                  viewport.setAttribute('content', 
                    'width=' + idealWidth + ', initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
                  );
                }
              };
              
              // Run immediately
              setViewportScale();
              
              // Run after DOM is ready
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', setViewportScale);
              }
              
              // Run after page load
              window.addEventListener('load', setViewportScale);
              
              // Run on orientation change
              window.addEventListener('orientationchange', function() {
                setTimeout(setViewportScale, 100);
              });
              
              // Run on resize (with debounce)
              let resizeTimeout;
              window.addEventListener('resize', function() {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(setViewportScale, 100);
              });
            }
          })();
        `}
      </Script>
    </head>
    <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      {/* Fixed background div to cover iOS safe areas - color will be updated dynamically by theme */}
      <div
        id="theme-background-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#FFE5E5', /* Pink background to match OLD COMPUTER theme */
          zIndex: -1,
          pointerEvents: 'none'
        }}
      />
      {children}
    </body>
  </html>
  );
}
