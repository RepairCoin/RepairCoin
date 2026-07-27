"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star, MapPin, Image as ImageIcon } from "lucide-react";
import { getTrendingServices, ShopServiceWithShopInfo } from "@/services/api/services";

interface PopularServicesCardProps {
  onViewService?: (service: ShopServiceWithShopInfo) => void;
  onSeeMore?: () => void;
  limit?: number;
  radiusMiles?: number;
}

function ServiceThumb({ src, alt }: { src?: string | null; alt: string }) {
  const [err, setErr] = useState(false);
  return (
    <span className="flex h-32 w-full items-center justify-center overflow-hidden rounded-xl bg-[#0a0a0a]">
      {src && !err ? (
        <img
          src={src}
          alt={alt}
          onError={() => setErr(true)}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <ImageIcon className="w-8 h-8 text-gray-500" />
      )}
    </span>
  );
}

export const PopularServicesCard: React.FC<PopularServicesCardProps> = ({
  onViewService,
  onSeeMore,
  limit = 10,
  radiusMiles = 25,
}) => {
  const [services, setServices] = useState<ShopServiceWithShopInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const load = (lat?: number, lng?: number) => {
      getTrendingServices({ limit, days: 30, lat, lng, radius: lat != null ? radiusMiles : undefined })
        .then((data) => active && setServices(data || []))
        .catch(() => active && setServices([]))
        .finally(() => active && setLoading(false));
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => load(pos.coords.latitude, pos.coords.longitude),
        () => load(),
        { timeout: 10000, maximumAge: 300000 }
      );
    } else {
      load();
    }

    return () => {
      active = false;
    };
  }, [limit, radiusMiles]);

  const scrollBy = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 360, behavior: "smooth" });
  };

  return (
    <div className="relative rounded-2xl border border-[#262626] bg-[#161616] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Popular Services Near You</h3>
        <button
          onClick={onSeeMore}
          className="text-sm font-medium text-gray-400 transition-colors hover:text-white"
        >
          See more
        </button>
      </div>

      {loading ? (
        <div className="flex gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 w-44 flex-shrink-0 animate-pulse rounded-xl bg-[#262626]" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No popular services yet.</p>
      ) : (
        <>
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Scroll left"
            className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-[#262626] p-1.5 text-gray-200 shadow-md transition-colors hover:bg-[#333] sm:flex"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label="Scroll right"
            className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-[#262626] p-1.5 text-gray-200 shadow-md transition-colors hover:bg-[#333] sm:flex"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {services.map((service) => {
              const rating = service.avgRating || service.averageRating || 0;
              const bookings = service.bookingCount || 0;
              const distance = service.distanceMiles ?? null;
              return (
                <button
                  key={service.serviceId}
                  onClick={() => onViewService?.(service)}
                  className="group flex w-44 flex-shrink-0 flex-col text-left"
                >
                  <ServiceThumb src={service.imageUrl} alt={service.serviceName} />
                  <p className="mt-2 truncate text-sm font-semibold text-white">
                    {service.serviceName}
                  </p>
                  {service.companyName && (
                    <p className="truncate text-xs text-gray-400">{service.companyName}</p>
                  )}
                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                    <Star className="w-3.5 h-3.5 fill-[#FFCC00] text-[#FFCC00]" />
                    <span className="font-medium text-white">{rating.toFixed(1)}</span>
                    <span className="text-gray-600">·</span>
                    <span>{bookings} bookings</span>
                  </div>
                  {distance != null && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                      <MapPin className="w-3 h-3" />
                      <span>{distance.toFixed(1)} miles</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default PopularServicesCard;
