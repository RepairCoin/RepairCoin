"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShopServiceWithShopInfo } from "@/services/api/services";
import { DollarSign, Clock, MapPin, Store, Loader2 } from "lucide-react";

interface ServicePageClientProps {
  serviceId: string;
  service: ShopServiceWithShopInfo | null;
}

export function ServicePageClient({ serviceId, service }: ServicePageClientProps) {
  const router = useRouter();

  useEffect(() => {
    // Redirect to marketplace after a brief delay
    // This allows the page to render with meta tags first
    const timer = setTimeout(() => {
      router.replace(`/customer/marketplace?service=${serviceId}`);
    }, 100);

    return () => clearTimeout(timer);
  }, [serviceId, router]);

  // If service not found, show error
  if (!service) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Service Not Found</h1>
          <p className="text-gray-400 mb-6">The requested service could not be found.</p>
          <button
            onClick={() => router.push("/customer/marketplace")}
            className="bg-[#FFCC00] text-black font-semibold px-6 py-3 rounded-lg hover:bg-[#FFD700] transition-colors"
          >
            Browse Services
          </button>
        </div>
      </div>
    );
  }

  // Render a preview page that also serves as content for social media crawlers
  // Users will be redirected quickly, but crawlers will see this content
  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      {/* Loading overlay for users */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading service details...</p>
        </div>
      </div>

      {/* Content for crawlers (hidden behind overlay for users) */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Service Card */}
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl overflow-hidden">
            {/* Service Image */}
            {service.imageUrl && (
              <div className="w-full aspect-video">
                <img
                  src={service.imageUrl}
                  alt={service.serviceName}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Service Info */}
            <div className="p-6">
              <h1 className="text-3xl font-bold text-white mb-2">
                {service.serviceName}
              </h1>

              {/* Shop Info */}
              <div className="flex items-center gap-2 text-gray-400 mb-4">
                <Store className="w-5 h-5" />
                <span>{service.companyName || service.shopName}</span>
                {service.shopIsVerified && (
                  <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">
                    Verified
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="flex items-center gap-2 text-green-500 text-2xl font-bold mb-4">
                <DollarSign className="w-6 h-6" />
                <span>{service.priceUsd.toFixed(2)}</span>
              </div>

              {/* Duration */}
              {service.durationMinutes && (
                <div className="flex items-center gap-2 text-gray-400 mb-4">
                  <Clock className="w-5 h-5" />
                  <span>{service.durationMinutes} minutes</span>
                </div>
              )}

              {/* Location */}
              {service.shopCity && (
                <div className="flex items-center gap-2 text-gray-400 mb-4">
                  <MapPin className="w-5 h-5" />
                  <span>{service.shopCity}</span>
                </div>
              )}

              {/* Description */}
              {service.description && (
                <div className="mt-6">
                  <h2 className="text-lg font-semibold text-white mb-2">Description</h2>
                  <p className="text-gray-400">{service.description}</p>
                </div>
              )}

              {/* CTA */}
              <div className="mt-8">
                <button
                  onClick={() => router.push(`/customer/marketplace?service=${serviceId}`)}
                  className="w-full bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-bold text-lg px-6 py-4 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all"
                >
                  Book This Service
                </button>
              </div>
            </div>
          </div>

          {/* RepairCoin Branding */}
          <div className="text-center mt-8">
            <p className="text-gray-500">
              Powered by <span className="text-[#FFCC00] font-semibold">RepairCoin</span>
            </p>
            <p className="text-gray-600 text-sm mt-2">
              Book services and earn RCN rewards
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
