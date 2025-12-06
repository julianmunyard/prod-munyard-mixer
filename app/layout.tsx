
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
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      
      {/* Favicon & PWA */}
      <link rel="icon" type="image/x-icon" href="/munyard-icon.ico" />
      <link rel="shortcut icon" href="/munyard-icon.ico" />
      <link rel="manifest" href="/manifest.json" />
      <meta name="theme-color" content="#FCFAEE" />
      
      {/* iOS Safari Status Bar - Match cream background */}
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="format-detection" content="telephone=no" />

      {/* iMessage / Social Link Previews */}
      <meta property="og:title" content="Munyard Mixer" />
      <meta property="og:description" content="Stem player experience by Julian Munyard." />
      <meta property="og:image" content="/og-image.png" />
      <meta property="og:url" content="https://munyardmixer.com" />
      <meta name="twitter:card" content="summary_large_image" />
      
      {/* Prevent iOS from treating this as a web page */}
      <meta name="apple-itunes-app" content="app-id=" />
      
    </head>
    <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      {/* Fixed background div to cover iOS safe areas */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#FCFAEE',
          zIndex: -1,
          pointerEvents: 'none'
        }}
      />
      {children}
    </body>
  </html>
  );
}
