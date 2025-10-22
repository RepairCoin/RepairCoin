import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../config/queryClient';
import { 
  listShops, 
  getShopById, 
  getShopByWalletAddress 
} from '../services/ShopServices';

export const useShops = () => {
  return useQuery({
    queryKey: queryKeys.shops(),
    queryFn: listShops,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useShop = (shopId: string) => {
  return useQuery({
    queryKey: queryKeys.shopProfile(shopId),
    queryFn: () => getShopById(shopId),
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useShopByWallet = (address: string) => {
  return useQuery({
    queryKey: queryKeys.shopProfile(address),
    queryFn: () => getShopByWalletAddress(address),
    enabled: !!address,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Custom hook for finding nearby shops based on coordinates
export const useNearbyShops = (coordinates?: { lat: number; lng: number }) => {
  return useQuery({
    queryKey: queryKeys.nearbyShops(coordinates || { lat: 0, lng: 0 }),
    queryFn: async () => {
      const allShops = await listShops();
      
      if (!coordinates) return allShops;
      
      // Filter shops within a reasonable distance (this would be better done on the backend)
      return allShops.data?.shops?.filter((shop: any) => {
        if (!shop.latitude || !shop.longitude) return true;
        
        const distance = calculateDistance(
          coordinates.lat,
          coordinates.lng,
          shop.latitude,
          shop.longitude
        );
        
        return distance <= 50; // 50km radius
      }) || [];
    },
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for refreshing shop data
export const useRefreshShopData = () => {
  const queryClient = useQueryClient();
  
  const refreshShop = (shopId: string) => {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.shopProfile(shopId),
    });
  };
  
  const refreshAllShops = () => {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.shops(),
    });
  };
  
  return { refreshShop, refreshAllShops };
};

// Utility function to calculate distance between two coordinates
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}