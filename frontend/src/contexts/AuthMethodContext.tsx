'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AuthMethodContextType {
  authMethod: 'wallet' | 'email' | 'google' | 'apple' | null;
  walletType: 'embedded' | 'external' | null;
  setAuthMethod: (method: 'wallet' | 'email' | 'google' | 'apple', walletType: 'embedded' | 'external') => void;
  clearAuthMethod: () => void;
}

const AuthMethodContext = createContext<AuthMethodContextType | undefined>(undefined);

export function AuthMethodProvider({ children }: { children: ReactNode }) {
  const [authMethod, setAuthMethodState] = useState<'wallet' | 'email' | 'google' | 'apple' | null>(null);
  const [walletType, setWalletType] = useState<'embedded' | 'external' | null>(null);

  const setAuthMethod = (method: 'wallet' | 'email' | 'google' | 'apple', type: 'embedded' | 'external') => {
    setAuthMethodState(method);
    setWalletType(type);
    // Store in session storage for persistence across page navigations
    sessionStorage.setItem('authMethod', method);
    sessionStorage.setItem('walletType', type);
  };

  const clearAuthMethod = () => {
    setAuthMethodState(null);
    setWalletType(null);
    sessionStorage.removeItem('authMethod');
    sessionStorage.removeItem('walletType');
  };

  // Load from session storage on mount
  React.useEffect(() => {
    const storedMethod = sessionStorage.getItem('authMethod') as 'wallet' | 'email' | 'google' | 'apple' | null;
    const storedType = sessionStorage.getItem('walletType') as 'embedded' | 'external' | null;
    if (storedMethod && storedType) {
      setAuthMethodState(storedMethod);
      setWalletType(storedType);
    }
  }, []);

  return (
    <AuthMethodContext.Provider value={{ authMethod, walletType, setAuthMethod, clearAuthMethod }}>
      {children}
    </AuthMethodContext.Provider>
  );
}

export function useAuthMethod() {
  const context = useContext(AuthMethodContext);
  if (context === undefined) {
    throw new Error('useAuthMethod must be used within an AuthMethodProvider');
  }
  return context;
}