"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Flame, Loader2 } from "lucide-react";
import { getTrendingServices, ShopServiceWithShopInfo } from "@/services/api/services";
import { TrendingServiceItem } from "./TrendingServiceItem";

interface TrendingServicesListProps {
  onViewService: (service: ShopServiceWithShopInfo) => void;
  limit?: number;
}

export const TrendingServicesList: React.FC<TrendingServicesListProps> = ({
  onViewService,
  limit = 3,
}) => {
  const [services, setServices] = useState<ShopServiceWithShopInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 3;

  useEffect(() => {
    loadTrendingServices();
  }, [limit]);

  const loadTrendingServices = async () => {
    try {
      setLoading(true);
      const data = await getTrendingServices({ limit: 9, days: 7 }); // Get more for pagination
      setServices(data);
    } catch (error) {
      console.error("Error loading trending services:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(services.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const visibleServices = services.slice(startIndex, startIndex + itemsPerPage);

  const handlePrev = () => {
    setCurrentPage((prev) => (prev > 0 ? prev - 1 : totalPages - 1));
  };

  const handleNext = () => {
    setCurrentPage((prev) => (prev < totalPages - 1 ? prev + 1 : 0));
  };

  if (loading) {
    return (
      <div className="bg-[#212121] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-white font-semibold text-base">Trending Services</h3>
        </div>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-8 h-8 text-[#FFCC00] animate-spin" />
        </div>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="bg-[#212121] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-white font-semibold text-base">Trending Services</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">No trending services yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#212121] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-white font-semibold text-base">Trending Services</h3>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="p-1.5 hover:bg-[#2A2A2A] rounded-full transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 hover:bg-[#2A2A2A] rounded-full transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Services List */}
      <div className="p-4 space-y-3">
        {visibleServices.map((service) => (
          <TrendingServiceItem
            key={service.serviceId}
            service={service}
            onView={onViewService}
          />
        ))}
      </div>
    </div>
  );
};
