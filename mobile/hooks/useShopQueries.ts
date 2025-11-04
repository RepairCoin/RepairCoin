import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/config/queryClient';
import { ShopResponse, listShops } from '@/services/ShopServices';

export const useShops = () => {
  return useQuery({
    queryKey: queryKeys.shops(),
    queryFn: async () => {
      const response: ShopResponse = await listShops();
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
