"use client";

import React, { useState, useEffect } from "react";
import { TrendingUp, Loader2, Flame } from "lucide-react";
import { getTrendingServices, ShopServiceWithShopInfo } from "@/services/api/services";
import { ServiceCard } from "./ServiceCard";

interface TrendingServicesProps {
  onBook: (service: ShopServiceWithShopInfo) => void;
  onViewDetails: (service: ShopServiceWithShopInfo) => void;
  limit?: number;
  days?: number;
}

export const TrendingServices: React.FC<TrendingServicesProps> = ({
  onBook,
  onViewDetails,
  limit = 6,
  days = 7
}) => {
  const [services, setServices] = useState<ShopServiceWithShopInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrendingServices();
  }, [limit, days]);

  const loadTrendingServices = async () => {
    try {
      setLoading(true);
      const data = await getTrendingServices({ limit, days });
      setServices(data);
    } catch (error) {
      console.error("Error loading trending services:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-[#FFCC00] animate-spin" />
      </div>
    );
  }

  if (services.length === 0) {
    return null; // Don't show section if no trending services
  }

  return (
    <div className="mb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Flame className="w-6 h-6 text-orange-500" />
          <h2 className="text-2xl font-bold text-white">Trending Now</h2>
          <span className="text-sm text-gray-400">Last {days} days</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <TrendingUp className="w-4 h-4" />
          <span>Most booked services</span>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service, index) => (
          <div key={service.serviceId} className="relative">
            {/* Trending Badge */}
            {index < 3 && (
              <div className="absolute -top-2 -left-2 z-10 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                #{index + 1} Trending
              </div>
            )}
            <ServiceCard
              service={service}
              onBook={onBook}
              onViewDetails={onViewDetails}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
