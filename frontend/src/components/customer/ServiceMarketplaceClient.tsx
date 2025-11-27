"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { ShoppingBag, Loader2, Heart } from "lucide-react";
import { getAllServices, ShopServiceWithShopInfo, servicesApi } from "@/services/api/services";
import { ServiceCard } from "./ServiceCard";
import { ServiceFilters, FilterState } from "./ServiceFilters";
import { ServiceDetailsModal } from "./ServiceDetailsModal";
import { ServiceCheckoutModal } from "./ServiceCheckoutModal";

export const ServiceMarketplaceClient: React.FC = () => {
  const router = useRouter();
  const [services, setServices] = useState<ShopServiceWithShopInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({});
  const [selectedService, setSelectedService] = useState<ShopServiceWithShopInfo | null>(null);
  const [checkoutService, setCheckoutService] = useState<ShopServiceWithShopInfo | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    loadServices();
  }, [filters, page, showFavoritesOnly]);

  const loadServices = async () => {
    setLoading(true);

    try {
      if (showFavoritesOnly) {
        // Load favorites
        const response = await servicesApi.getCustomerFavorites({
          page,
          limit: 12
        });

        if (response) {
          // Append for pagination, replace for first page
          if (page === 1) {
            setServices(response.data);
          } else {
            setServices(prev => [...prev, ...response.data]);
          }
          setHasMore(response.pagination.hasMore);
        }
      } else {
        // Load all services
        const response = await getAllServices({
          ...filters,
          page,
          limit: 12,
        });

        if (response) {
          // Append for pagination, replace for first page
          if (page === 1) {
            setServices(response.data);
          } else {
            setServices(prev => [...prev, ...response.data]);
          }
          setHasMore(response.pagination.hasMore);
        }
      }
    } catch (error) {
      console.error("Error loading services:", error);
      toast.error(showFavoritesOnly ? "Failed to load favorites" : "Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  const handleResetFilters = () => {
    setFilters({});
    setPage(1);
  };

  const handleViewDetails = (service: ShopServiceWithShopInfo) => {
    setSelectedService(service);
  };

  const handleBook = (service: ShopServiceWithShopInfo) => {
    setSelectedService(null);
    setCheckoutService(service);
  };

  const handleCheckoutSuccess = () => {
    toast.success("Booking confirmed! Redirecting to your orders...");
    setCheckoutService(null);
    // Redirect to orders tab
    setTimeout(() => {
      router.push('/customer?tab=orders');
    }, 1500);
  };

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  return (
    <div className="text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-[#FFCC00]" />
              <h1 className="text-4xl font-bold text-white">Service Marketplace</h1>
            </div>
            <button
              onClick={() => {
                setShowFavoritesOnly(!showFavoritesOnly);
                setPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
                showFavoritesOnly
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-red-500/50 hover:text-red-500"
              }`}
            >
              <Heart className={`w-5 h-5 ${showFavoritesOnly ? "fill-current" : ""}`} />
              {showFavoritesOnly ? "Showing Favorites" : "Show Favorites"}
            </button>
          </div>
          <p className="text-gray-400 text-lg">
            {showFavoritesOnly
              ? "Your favorited services"
              : "Discover and book services from local businesses"}
          </p>
        </div>

        {/* Filters - Hide when showing favorites */}
        {!showFavoritesOnly && (
          <div className="mb-8">
            <ServiceFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              onReset={handleResetFilters}
            />
          </div>
        )}

        {/* Services Grid */}
        {loading && page === 1 ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin mx-auto mb-4" />
              <p className="text-white">Loading services...</p>
            </div>
          </div>
        ) : services.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">{showFavoritesOnly ? "❤️" : "🔍"}</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {showFavoritesOnly ? "No Favorites Yet" : "No Services Found"}
            </h3>
            <p className="text-gray-400 mb-6">
              {showFavoritesOnly
                ? "Start adding services to your favorites by clicking the heart icon on any service card"
                : "Try adjusting your filters or check back later for new services"}
            </p>
            {showFavoritesOnly ? (
              <button
                onClick={() => setShowFavoritesOnly(false)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold px-6 py-3 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200"
              >
                Browse All Services
              </button>
            ) : (filters.category || filters.search || filters.minPrice || filters.maxPrice) && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold px-6 py-3 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {services.map((service) => (
                <ServiceCard
                  key={service.serviceId}
                  service={service}
                  onBook={handleBook}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="bg-[#1A1A1A] border border-gray-800 text-white font-semibold px-8 py-3 rounded-xl hover:border-[#FFCC00]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* Results Count */}
        {!loading && services.length > 0 && (
          <p className="text-center text-gray-500 text-sm mt-6">
            Showing {services.length} service{services.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Service Details Modal */}
      {selectedService && (
        <ServiceDetailsModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onBook={handleBook}
        />
      )}

      {/* Checkout Modal */}
      {checkoutService && (
        <ServiceCheckoutModal
          service={checkoutService}
          onClose={() => setCheckoutService(null)}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </div>
  );
};
