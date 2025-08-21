import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { Providers } from './providers'
import LayoutWrapper from '@/components/LayoutWrapper'
import AuthRedirect from '@/components/AuthRedirect'
import '@/styles/globals.css'

const poppins = Poppins({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'RepairCoin - Loyalty Tokens for Repair Shops',
  description: 'Earn RepairCoin tokens for repairs and redeem them at participating shops',
  keywords: ['blockchain', 'loyalty', 'tokens', 'repair', 'cryptocurrency'],
  icons: {
    icon: '/img/favicon-logo.png',
    shortcut: '/img/favicon-logo.png',
    apple: '/img/favicon-logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={poppins.className} suppressHydrationWarning={true}>
        <Providers>
          <Toaster 
            position="top-right"
            reverseOrder={false}
            toastOptions={{
              duration: 4000,
              success: {
                iconTheme: {
                  primary: '#FFCC00',
                  secondary: '#1C1C1C',
                },
              },
              error: {
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
            }}
          />
          <AuthRedirect />
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </Providers>
      </body>
    </html>
  )
}