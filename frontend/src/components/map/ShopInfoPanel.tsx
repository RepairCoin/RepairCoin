"use client";

import { useRouter } from "next/navigation";
import { MapPin, Phone, Mail, Star, Package, Globe, Navigation, X } from "lucide-react";
import { ShopMapData } from "@/services/api/shop";
import { ShopWithDistance } from "@/hooks/useShopMap";
import { metersToMiles, formatDuration } from "@/utils/distance";
import { RouteResult } from "@/utils/route";

interface ShopInfoPanelProps {
  shop: ShopMapData;
  distance?: number;
  hasLocation: boolean;
  showDirections: boolean;
  routeData: RouteResult | null;
  isLoadingRoute: boolean;
  onGetDirections: () => void;
  onCloseDirections: () => void;
  onClose: () => void;
}

export function ShopInfoPanel({
  shop,
  distance,
  hasLocation,
  showDirections,
  routeData,
  isLoadingRoute,
  onGetDirections,
  onCloseDirections,
  onClose,
}: ShopInfoPanelProps) {
  const router = useRouter();

  return (
    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-gray-800">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-[#FFCC00]">{shop.name}</h3>
          {distance !== undefined && (
            <span className="text-xs text-gray-400">{distance.toFixed(1)} mi away</span>
          )}
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Rating */}
      {shop.avgRating > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-3.5 h-3.5 ${s <= Math.round(shop.avgRating) ? "fill-yellow-400 text-yellow-400" : "text-gray-600"}`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400">({shop.avgRating.toFixed(1)})</span>
          {shop.totalReviews > 0 && (
            <span className="text-xs text-gray-500">{shop.totalReviews} reviews</span>
          )}
        </div>
      )}

      {/* Service count */}
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-4 h-4 text-[#FFCC00]" />
        <span className="text-sm text-white">{shop.serviceCount} Services</span>
        {shop.category && (
          <span className="text-xs bg-[#2a2a2a] text-gray-300 px-2 py-0.5 rounded border border-gray-700">
            {shop.category.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* Contact info */}
      <div className="space-y-2 mb-4">
        {shop.address && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-300">{shop.address}</p>
          </div>
        )}
        {shop.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-gray-500" />
            <a href={`tel:${shop.phone}`} className="text-sm text-gray-300 hover:text-[#FFCC00]">
              {shop.phone}
            </a>
          </div>
        )}
        {shop.email && (
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-500" />
            <a href={`mailto:${shop.email}`} className="text-sm text-gray-300 hover:text-[#FFCC00]">
              {shop.email}
            </a>
          </div>
        )}
      </div>

      {/* Directions info */}
      {showDirections && routeData && (
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-[#FFCC00] text-sm font-bold">{metersToMiles(routeData.distance).toFixed(1)} mi</p>
                <p className="text-gray-500 text-[10px]">Distance</p>
              </div>
              <div className="w-px h-6 bg-gray-700" />
              <div className="text-center">
                <p className="text-white text-sm font-bold">{formatDuration(routeData.duration)}</p>
                <p className="text-gray-500 text-[10px]">Drive time</p>
              </div>
            </div>
            <button onClick={onCloseDirections} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showDirections && isLoadingRoute && (
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-3 mb-4 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-[#FFCC00] border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Calculating route...</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {hasLocation && !showDirections && (
          <button
            onClick={onGetDirections}
            className="flex-1 flex items-center justify-center gap-2 bg-[#2a2a2a] text-[#FFCC00] font-semibold px-4 py-2.5 rounded-xl border border-gray-700 hover:bg-[#333] transition-colors text-sm"
          >
            <Navigation className="w-4 h-4" />
            Directions
          </button>
        )}
        <button
          onClick={() => router.push(`/customer/shop/${shop.shopId}`)}
          className="flex-1 flex items-center justify-center gap-2 bg-[#FFCC00] text-black font-semibold px-4 py-2.5 rounded-xl hover:bg-[#FFD700] transition-colors text-sm"
        >
          <Globe className="w-4 h-4" />
          Visit Shop
        </button>
      </div>
    </div>
  );
}
