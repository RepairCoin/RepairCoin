import type { Metadata } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.repaircoin.ai'

export const metadata: Metadata = {
  title: 'Join the Waitlist | Repaircoin',
  description: 'Be the first to earn RCN tokens for your repairs. Join the Repaircoin waitlist and get early access to blockchain-powered rewards for repair shops and customers.',
  openGraph: {
    title: 'Join the Repaircoin Waitlist',
    description: 'Be the first to earn RCN tokens for your repairs. Join the waitlist and get early access to blockchain-powered rewards.',
    url: `${baseUrl}/waitlist`,
    siteName: 'Repaircoin',
    images: [
      {
        url: `${baseUrl}/img/hero-bg.png`,
        width: 1200,
        height: 630,
        alt: 'Repaircoin - Join the Waitlist',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Join the Repaircoin Waitlist',
    description: 'Be the first to earn RCN tokens for your repairs. Join the waitlist and get early access to blockchain-powered rewards.',
    images: [`${baseUrl}/img/hero-bg.png`],
    site: '@Repaircoin',
    creator: '@Repaircoin',
  },
}

export default function WaitlistLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
