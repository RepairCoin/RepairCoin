import { useCallback } from "react";
import { router } from "expo-router";
import { useFavorite } from "@/shared/hooks/favorite/useFavorite";
import { ServiceData } from "@/shared/interfaces/service.interface";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";

export function useFavoritesTab() {
  const { useGetFavorites } = useFavorite();
  const { data: favoritesData, isLoading, error, refetch } = useGetFavorites();

  const handleServicePress = useCallback((item: ServiceData) => {
    router.push(`/customer/service/${item.serviceId}`);
  }, []);

  const getCategoryLabel = useCallback((category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  }, []);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const navigateToServices = useCallback(() => {
    router.push("/customer/tabs/service");
  }, []);

  const favorites = favoritesData || [];

  return {
    favorites,
    isLoading,
    error,
    handleServicePress,
    handleRefresh,
    getCategoryLabel,
    navigateToServices,
  };
}
