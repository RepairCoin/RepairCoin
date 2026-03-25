import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Join the RepairCoin Waitlist',
  description:
    'RepairCoin helps service businesses grow with a built-in marketplace, booking system, and rewards that turn first-time visitors into repeat customers.',
  openGraph: {
    title: 'Join the RepairCoin Waitlist',
    description:
      'RepairCoin helps service businesses grow with a built-in marketplace, booking system, and rewards that turn first-time visitors into repeat customers.',
    url: 'https://www.repaircoin.ai/waitlist',
    siteName: 'RepairCoin',
    images: [
      {
        url: 'https://www.repaircoin.ai/og-image.png',
        width: 1200,
        height: 630,
        alt: 'RepairCoin - Smart Loyalty for Service Businesses',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Join the RepairCoin Waitlist',
    description:
      'RepairCoin helps service businesses grow with a built-in marketplace, booking system, and rewards that turn first-time visitors into repeat customers.',
    images: ['https://www.repaircoin.ai/og-image.png'],
  },
}

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
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
            iconTheme: { primary: '#FFCC00', secondary: '#1C1C1C' },
            style: {
              background: '#1C1C1C',
              color: '#fff',
              border: '2px solid #FFCC00',
              outline: 'none',
            },
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: '#fff' },
            style: {
              background: '#1C1C1C',
              color: '#fff',
              border: '2px solid #EF4444',
              outline: 'none',
            },
            duration: 5000,
          },
        }}
      />
      {children}
    </>
  )
}
