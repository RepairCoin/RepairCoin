import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { Providers } from './providers'
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
              style: {
                background: '#1C1C1C',
                color: '#fff',
                padding: '16px',
                borderRadius: '12px',
                fontSize: '14px',
                maxWidth: '500px',
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
                },
              },
            }}
          />
          <AuthRedirect />
          {children}
        </Providers>
      </body>
    </html>
  )
}