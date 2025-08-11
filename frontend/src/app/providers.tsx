// frontend/src/app/providers.tsx
'use client';

import { ThirdwebProvider } from "thirdweb/react";
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/providers/AuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThirdwebProvider>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                style: {
                  background: '#10b981',
                },
              },
              error: {
                style: {
                  background: '#ef4444',
                },
              },
            }}
          />
        </AuthProvider>
      </ThirdwebProvider>
    </ErrorBoundary>
  );
}