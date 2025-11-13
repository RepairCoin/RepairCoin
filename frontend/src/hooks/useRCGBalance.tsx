import { useState, useEffect } from 'react';
import apiClient from '@/services/api/client';

interface RCGInfo {
  balance: number;
  tier: string;
  currentTierInfo: {
    rcnPrice: number;
    discount: string;
    minRequired: number;
  } | null;
  nextTierInfo: {
    tier: string;
    required: number;
    tokensNeeded: number;
    benefits: {
      rcnPrice: number;
      discount: string;
      minRequired: number;
    };
  } | null;
  contractAddress: string;
}

export function useRCGBalance(shopId: string | undefined) {
  const [rcgInfo, setRcgInfo] = useState<RCGInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) {
      setLoading(false);
      return;
    }

    const fetchRCGInfo = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/shops/${shopId}/rcg-info`);
        // apiClient already returns response.data
        if (response.success) {
          setRcgInfo(response.data);
        }
      } catch (err) {
        console.error('Error fetching RCG info:', err);
        setError('Failed to load RCG balance');
      } finally {
        setLoading(false);
      }
    };

    fetchRCGInfo();
  }, [shopId]);

  return { rcgInfo, loading, error };
}