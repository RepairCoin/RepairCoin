// frontend/src/app/providers.tsx
"use client";

import { ThirdwebProvider } from "thirdweb/react";
import { AuthProvider } from "@/providers/AuthProvider";
import { AuthMethodProvider } from "@/contexts/AuthMethodContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RecaptchaProvider } from "@/components/providers/RecaptchaProvider";

// Side-effect import: applies saved font size from localStorage on every page load
import '@/stores/accessibilityStore';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <RecaptchaProvider>
        <ThirdwebProvider>
          <AuthMethodProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </AuthMethodProvider>
        </ThirdwebProvider>
      </RecaptchaProvider>
    </ErrorBoundary>
  );
}
