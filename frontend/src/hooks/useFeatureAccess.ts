import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/services/api/client';
import { ShopTier, getRequiredTier, tierAllowsFeature } from '@/config/featureTiers';

interface FeatureAccessData {
  tier: ShopTier;
  features: Record<string, boolean>;
}

// Shared across all hook callers so N <TierGate>s trigger one request, not N.
let cache: FeatureAccessData | null = null;
let inflight: Promise<FeatureAccessData> | null = null;
const listeners = new Set<(data: FeatureAccessData | null) => void>();

function notify() {
  listeners.forEach((l) => l(cache));
}

async function fetchFeatureAccess(): Promise<FeatureAccessData> {
  if (cache) return cache;
  if (!inflight) {
    inflight = apiClient
      .get<{ success: boolean; data: FeatureAccessData }>('/shops/feature-access')
      .then((res) => {
        cache = res.data;
        notify();
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function clearFeatureAccessCache() {
  cache = null;
}

// Invalidate and re-fetch, pushing the fresh map to every mounted hook so gates
// update in place (e.g. right after an upgrade) without a reload.
export function refreshFeatureAccess(): Promise<FeatureAccessData> {
  cache = null;
  inflight = null;
  return fetchFeatureAccess();
}

export function useFeatureAccess() {
  const [data, setData] = useState<FeatureAccessData | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let active = true;
    const sync = (next: FeatureAccessData | null) => {
      if (!active) return;
      setData(next);
      setLoading(false);
    };
    listeners.add(sync);

    if (cache) {
      setData(cache);
      setLoading(false);
    } else {
      fetchFeatureAccess()
        .catch(() => {})
        .finally(() => active && setLoading(false));
    }

    return () => {
      active = false;
      listeners.delete(sync);
    };
  }, []);

  const can = useCallback(
    (feature: string) => {
      if (!data) return false;
      if (feature in data.features) return data.features[feature];
      return tierAllowsFeature(data.tier, feature);
    },
    [data]
  );

  return {
    tier: data?.tier ?? null,
    loading,
    can,
    requiredTier: getRequiredTier,
  };
}
