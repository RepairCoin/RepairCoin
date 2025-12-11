"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { getSimilarServices, ShopServiceWithShopInfo } from "@/services/api/services";
import { ServiceCard } from "./ServiceCard";

interface SimilarServicesProps {
  serviceId: string;
  onBook: (service: ShopServiceWithShopInfo) => void;
  onViewDetails: (service: ShopServiceWithShopInfo) => void;
  limit?: number;
}

export const SimilarServices: React.FC<SimilarServicesProps> = ({
  serviceId,
  onBook,
  onViewDetails,
  limit = 6
}) => {
  const [services, setServices] = useState<ShopServiceWithShopInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSimilarServices();
  }, [serviceId, limit]);

  const loadSimilarServices = async () => {
    try {
      setLoading(true);
      const data = await getSimilarServices(serviceId, limit);
      setServices(data);
    } catch (error) {
      console.error("Error loading similar services:", error);
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
    return null; // Don't show section if no similar services
  }

  return (
    <div className="mt-12 pt-12 border-t border-gray-800">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="w-6 h-6 text-[#FFCC00]" />
        <h2 className="text-2xl font-bold text-white">Similar Services</h2>
        <span className="text-sm text-gray-400">You might also like</span>
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
