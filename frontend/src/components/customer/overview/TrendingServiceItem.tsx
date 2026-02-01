"use client";

import React from "react";
import Image from "next/image";
import { Star, MapPin, ArrowRight } from "lucide-react";
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
  const reviewCount = service.reviewCount || 0;

  return (
    <div className="flex items-center gap-4 p-4 bg-[#1A1A1A] rounded-xl hover:bg-[#252525] transition-colors">
      {/* Service Image */}
      <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-[#2A2A2A]">
        {service.imageUrl ? (
          <Image
            src={service.imageUrl}
            alt={service.serviceName}
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            🔧
          </div>
        )}
      </div>

      {/* Service Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-semibold text-base truncate">
          {service.serviceName}
        </h4>
        <div className="flex items-center gap-1 text-sm text-gray-400 mt-1">
          <span className="text-[#FFCC00] font-medium">
            {service.companyName}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
          <MapPin className="w-3.5 h-3.5" />
          <span className="truncate">
            {service.shopAddress
              ? `${service.shopAddress}${service.shopCity ? `, ${service.shopCity}` : ""}`
              : "Address not available"}
          </span>
        </div>
        {rating > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Star className="w-3.5 h-3.5 text-[#FFCC00] fill-[#FFCC00]" />
            <span className="text-sm text-white font-medium">
              {rating.toFixed(1)}
            </span>
            <span className="text-xs text-gray-500">
              ({reviewCount} reviews)
            </span>
          </div>
        )}
      </div>

      {/* View Button */}
      <button
        onClick={() => onView(service)}
        className="flex items-center gap-1.5 px-4 py-2 bg-[#FFCC00] text-black text-sm font-semibold rounded-lg hover:bg-[#FFD700] transition-colors flex-shrink-0"
      >
        View
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};
