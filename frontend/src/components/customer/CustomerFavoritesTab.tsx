"use client";

import React, { useState, useEffect } from "react";
import { Heart, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { servicesApi, ShopServiceWithShopInfo } from "@/services/api/services";
import { StarRating } from "./StarRating";
import { FavoriteButton } from "./FavoriteButton";
import { ShareButton } from "./ShareButton";

interface CustomerFavoritesTabProps {
  className?: string;
}

export const CustomerFavoritesTab: React.FC<CustomerFavoritesTabProps> = ({
  className = "",
}) => {
  const [favorites, setFavorites] = useState<ShopServiceWithShopInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    fetchFavorites();
  }, [page]);

  const fetchFavorites = async () => {
    try {
      setIsLoading(true);
      const response = await servicesApi.getCustomerFavorites({
        page,
        limit: 12,
      });

      if (response) {
        if (page === 1) {
          setFavorites(response.data || []);
        } else {
          setFavorites((prev) => [...prev, ...(response.data || [])]);
        }
        setHasMore(response.pagination?.hasMore || false);
      }
    } catch (error) {
      console.error("Error fetching favorites:", error);
      toast.error("Failed to load favorites");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFavoriteRemoved = (serviceId: string) => {
    setFavorites((prev) => prev.filter((service) => service.serviceId !== serviceId));
    toast.success("Removed from favorites");
  };

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  if (isLoading && page === 1) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin" />
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="bg-gray-800 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
          <Heart className="w-10 h-10 text-gray-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-300 mb-2">
          No Favorites Yet
        </h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Start exploring services and tap the heart icon to save your favorites here!
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <Heart className="w-6 h-6 text-[#FFCC00] fill-current" />
          My Favorites
        </h2>
        <p className="text-gray-400 mt-1">
          {favorites.length} {favorites.length === 1 ? "service" : "services"} saved
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {favorites.map((service) => (
          <div
            key={service.serviceId}
            className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-[#FFCC00]/50 transition-all duration-200 flex flex-col"
          >
            {/* Image */}
            <div className="relative h-48">
              {service.imageUrl ? (
                <img
                  src={service.imageUrl}
                  alt={service.serviceName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                  <span className="text-4xl text-gray-600">🔧</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="absolute top-3 right-3 flex gap-2">
                <FavoriteButton
                  serviceId={service.serviceId}
                  initialIsFavorited={true}
                  size="sm"
                  onFavoriteChange={(isFavorited) => {
                    if (!isFavorited) {
                      handleFavoriteRemoved(service.serviceId);
                    }
                  }}
                />
                <ShareButton
                  serviceId={service.serviceId}
                  serviceName={service.serviceName}
                  shopName={service.companyName}
                  size="sm"
                />
              </div>
            </div>

            {/* Content */}
            <div className="p-5 flex flex-col flex-1">
              {/* Service Name */}
              <h3 className="text-lg font-semibold text-gray-100 mb-2 line-clamp-2">
                {service.serviceName}
              </h3>

              {/* Shop Info */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-400">{service.companyName}</span>
                {service.shopIsVerified && (
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                    Verified
                  </span>
                )}
              </div>

              {/* Rating */}
              {service.averageRating && service.averageRating > 0 && (
                <div className="mb-3">
                  <StarRating
                    value={service.averageRating}
                    size="sm"
                    showNumber
                    showCount
                    totalCount={service.reviewCount}
                  />
                </div>
              )}

              {/* Description */}
              {service.description && (
                <p className="text-sm text-gray-400 mb-4 line-clamp-2 flex-1">
                  {service.description}
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-700 mt-auto">
                {/* Price */}
                <div>
                  <span className="text-2xl font-bold text-[#FFCC00]">
                    ${service.priceUsd}
                  </span>
                  {service.durationMinutes && (
                    <span className="text-sm text-gray-500 ml-2">
                      {service.durationMinutes} min
                    </span>
                  )}
                </div>

                {/* View Button */}
                <button
                  onClick={() => {
                    // Navigate to service details
                    window.location.href = `/customer/marketplace?service=${service.serviceId}`;
                  }}
                  className="px-4 py-2 bg-[#FFCC00] text-black font-semibold rounded-lg hover:bg-[#FFD700] transition-colors flex items-center gap-2"
                >
                  View
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="text-center mt-8">
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            className="px-6 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </button>
        </div>
      )}
    </div>
  );
};
