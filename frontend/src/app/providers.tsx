// frontend/src/app/providers.tsx
"use client";

import { ThirdwebProvider } from "thirdweb/react";
import { AuthProvider } from "@/providers/AuthProvider";
import { AuthMethodProvider } from "@/contexts/AuthMethodContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThirdwebProvider>
        <AuthMethodProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </AuthMethodProvider>
      </ThirdwebProvider>
    </ErrorBoundary>
  );
}
