"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Star, MapPin, Navigation, Image as ImageIcon } from "lucide-react";
import { getShopsForMap, ShopMapData } from "@/services/api/shop";

interface RecommendedShopsCardProps {
  onViewShop?: (shop: ShopMapData) => void;
  limit?: number;
  radiusMiles?: number;
}

type LocationStatus = "loading" | "granted" | "denied";

function ShopThumb({ src, alt }: { src?: string | null; alt: string }) {
  const [err, setErr] = useState(false);
  return (
    <span className="flex h-24 w-full items-center justify-center overflow-hidden rounded-lg bg-gray-100">
      {src && !err ? (
        <img
          src={src}
          alt={alt}
          onError={() => setErr(true)}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <ImageIcon className="w-7 h-7 text-gray-400 transition-transform duration-200 group-hover:scale-110" />
      )}
    </span>
  );
}

export const RecommendedShopsCard: React.FC<RecommendedShopsCardProps> = ({
  onViewShop,
  limit = 6,
  radiusMiles = 25,
}) => {
  const [shops, setShops] = useState<ShopMapData[]>([]);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("loading");
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadNearbyShops = useCallback(
    (lat: number, lng: number) => {
      setLoading(true);
      getShopsForMap({ lat, lng, radius: radiusMiles, limit })
        .then((data) => setShops(data || []))
        .catch(() => setShops([]))
        .finally(() => setLoading(false));
    },
    [radiusMiles, limit]
  );

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setBlocked(false);
      setLocationStatus("denied");
      return;
    }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBlocked(false);
        setLocationStatus("granted");
        loadNearbyShops(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setBlocked(err.code === err.PERMISSION_DENIED);
        setLocationStatus("denied");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [loadNearbyShops]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const renderBody = () => {
    if (locationStatus === "loading" || loading) {
      return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      );
    }

    if (locationStatus === "denied") {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Navigation className="w-5 h-5 text-gray-500" />
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900">See shops near you</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {blocked
                ? "Location is blocked. Allow it for this site in your browser settings, then retry."
                : "Enable location access to find the closest shops."}
            </p>
          </div>
          <button
            onClick={requestLocation}
            className="rounded-lg bg-[#FFCC00] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#FFD700]"
          >
            {blocked ? "Retry" : "Enable location"}
          </button>
        </div>
      );
    }

    if (shops.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-gray-500">
          No shops within {radiusMiles} miles of you.
        </p>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        {shops.map((shop) => (
          <button
            key={shop.shopId}
            onClick={() => onViewShop?.(shop)}
            className="flex flex-col text-left group"
          >
            <ShopThumb src={shop.logoUrl} alt={shop.name} />
            <p className="mt-2 truncate text-sm font-semibold text-gray-900">{shop.name}</p>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
              <Star className="w-3.5 h-3.5 fill-[#FFCC00] text-[#FFCC00]" />
              <span className="font-medium text-gray-900">{(shop.avgRating || 0).toFixed(1)}</span>
              <span className="text-gray-400">·</span>
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />
                {shop.distanceMiles != null ? `${shop.distanceMiles.toFixed(1)} miles` : shop.location?.city || "Nearby"}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-xl bg-white p-5">
      <h3 className="mb-4 text-base font-semibold text-gray-900">Recommended Shops Near You</h3>
      {renderBody()}
    </div>
  );
};

export default RecommendedShopsCard;
