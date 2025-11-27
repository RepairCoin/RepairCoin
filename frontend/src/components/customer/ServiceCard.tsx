"use client";

import React from "react";
import { DollarSign, Clock, MapPin, Image as ImageIcon } from "lucide-react";
import { ShopServiceWithShopInfo, SERVICE_CATEGORIES } from "@/services/api/services";
import { FavoriteButton } from "./FavoriteButton";
import { ShareButton } from "./ShareButton";
import { StarRating } from "./StarRating";

interface ServiceCardProps {
  service: ShopServiceWithShopInfo;
  onBook: (service: ShopServiceWithShopInfo) => void;
  onViewDetails: (service: ShopServiceWithShopInfo) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onBook,
  onViewDetails,
}) => {
  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  return (
    <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl overflow-hidden hover:border-[#FFCC00]/50 transition-all duration-200 hover:shadow-lg hover:shadow-[#FFCC00]/10 group">
      {/* Service Image */}
      <div className="relative">
        {service.imageUrl ? (
          <div className="w-full h-48 overflow-hidden bg-gray-800">
            <img
              src={service.imageUrl}
              alt={service.serviceName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <ImageIcon className="w-16 h-16 text-gray-600" />
          </div>
        )}

        {/* Action Buttons Overlay */}
        <div className="absolute top-3 right-3 flex gap-2">
          <FavoriteButton
            serviceId={service.serviceId}
            size="sm"
          />
          <ShareButton
            serviceId={service.serviceId}
            serviceName={service.serviceName}
            shopName={service.companyName}
            size="sm"
          />
        </div>
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-1 line-clamp-1">
              {service.serviceName}
            </h3>
            {service.category && (
              <span className="inline-block text-xs bg-[#FFCC00]/10 border border-[#FFCC00]/30 text-[#FFCC00] px-2 py-1 rounded-full">
                {getCategoryLabel(service.category)}
              </span>
            )}
          </div>
        </div>

        {/* Shop Info */}
        <div className="mb-3 pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <MapPin className="w-4 h-4" />
            <span className="font-medium text-white">{service.companyName}</span>
          </div>
          {service.shopAddress && (
            <p className="text-xs text-gray-500 mt-1 ml-6 line-clamp-1">
              {service.shopAddress}
            </p>
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
          <p className="text-sm text-gray-400 mb-4 line-clamp-2">
            {service.description}
          </p>
        )}

        {/* Price and Duration */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1 text-green-500">
            <DollarSign className="w-5 h-5" />
            <span className="text-xl font-bold">{service.priceUsd.toFixed(2)}</span>
          </div>
          {service.durationMinutes && (
            <div className="flex items-center gap-1 text-gray-400">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{service.durationMinutes} min</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {service.tags && service.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {service.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
            {service.tags.length > 3 && (
              <span className="text-xs text-gray-500 px-2 py-0.5">
                +{service.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onViewDetails(service)}
            className="flex-1 bg-gray-800 text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-700 transition-colors duration-200"
          >
            View Details
          </button>
          <button
            onClick={() => onBook(service)}
            className="flex-1 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold px-4 py-2.5 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200 transform hover:scale-105"
          >
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
};
