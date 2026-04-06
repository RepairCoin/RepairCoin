"use client";

import { Star, MapPin, Info } from "lucide-react";
import { ShopMapData } from "@/services/api/shop";
import { ShopWithDistance } from "@/hooks/useShopMap";

interface NearbyShopsListProps {
  shops: (ShopWithDistance | ShopMapData)[];
  selectedShopId?: string;
  radiusMiles: number;
  hasLocation: boolean;
  totalShopCount: number;
  isShowingNearest?: boolean;
  onSelect: (shop: ShopMapData) => void;
}

function isShopWithDistance(shop: ShopWithDistance | ShopMapData): shop is ShopWithDistance {
  return 'distance' in shop && typeof shop.distance === 'number';
}

export function NearbyShopsList({
  shops,
  selectedShopId,
  radiusMiles,
  hasLocation,
  totalShopCount,
  isShowingNearest,
  onSelect,
}: NearbyShopsListProps) {
  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 lg:h-full lg:flex lg:flex-col">
      <div className="border-b border-gray-800 px-4 py-3 flex-shrink-0">
        <h4 className="font-semibold text-white text-sm">
          {!hasLocation
            ? `All Shops (${shops.length})`
            : isShowingNearest
            ? `Nearest Shops`
            : `Nearby Shops (${shops.length} within ${radiusMiles} mi)`}
        </h4>
        {isShowingNearest && (
          <p className="text-gray-500 text-xs mt-0.5">
            No shops within {radiusMiles} mi — showing nearest
          </p>
        )}
      </div>
      <div className="p-2 space-y-1 lg:flex-1 lg:overflow-y-auto thin-scrollbar">
        {shops.length === 0 ? (
          <div className="py-6 text-center">
            <MapPin className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">
              {hasLocation
                ? `No shops within ${radiusMiles} mi. Try increasing the radius.`
                : "No shops available"}
            </p>
          </div>
        ) : (
          shops.map((shop) => (
            <button
              key={shop.shopId}
              onClick={() => onSelect(shop)}
              className={`w-full text-left p-3 rounded-lg transition-all ${
                selectedShopId === shop.shopId
                  ? "bg-[#FFCC00]/15 border border-[#FFCC00]/50"
                  : "hover:bg-[#222] border border-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h5 className={`font-medium text-sm truncate ${
                    selectedShopId === shop.shopId ? "text-[#FFCC00]" : "text-white"
                  }`}>
                    {shop.name}
                  </h5>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{shop.address}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {isShopWithDistance(shop) && (
                    <span className="text-xs text-gray-400">{shop.distance.toFixed(1)} mi</span>
                  )}
                  {shop.avgRating > 0 && (
                    <div className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs text-gray-400">{shop.avgRating.toFixed(1)}</span>
                    </div>
                  )}
                  <span className="text-[10px] text-gray-600">{shop.serviceCount} services</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
      {/* Info notice for shops without coordinates */}
      {hasLocation && totalShopCount > shops.length && (
        <div className="border-t border-gray-800 px-4 py-2.5 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <p className="text-[11px] text-gray-500">
            Some shops haven&apos;t set their map location. Browse all in Grid view.
          </p>
        </div>
      )}
    </div>
  );
}
