import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import LayoutWrapper from '@/components/LayoutWrapper'
import AuthRedirect from '@/components/AuthRedirect'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RepairCoin - Loyalty Tokens for Repair Shops',
  description: 'Earn RepairCoin tokens for repairs and redeem them at participating shops',
  keywords: ['blockchain', 'loyalty', 'tokens', 'repair', 'cryptocurrency'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning={true}>
        <Providers>
          <AuthRedirect />
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </Providers>
      </body>
    </html>
  )
}