import type { Metadata } from 'next'
import { Poppins, Inria_Sans } from 'next/font/google'
import Script from 'next/script'
import { Toaster } from 'react-hot-toast'
import { Providers } from './providers'
// AuthRedirect removed - redirect logic now handled in individual pages
import '@/styles/globals.css'

const GA_MEASUREMENT_ID = 'G-JSDJ8WLV27'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const poppinsExtended = Poppins({
  subsets: ['latin'],
  weight: ['300', '800'],
  display: 'swap',
  variable: '--font-poppins-extended',
  preload: false,
})

const inriaSans = Inria_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  display: 'swap',
  variable: '--font-inria-sans',
  preload: false,
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://www.repaircoin.ai'),
  title: 'FixFlow - Loyalty Tokens for Service Businesses',
  description: 'Earn FixFlow tokens for services and redeem them at participating businesses',
  keywords: ['loyalty', 'rewards', 'repair', 'service business', 'customer rewards'],
  icons: {
    icon: '/img/landing/fixflow-icon.png',
    shortcut: '/img/landing/fixflow-icon.png',
    apple: '/img/landing/fixflow-icon.png',
  },
  openGraph: {
    title: 'FixFlow - Loyalty Tokens for Service Businesses',
    description: 'Earn FixFlow tokens for services and redeem them at participating businesses',
    siteName: 'FixFlow',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FixFlow - Smart Loyalty for Service Businesses',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FixFlow - Loyalty Tokens for Service Businesses',
    description: 'Earn FixFlow tokens for services and redeem them at participating businesses',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inriaSans.variable} ${poppinsExtended.variable}`} suppressHydrationWarning>
      {/* Google Analytics */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
      <body className={poppins.className} suppressHydrationWarning={true}>
        <Providers>
          <Toaster
            position="top-right"
            reverseOrder={false}
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1C1C1C',
                color: '#fff',
                padding: '16px',
                borderRadius: '12px',
                fontSize: '14px',
                maxWidth: '500px',
                outline: 'none',
              },
              success: {
                iconTheme: {
                  primary: '#FFCC00',
                  secondary: '#1C1C1C',
                },
                style: {
                  background: '#1C1C1C',
                  color: '#fff',
                  border: '2px solid #FFCC00',
                  outline: 'none',
                },
              },
              error: {
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
                style: {
                  background: '#1C1C1C',
                  color: '#fff',
                  border: '2px solid #EF4444',
                  outline: 'none',
                },
                duration: 5000,
              },
              loading: {
                iconTheme: {
                  primary: '#FFCC00',
                  secondary: '#1C1C1C',
                },
                style: {
                  background: '#1C1C1C',
                  color: '#fff',
                  border: '2px solid #FFCC00',
                  outline: 'none',
                },
              },
            }}
          />
          {children}
        </Providers>
      </body>
    </html>
  )
}