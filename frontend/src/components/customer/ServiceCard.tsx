"use client";

import React from "react";
import { DollarSign, Clock, MapPin, Image as ImageIcon, Coins, Plus } from "lucide-react";
import { ShopServiceWithShopInfo, SERVICE_CATEGORIES } from "@/services/api/services";
import { FavoriteButton } from "./FavoriteButton";
import { ShareButton } from "./ShareButton";
import { StarRating } from "./StarRating";
import { calculateTotalRcn } from "@/utils/rcnCalculator";
import { useCustomerStore } from "@/stores/customerStore";

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
  const [imageError, setImageError] = React.useState(false);
  const { customerData } = useCustomerStore();

  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  // Calculate RCN earnings for this service
  const customerTier = customerData?.tier || 'BRONZE';
  const { baseRcn, totalRcn, tierBonus, qualifies } = calculateTotalRcn(service.priceUsd, customerTier);

  // Validate if the imageUrl is a valid web image URL
  const isValidImageUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;

    // Check if it's a file:// URL (invalid for web)
    if (url.startsWith('file://')) {
      return false;
    }

    // Check if it's a valid HTTP/HTTPS URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return false;
    }

    // Check if URL points to an actual image file
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const hasImageExtension = imageExtensions.some(ext => url.toLowerCase().includes(ext));

    return true;
  };

  const validImageUrl = isValidImageUrl(service.imageUrl) ? service.imageUrl : null;

  return (
    <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl overflow-hidden hover:border-[#FFCC00]/50 transition-all duration-200 hover:shadow-lg hover:shadow-[#FFCC00]/10 group flex flex-col h-full">
      {/* Service Image */}
      <div className="relative flex-shrink-0">
        {validImageUrl && !imageError ? (
          <div className="w-full h-48 overflow-hidden bg-gray-800">
            <img
              src={validImageUrl}
              alt={service.serviceName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImageError(true)}
            />
          </div>
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <ImageIcon className="w-16 h-16 text-gray-600" />
          </div>
        )}

        {/* Favorite Button - Top Right */}
        <div className="absolute top-3 right-3 z-10">
          <FavoriteButton
            serviceId={service.serviceId}
            size="md"
            className="ring-2 ring-white/20"
          />
        </div>

        {/* Share Button - Top Right (below favorite) */}
        <div className="absolute top-14 right-3 z-10">
          <ShareButton
            serviceId={service.serviceId}
            serviceName={service.serviceName}
            shopName={service.companyName}
            size="md"
            className="ring-2 ring-white/20"
          />
        </div>

        {/* Group Token Badges - Bottom Left */}
        {service.groups && service.groups.length > 0 && (
          <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1 max-w-[65%]">
            <div className="flex flex-wrap gap-1">
              {service.groups.slice(0, 2).map((group) => (
                <div
                  key={group.groupId}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-purple-600/95 to-purple-500/95 backdrop-blur-md border border-purple-300/50 text-white rounded-lg text-[11px] font-bold shadow-xl hover:scale-105 hover:shadow-purple-500/50 transition-all duration-200 cursor-help"
                  title={`Earn ${group.customTokenSymbol} tokens (${group.customTokenName}) when you book this service!`}
                >
                  <span className="text-sm">{group.icon || '🎁'}</span>
                  <span className="tracking-wide">{group.customTokenSymbol}</span>
                  <span className="text-purple-200">+</span>
                </div>
              ))}
              {service.groups.length > 2 && (
                <div
                  className="flex items-center px-2 py-1 bg-gray-800/95 backdrop-blur-sm border border-gray-500/60 text-gray-200 rounded-lg text-[10px] font-semibold shadow-lg cursor-help"
                  title={`${service.groups.length - 2} more group token${service.groups.length - 2 > 1 ? 's' : ''}: ${service.groups.slice(2).map(g => g.customTokenSymbol).join(', ')}`}
                >
                  +{service.groups.length - 2} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* RCN Earning Badge - Bottom Right */}
        {qualifies && (
          <div className="absolute bottom-3 right-3 z-10 group/rcn">
            <div className="flex items-center gap-0.5 bg-gradient-to-r from-[#FFCC00]/95 to-[#FFD700]/95 backdrop-blur-sm border border-[#FFCC00]/60 text-black px-2.5 py-1 rounded-full shadow-lg hover:scale-105 transition-transform duration-200 cursor-help">
              <Plus className="w-3 h-3" />
              <span className="text-xs font-bold">
                {totalRcn}
              </span>
              <Coins className="w-3 h-3 ml-0.5" />
            </div>
            {/* Tooltip on hover */}
            {tierBonus > 0 && (
              <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-black/90 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover/rcn:opacity-100 transition-opacity duration-200 pointer-events-none">
                Base: {baseRcn} + {customerTier} Bonus: {tierBonus}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-grow">
        {/* Content - Grows to fill space */}
        <div className="flex-grow">
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
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 flex-shrink-0 text-gray-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white line-clamp-2 break-words">
                  {service.companyName}
                </p>
                {service.shopAddress && (
                  <p className="text-xs text-gray-500 line-clamp-1 mt-1 break-words">
                    {service.shopAddress}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Rating */}
          {((service.avgRating && service.avgRating > 0) || (service.averageRating && service.averageRating > 0)) && (
            <div className="mb-3">
              <StarRating
                value={service.avgRating || service.averageRating || 0}
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

          {/* Group Rewards Info */}
          {service.groups && service.groups.length > 0 && (
            <div className="mb-4 p-3 bg-gradient-to-r from-purple-900/20 to-purple-800/20 border border-purple-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🎁</span>
                <span className="text-xs font-bold text-purple-300">BONUS GROUP REWARDS</span>
              </div>
              <p className="text-[11px] text-purple-200 leading-relaxed">
                Earn <span className="font-bold text-purple-100">{service.groups.map(g => g.customTokenSymbol).join(', ')}</span> token{service.groups.length > 1 ? 's' : ''} in addition to RCN!
              </p>
            </div>
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
        </div>

        {/* Actions - Always at bottom */}
        <div className="flex gap-2 mt-auto">
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
