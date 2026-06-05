'use client'

import React from 'react'
import { AIChatWidget } from '@/components/ai-assistant'

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AIChatWidget />
    </>
  )
}
