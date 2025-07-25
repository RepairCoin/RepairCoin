'use client'

import { useEffect, useState } from 'react'

interface ClientBodyProps {
  className: string
  children: React.ReactNode
}

export default function ClientBody({ className, children }: ClientBodyProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Return server-side version
    return (
      <body className={className}>
        {children}
      </body>
    )
  }

  // Return client-side version (will match any browser extension modifications)
  return (
    <body className={className}>
      {children}
    </body>
  )
}