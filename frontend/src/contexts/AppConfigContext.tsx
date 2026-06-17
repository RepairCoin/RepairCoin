'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getApiBaseUrl } from '@/utils/apiUrl';

/**
 * App-wide runtime config fetched from the backend's public GET /api/config.
 *
 * The key flag is `blockchainEnabled`, which mirrors the backend
 * ENABLE_BLOCKCHAIN_MINTING env var. When false (database-only mode), the UI
 * hides blockchain-only features: Mint to Wallet, bulk mint, RCG transfer/OTC,
 * staking, and the crypto (Thirdweb) payment option. See docs/blockchain-removal/.
 *
 * Default while loading is `blockchainEnabled: false` so blockchain UI stays
 * hidden until the backend confirms it's on — this avoids flashing mint/staking
 * buttons that would then disappear in DB-only mode.
 */
interface AppConfig {
  blockchainEnabled: boolean;
}

interface AppConfigContextType extends AppConfig {
  loading: boolean;
}

const DEFAULT_CONFIG: AppConfigContextType = {
  blockchainEnabled: false,
  loading: true,
};

const AppConfigContext = createContext<AppConfigContextType>(DEFAULT_CONFIG);

interface ConfigResponse {
  success?: boolean;
  data?: Partial<AppConfig>;
}

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>({ blockchainEnabled: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchConfig = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/config`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          throw new Error(`Config request failed: ${res.status}`);
        }
        const body: ConfigResponse = await res.json();
        if (!cancelled && body?.data) {
          setConfig({ blockchainEnabled: body.data.blockchainEnabled === true });
        }
      } catch {
        // Fail closed: keep blockchain features hidden if config can't be read.
        if (!cancelled) {
          setConfig({ blockchainEnabled: false });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppConfigContext.Provider value={{ ...config, loading }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig(): AppConfigContextType {
  return useContext(AppConfigContext);
}

/**
 * Convenience hook for the common case: is blockchain enabled?
 * Returns false while loading and in database-only mode.
 */
export function useBlockchainEnabled(): boolean {
  return useContext(AppConfigContext).blockchainEnabled;
}
