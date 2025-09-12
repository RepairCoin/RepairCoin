import { useState, useEffect } from 'react';
import { rcgPriceService } from '@/services/rcgPriceService';

interface UseRCGPriceReturn {
  marketPrice: number;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
}

export function useRCGPrice(): UseRCGPriceReturn {
  const [marketPrice, setMarketPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrice = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const priceData = await rcgPriceService.getCurrentPrice();
      setMarketPrice(priceData.price);
      setLastUpdated(priceData.lastUpdated);
    } catch (err) {
      setError('Failed to fetch RCG price');
      console.error('Error fetching RCG price:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrice();
    
    // Refresh price every 15 minutes
    const interval = setInterval(fetchPrice, 15 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    marketPrice,
    loading,
    error,
    lastUpdated,
    refetch: fetchPrice
  };
}