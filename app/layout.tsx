
import { Geist, Geist_Mono } from "next/font/google";
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
  description: 'stem player.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
return (
  <html lang="en">
    <head>
      {/* Favicon & PWA */}
      <link rel="icon" type="image/x-icon" href="/munyard-icon.ico" />
      <link rel="shortcut icon" href="/munyard-icon.ico" />
      <link rel="manifest" href="/manifest.json" />
      <meta name="theme-color" content="#FCFAEE" />

      {/* iMessage / Social Link Previews */}
      <meta property="og:title" content="Munyard Mixer" />
      <meta property="og:description" content="Stem player experience by Julian Munyard." />
      <meta property="og:image" content="/og-image.png" />
      <meta property="og:url" content="https://munyardmixer.com" />
      <meta name="twitter:card" content="summary_large_image" />
    </head>
    <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      {children}
    </body>
  </html>
  );
}
