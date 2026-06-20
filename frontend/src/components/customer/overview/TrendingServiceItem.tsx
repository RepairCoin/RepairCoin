"use client";

import React from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import { ShopServiceWithShopInfo } from "@/services/api/services";

interface TrendingServiceItemProps {
  service: ShopServiceWithShopInfo;
  onView: (service: ShopServiceWithShopInfo) => void;
}

export const TrendingServiceItem: React.FC<TrendingServiceItemProps> = ({
  service,
  onView,
}) => {
  const rating = service.avgRating || service.averageRating || 0;
  const bookingCount = service.bookingCount || 0;

  return (
    <button
      onClick={() => onView(service)}
      className="flex flex-col text-left group"
    >
      {/* Service Image */}
      <div className="relative h-24 w-full overflow-hidden rounded-lg bg-gray-100">
        {service.imageUrl ? (
          <Image
            src={service.imageUrl}
            alt={service.serviceName}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="160px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">
            🔧
          </div>
        )}
      </div>

      {/* Service Info */}
      <p className="mt-2 truncate text-sm font-semibold text-gray-900">
        {service.serviceName}
      </p>
      <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
        <Star className="w-3.5 h-3.5 fill-[#FFCC00] text-[#FFCC00]" />
        <span className="font-medium text-gray-900">{rating.toFixed(1)}</span>
        <span className="text-gray-400">·</span>
        <span>{bookingCount} bookings</span>
      </div>
    </button>
  );
};
