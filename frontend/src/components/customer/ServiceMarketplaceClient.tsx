"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { ShoppingBag, Loader2, Heart, Grid3x3, Map as MapIcon, Filter, X } from "lucide-react";
import { getAllServices, ShopServiceWithShopInfo, servicesApi } from "@/services/api/services";
import { ServiceCard } from "./ServiceCard";
import { ServiceFilters, FilterState } from "./ServiceFilters";
import { ServiceDetailsModal } from "./ServiceDetailsModal";
import { ServiceCheckoutModal } from "./ServiceCheckoutModal";
import { ShopMapView } from "./ShopMapView";
import { RecentlyViewedServices } from "./RecentlyViewedServices";
import { TrendingServices } from "./TrendingServices";
import { useAuthStore } from "@/stores/authStore";
import { serviceGroupApi } from "@/services/api/serviceGroups";
import { getAllCustomerBalances, CustomerAffiliateGroupBalance, getAllGroups, AffiliateShopGroup } from "@/services/api/affiliateShopGroups";

export const ServiceMarketplaceClient: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userType, address } = useAuthStore();
  const [services, setServices] = useState<ShopServiceWithShopInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({});
  const [selectedService, setSelectedService] = useState<ShopServiceWithShopInfo | null>(null);
  const [checkoutService, setCheckoutService] = useState<ShopServiceWithShopInfo | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [refreshKey, setRefreshKey] = useState(0); // For refreshing recently viewed
  const [customerGroups, setCustomerGroups] = useState<AffiliateShopGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Load all public groups on mount (for filtering)
  useEffect(() => {
    loadCustomerGroups();
  }, []);

  // Handle service query parameter to auto-open service details
  useEffect(() => {
    const serviceId = searchParams.get('service');
    if (serviceId && !loading) {
      // Try to find the service in the loaded services first
      const foundService = services.find(s => s.serviceId === serviceId);
      if (foundService) {
        setSelectedService(foundService);
      } else {
        // If not found, fetch it directly
        servicesApi.getServiceById(serviceId)
          .then(service => {
            if (service) {
              setSelectedService(service as ShopServiceWithShopInfo);
            }
          })
          .catch(err => {
            console.error('Error loading service from URL:', err);
            toast.error('Service not found');
          });
      }
      // Clear the service param from URL after handling
      const url = new URL(window.location.href);
      url.searchParams.delete('service');
      window.history.replaceState({}, '', url);
    }
  }, [searchParams, loading, services]);

  useEffect(() => {
    loadServices();
  }, [filters, page, showFavoritesOnly, selectedGroupId]);

  const loadCustomerGroups = async () => {
    try {
      // Load all public affiliate groups so customers can discover services
      const allGroups = await getAllGroups({ isPrivate: false });
      setCustomerGroups(allGroups);
    } catch (error) {
      console.error('Error loading customer groups:', error);
    }
  };

  const loadServices = async () => {
    setLoading(true);

    try {
      if (selectedGroupId) {
        // Load services from selected group
        const groupServices = await serviceGroupApi.getGroupServices(selectedGroupId, {
          category: filters.category,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          search: filters.search
        });

        if (page === 1) {
          setServices(groupServices as ShopServiceWithShopInfo[]);
        } else {
          setServices(prev => [...prev, ...(groupServices as ShopServiceWithShopInfo[])]);
        }
        setHasMore(false); // Group services don't have pagination yet
        setTotalItems(groupServices.length);
      } else if (showFavoritesOnly) {
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
          setHasMore(response.pagination.page < response.pagination.totalPages);
          setTotalItems(response.pagination.total || response.data.length);
        } else {
          // Handle null response
          if (page === 1) {
            setServices([]);
            setTotalItems(0);
          }
          setHasMore(false);
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
          setHasMore(response.pagination.page < response.pagination.totalPages);
          setTotalItems(response.pagination.total || response.data.length);
        } else {
          // Handle null response
          if (page === 1) {
            setServices([]);
            setTotalItems(0);
          }
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error("Error loading services:", error);
      toast.error(showFavoritesOnly ? "Failed to load favorites" : "Failed to load services");
      if (page === 1) {
        setServices([]);
        setTotalItems(0);
      }
      setHasMore(false);
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

  const handleViewDetails = async (service: ShopServiceWithShopInfo) => {
    setSelectedService(service);
    // Track recently viewed (only for customers)
    if (userType === 'customer') {
      await servicesApi.trackRecentlyViewed(service.serviceId);
      setRefreshKey(prev => prev + 1); // Refresh recently viewed section
    }
  };

  const handleAutocompleteSelect = async (serviceId: string) => {
    try {
      const service = await servicesApi.getServiceById(serviceId);
      if (service) {
        handleViewDetails(service);
      }
    } catch (error) {
      console.error("Error loading service:", error);
      toast.error("Failed to load service details");
    }
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

  const handleFavoriteChange = (serviceId: string, isFavorited: boolean) => {
    // Update services array
    setServices(prev => prev.map(service =>
      service.serviceId === serviceId
        ? { ...service, isFavorited }
        : service
    ));
    // Also update selectedService if it's the same service
    if (selectedService?.serviceId === serviceId) {
      setSelectedService(prev => prev ? { ...prev, isFavorited } : prev);
    }
  };

  // Determine if any filters are active (for hiding discovery sections)
  const hasActiveFilters = Boolean(
    filters.search ||
    filters.category ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.city ||
    filters.state ||
    filters.shopId
  );

  // Count active filters for the indicator
  const activeFilterCount = [
    filters.search,
    filters.category,
    filters.minPrice !== undefined || filters.maxPrice !== undefined,
    filters.city || filters.state,
    filters.shopId
  ].filter(Boolean).length;

  // Get human-readable filter descriptions
  const getActiveFilterDescriptions = (): string[] => {
    const descriptions: string[] = [];
    if (filters.search) descriptions.push(`"${filters.search}"`);
    if (filters.category) descriptions.push(filters.category.replace(/_/g, ' '));
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      if (filters.minPrice && filters.maxPrice) {
        descriptions.push(`$${filters.minPrice}-$${filters.maxPrice}`);
      } else if (filters.minPrice) {
        descriptions.push(`$${filters.minPrice}+`);
      } else if (filters.maxPrice) {
        descriptions.push(`up to $${filters.maxPrice}`);
      }
    }
    if (filters.city || filters.state) {
      const location = [filters.city, filters.state].filter(Boolean).join(', ');
      descriptions.push(location);
    }
    return descriptions;
  };

  return (
    <div className="text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-[#FFCC00]" />
              <h1 className="text-4xl font-bold text-white">Service Marketplace</h1>
            </div>
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-[#1A1A1A] border border-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all duration-200 ${
                    viewMode === "grid"
                      ? "bg-[#FFCC00] text-black"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Grid3x3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Grid</span>
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all duration-200 ${
                    viewMode === "map"
                      ? "bg-[#FFCC00] text-black"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <MapIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Map</span>
                </button>
              </div>

              {/* Favorites Toggle */}
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
                <span className="hidden sm:inline">{showFavoritesOnly ? "Showing Favorites" : "Show Favorites"}</span>
              </button>
            </div>
          </div>
          <p className="text-gray-400 text-lg">
            {showFavoritesOnly
              ? "Your favorited services"
              : viewMode === "map"
              ? "Find nearby shops on the map"
              : filters.shopId
              ? `Browsing services from ${services.find(s => s.shopId === filters.shopId)?.shopName || "shop"}`
              : "Discover and book services from local businesses"}
          </p>
        </div>

        {/* Filters - Show at the top, hide when showing favorites or map view */}
        {!showFavoritesOnly && viewMode === "grid" && (
          <div className="mb-8">
            <ServiceFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              onReset={handleResetFilters}
              onSelectService={handleAutocompleteSelect}
            />
          </div>
        )}

        {/* Active Filters Indicator */}
        {hasActiveFilters && viewMode === "grid" && !showFavoritesOnly && !selectedGroupId && (
          <div className="mb-6 bg-gradient-to-r from-[#FFCC00]/10 to-[#FFD700]/5 border border-[#FFCC00]/30 rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-[#FFCC00]/20 rounded-lg">
                  <Filter className="w-4 h-4 text-[#FFCC00]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied
                    {!loading && ` • ${totalItems} result${totalItems !== 1 ? 's' : ''}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {getActiveFilterDescriptions().join(' • ')}
                  </p>
                </div>
              </div>
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-gray-300 hover:text-white hover:border-[#FFCC00]/50 transition-all text-sm font-medium"
              >
                <X className="w-4 h-4" />
                Clear All
              </button>
            </div>
          </div>
        )}

        {/* Group Filter - Show all public groups for discovery */}
        {customerGroups.length > 0 && !showFavoritesOnly && viewMode === "grid" && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-purple-900/20 to-purple-800/20 border border-purple-500/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🎁</span>
                <label className="block text-sm font-bold text-purple-300">
                  Discover Group Rewards
                </label>
              </div>
              <p className="text-xs text-purple-200 mb-3">
                Filter services by affiliate groups to earn bonus tokens on top of RCN!
              </p>
              <select
                value={selectedGroupId}
                onChange={(e) => {
                  setSelectedGroupId(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-purple-500/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent hover:border-purple-400/70 transition-colors"
              >
                <option value="">🌐 All Services (with or without group rewards)</option>
                {customerGroups.map(group => (
                  <option key={group.groupId} value={group.groupId}>
                    {group.icon || '🏪'} {group.groupName} - Earn {group.customTokenSymbol} tokens
                  </option>
                ))}
              </select>
              {selectedGroupId && (
                <div className="mt-3 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <p className="text-xs text-purple-200">
                    ✨ Showing only services where you can earn <span className="font-bold">{customerGroups.find(g => g.groupId === selectedGroupId)?.customTokenSymbol}</span> tokens
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Group Filter Banner */}
        {selectedGroupId && viewMode === "grid" && (
          <div className="mb-8 flex items-center gap-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4">
            <div className="flex-1">
              <p className="text-sm text-purple-400 mb-1">Browsing group services:</p>
              <p className="text-white font-semibold">
                {customerGroups.find(g => g.groupId === selectedGroupId)?.icon || '🎁'} {customerGroups.find(g => g.groupId === selectedGroupId)?.groupName || "Group Services"}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedGroupId("");
                setPage(1);
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              View All Services
            </button>
          </div>
        )}

        {/* Active Shop Filter */}
        {viewMode === "grid" && filters.shopId && !showFavoritesOnly && !selectedGroupId && (
          <div className="mb-8 flex items-center gap-3 bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
            <div className="flex-1">
              <p className="text-sm text-gray-400 mb-1">Viewing shop:</p>
              <p className="text-white font-semibold">
                {services.find(s => s.shopId === filters.shopId)?.shopName || filters.shopId}
              </p>
            </div>
            <button
              onClick={() => {
                setFilters({ ...filters, shopId: undefined });
                setPage(1);
              }}
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              View All Shops
            </button>
          </div>
        )}

        {/* Trending Now Section - Hidden when filters are active */}
        {!loading && page === 1 && !showFavoritesOnly && viewMode === "grid" && !hasActiveFilters && !selectedGroupId && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-800 to-transparent"></div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-[#FFCC00]">🔥</span>
                Trending Now
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-800 to-transparent"></div>
            </div>
            <TrendingServices
              onBook={handleBook}
              onViewDetails={handleViewDetails}
              limit={6}
              days={7}
            />
          </div>
        )}

        {/* Recently Viewed Section - Hidden when filters are active */}
        {userType === 'customer' && !showFavoritesOnly && viewMode === "grid" && !hasActiveFilters && !selectedGroupId && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-800 to-transparent"></div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-[#FFCC00]">👀</span>
                Recently Viewed
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-800 to-transparent"></div>
            </div>
            <RecentlyViewedServices
              key={refreshKey}
              onBook={handleBook}
              onViewDetails={handleViewDetails}
              limit={6}
            />
          </div>
        )}

        {/* Map View */}
        {viewMode === "map" && !showFavoritesOnly ? (
          <ShopMapView
            services={services}
            loading={loading}
            onShopSelect={(shopId) => {
              // Switch to grid view and filter by shop
              setViewMode("grid");
              setFilters({ ...filters, shopId });
              setPage(1);
            }}
          />
        ) : null}

        {/* All Services Section */}
        {viewMode === "grid" && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-800 to-transparent"></div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-[#FFCC00]">{hasActiveFilters ? "🔍" : "🏪"}</span>
                {showFavoritesOnly
                  ? "Your Favorites"
                  : selectedGroupId
                    ? "Group Services"
                    : hasActiveFilters
                      ? "Filtered Results"
                      : "All Services"}
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-800 to-transparent"></div>
            </div>
          </div>
        )}

        {/* Services Grid */}
        {viewMode === "grid" && loading && page === 1 ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin mx-auto mb-4" />
              <p className="text-white">Loading services...</p>
            </div>
          </div>
        ) : viewMode === "grid" && services.length === 0 ? (
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
        ) : viewMode === "grid" ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {services.map((service) => (
                <ServiceCard
                  key={service.serviceId}
                  service={service}
                  onBook={handleBook}
                  onViewDetails={handleViewDetails}
                  onFavoriteChange={handleFavoriteChange}
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
        ) : null}

        {/* Results Count */}
        {!loading && services.length > 0 && viewMode === "grid" && (
          <p className="text-center text-gray-500 text-sm mt-6">
            Showing {services.length} of {totalItems} service{totalItems !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Service Details Modal */}
      {selectedService && (
        <ServiceDetailsModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onBook={handleBook}
          onViewDetails={handleViewDetails}
          onFavoriteChange={handleFavoriteChange}
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
