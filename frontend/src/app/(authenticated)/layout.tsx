'use client'

import React from 'react'
import { CustomerAILauncher } from '@/components/customer/ai'

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CustomerAILauncher />
    </>
  )
}
