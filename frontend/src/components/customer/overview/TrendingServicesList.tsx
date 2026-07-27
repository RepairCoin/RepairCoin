"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getTrendingServices, ShopServiceWithShopInfo } from "@/services/api/services";
import { TrendingServiceItem } from "./TrendingServiceItem";

interface TrendingServicesListProps {
  onViewService: (service: ShopServiceWithShopInfo) => void;
  limit?: number;
}

export const TrendingServicesList: React.FC<TrendingServicesListProps> = ({
  onViewService,
  limit = 6,
}) => {
  const [services, setServices] = useState<ShopServiceWithShopInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getTrendingServices({ limit, days: 7 })
      .then((data) => active && setServices(data || []))
      .catch(() => active && setServices([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [limit]);

  const visible = services.slice(0, limit);

  return (
    <div className="rounded-2xl border border-[#262626] bg-[#161616] p-5">
      <h3 className="mb-4 text-base font-semibold text-white">Trending Services</h3>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-8 h-8 text-[#FFCC00] animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-400">No trending services yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {visible.map((service) => (
            <TrendingServiceItem
              key={service.serviceId}
              service={service}
              onView={onViewService}
            />
          ))}
        </div>
      )}
    </div>
  );
};
