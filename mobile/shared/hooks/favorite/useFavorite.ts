import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import { serviceApi } from "@/shared/services/service.services";
import { ServiceData } from "@/shared/interfaces/service.interface";

export function useFavorite() {
  const useGetFavorites = (options?: { page?: number; limit?: number }) => {
    return useQuery({
      queryKey: queryKeys.serviceFavorites(options),
      queryFn: async () => {
        const response = await serviceApi.getFavorites(options);
        return response.data;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  };

  const useCheckFavorite = (serviceId: string) => {
    return useQuery({
      queryKey: queryKeys.serviceFavoriteCheck(serviceId),
      queryFn: async () => {
        const response = await serviceApi.checkFavorite(serviceId);
        return response.data.isFavorited;
      },
      enabled: !!serviceId,
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  };

  const useToggleFavorite = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation({
      mutationFn: async ({
        serviceId,
        isFavorited,
      }: {
        serviceId: string;
        isFavorited: boolean;
      }) => {
        if (isFavorited) {
          return await serviceApi.removeFavorite(serviceId);
        } else {
          return await serviceApi.addFavorite(serviceId);
        }
      },
      // Optimistic update - update UI immediately
      onMutate: async ({ serviceId, isFavorited }) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({
          queryKey: [...queryKeys.services(), "favorites"],
        });

        // Snapshot the previous value
        const previousFavorites = queryClient.getQueryData(
          queryKeys.serviceFavorites()
        );

        // Optimistically update the favorites list
        queryClient.setQueryData(
          queryKeys.serviceFavorites(),
          (old: ServiceData[] | undefined) => {
            if (!old) return old;
            if (isFavorited) {
              // Remove from favorites
              return old.filter((s: ServiceData) => s.serviceId !== serviceId);
            } else {
              // We don't have the full service data here, so just invalidate later
              return old;
            }
          }
        );

        return { previousFavorites };
      },
      onError: (err, variables, context) => {
        // Rollback on error
        if (context?.previousFavorites) {
          queryClient.setQueryData(
            queryKeys.serviceFavorites(),
            context.previousFavorites
          );
        }
        console.error("Error toggling favorite:", err);
      },
      onSettled: () => {
        // Refetch after mutation completes (success or error)
        queryClient.invalidateQueries({
          queryKey: [...queryKeys.services(), "favorites"],
          exact: false,
        });
      },
    });

    const toggleFavorite = (serviceId: string, isFavorited: boolean) => {
      mutation.mutate({ serviceId, isFavorited });
    };

    return {
      toggleFavorite,
      isPending: mutation.isPending,
    };
  };

  return {
    useGetFavorites,
    useCheckFavorite,
    useToggleFavorite,
  };
}
