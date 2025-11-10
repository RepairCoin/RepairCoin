'use client';

import { useEffect, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useAuthStore } from '@/stores/authStore';

/**
 * SINGLE GLOBAL AUTHENTICATION INITIALIZER
 *
 * This hook should ONLY be used ONCE in the app (in the root provider).
 * It listens to account changes and triggers login/logout centrally.
 *
 * DO NOT use this hook in multiple places - it will cause duplicate logins.
 */
export function useAuthInitializer() {
  const account = useActiveAccount();
  const { login, logout, setAccount } = useAuthStore();
  const previousAddressRef = useRef<string | null>(null);

  useEffect(() => {
    const currentAddress = account?.address;
    const previousAddress = previousAddressRef.current;

    // Only process actual changes
    if (currentAddress === previousAddress) {
      return;
    }

    if (currentAddress) {
      // User connected wallet
      console.log('[AuthInitializer] Account connected:', currentAddress);
      setAccount(account);
      login(currentAddress);
    } else if (previousAddress) {
      // User disconnected wallet (only logout if we were previously connected)
      console.log('[AuthInitializer] Account disconnected');
      logout();
    }
    // else: initial load with no wallet - do nothing

    // Update ref for next comparison
    previousAddressRef.current = currentAddress || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  return null;
}
