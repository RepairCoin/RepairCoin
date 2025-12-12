"use client";

import React, { useState, useEffect } from "react";
import { Clock, Loader2 } from "lucide-react";
import { getRecentlyViewed, ShopServiceWithShopInfo } from "@/services/api/services";
import { ServiceCard } from "./ServiceCard";

interface RecentlyViewedServicesProps {
  onBook: (service: ShopServiceWithShopInfo) => void;
  onViewDetails: (service: ShopServiceWithShopInfo) => void;
  limit?: number;
}

export const RecentlyViewedServices: React.FC<RecentlyViewedServicesProps> = ({
  onBook,
  onViewDetails,
  limit = 6
}) => {
  const [services, setServices] = useState<ShopServiceWithShopInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentlyViewed();
  }, [limit]);

  const loadRecentlyViewed = async () => {
    try {
      setLoading(true);
      const data = await getRecentlyViewed(limit);
      setServices(data);
    } catch (error) {
      console.error("Error loading recently viewed:", error);
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
    return null; // Don't show section if no recently viewed
  }

  return (
    <div className="mb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-6 h-6 text-[#FFCC00]" />
        <h2 className="text-2xl font-bold text-white">Recently Viewed</h2>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service) => (
          <ServiceCard
            key={service.serviceId}
            service={service}
            onBook={onBook}
            onViewDetails={onViewDetails}
          />
        ))}
      </div>
    </div>
  );
};
