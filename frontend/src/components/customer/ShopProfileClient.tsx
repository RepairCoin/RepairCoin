"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  Package,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { FaFacebook, FaTwitter, FaInstagram } from "react-icons/fa";
import { ShopService } from "@/services/shopService";
import { getAllServices, ShopServiceWithShopInfo } from "@/services/api/services";
import { ServiceCard } from "./ServiceCard";
import { ServiceDetailsModal } from "./ServiceDetailsModal";
import { ServiceCheckoutModal } from "./ServiceCheckoutModal";

interface ShopInfo {
  shopId: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  category?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  verified: boolean;
  location?: {
    lat?: number;
    lng?: number;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

interface ShopProfileClientProps {
  shopId: string;
}

export const ShopProfileClient: React.FC<ShopProfileClientProps> = ({ shopId }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [services, setServices] = useState<ShopServiceWithShopInfo[]>([]);
  const [selectedService, setSelectedService] = useState<ShopServiceWithShopInfo | null>(null);
  const [checkoutService, setCheckoutService] = useState<ShopServiceWithShopInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"services" | "reviews">("services");

  useEffect(() => {
    loadShopData();
  }, [shopId]);

  const loadShopData = async () => {
    setLoading(true);
    try {
      // Fetch shop info and services
      const [shopData, servicesData] = await Promise.all([
        ShopService.getShopById(shopId),
        getAllServices({ shopId, activeOnly: true }),
      ]);

      if (shopData) {
        setShopInfo(shopData);
      }

      if (servicesData) {
        setServices(servicesData.data);
      }
    } catch (error) {
      console.error("Error loading shop data:", error);
      toast.error("Failed to load shop information");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (service: ShopServiceWithShopInfo) => {
    setSelectedService(service);
  };

  const handleBook = (service: ShopServiceWithShopInfo) => {
    setSelectedService(null);
    setCheckoutService(service);
  };

  const handleCheckoutSuccess = () => {
    toast.success("Booking confirmed! Redirecting to your orders...");
    setCheckoutService(null);
    setTimeout(() => {
      router.push("/customer?tab=orders");
    }, 1500);
  };

  const calculateAverageRating = () => {
    if (services.length === 0) return 0;
    const totalRating = services.reduce((sum, service) => sum + (service.avgRating || 0), 0);
    return totalRating / services.length;
  };

  const averageRating = calculateAverageRating();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin mx-auto mb-4" />
          <p className="text-white">Loading shop...</p>
        </div>
      </div>
    );
  }

  if (!shopInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Shop Not Found</h2>
          <p className="text-gray-400 mb-6">The shop you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push("/customer?tab=marketplace")}
            className="bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold px-6 py-3 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200"
          >
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-[#FFCC00] transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        {/* Shop Header */}
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-8 mb-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Shop Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2">{shopInfo.name}</h1>
                  {shopInfo.category && (
                    <p className="text-gray-400 text-lg">{shopInfo.category}</p>
                  )}
                </div>
                {shopInfo.verified && (
                  <span className="px-4 py-2 bg-green-900 bg-opacity-30 text-green-400 text-sm font-medium rounded-full border border-green-700">
                    ✓ Verified
                  </span>
                )}
              </div>

              {/* Rating */}
              {averageRating > 0 && (
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= Math.round(averageRating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-600"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-white font-semibold">{averageRating.toFixed(1)}</span>
                  <span className="text-gray-400">({services.length} services)</span>
                </div>
              )}

              {/* Contact Information */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#FFCC00] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-gray-300">{shopInfo.address}</p>
                    {shopInfo.location?.city && (
                      <p className="text-sm text-gray-500">
                        {shopInfo.location.city}
                        {shopInfo.location.state && `, ${shopInfo.location.state}`}
                        {shopInfo.location.zipCode && ` ${shopInfo.location.zipCode}`}
                      </p>
                    )}
                  </div>
                </div>

                {shopInfo.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-[#FFCC00]" />
                    <a
                      href={`tel:${shopInfo.phone}`}
                      className="text-gray-300 hover:text-[#FFCC00] transition-colors"
                    >
                      {shopInfo.phone}
                    </a>
                  </div>
                )}

                {shopInfo.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-[#FFCC00]" />
                    <a
                      href={`mailto:${shopInfo.email}`}
                      className="text-gray-300 hover:text-[#FFCC00] transition-colors"
                    >
                      {shopInfo.email}
                    </a>
                  </div>
                )}

                {shopInfo.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-[#FFCC00]" />
                    <a
                      href={shopInfo.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-300 hover:text-[#FFCC00] transition-colors"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Social Media & Stats */}
            <div className="lg:w-80">
              {/* Stats */}
              <div className="bg-[#0A0A0A] rounded-xl p-6 mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <Package className="w-6 h-6 text-[#FFCC00]" />
                  <div>
                    <p className="text-2xl font-bold text-white">{services.length}</p>
                    <p className="text-sm text-gray-400">Services Available</p>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Follow Us</h3>
                <div className="flex items-center gap-3">
                  {shopInfo.facebook ? (
                    <a
                      href={shopInfo.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full transition-all duration-200 group shadow hover:shadow-blue-600/25 hover:scale-105"
                    >
                      <FaFacebook className="w-5 h-5 text-white" />
                    </a>
                  ) : (
                    <div className="flex items-center justify-center w-10 h-10 bg-gray-600 opacity-50 rounded-full cursor-not-allowed">
                      <FaFacebook className="w-5 h-5 text-gray-400" />
                    </div>
                  )}

                  {shopInfo.twitter ? (
                    <a
                      href={shopInfo.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-10 h-10 bg-sky-500 hover:bg-sky-600 rounded-full transition-all duration-200 group shadow hover:shadow-sky-500/25 hover:scale-105"
                    >
                      <FaTwitter className="w-5 h-5 text-white" />
                    </a>
                  ) : (
                    <div className="flex items-center justify-center w-10 h-10 bg-gray-600 opacity-50 rounded-full cursor-not-allowed">
                      <FaTwitter className="w-5 h-5 text-gray-400" />
                    </div>
                  )}

                  {shopInfo.instagram ? (
                    <a
                      href={shopInfo.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-10 h-10 bg-gradient-to-tr from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full transition-all duration-200 group shadow hover:shadow-purple-500/25 hover:scale-105"
                    >
                      <FaInstagram className="w-5 h-5 text-white" />
                    </a>
                  ) : (
                    <div className="flex items-center justify-center w-10 h-10 bg-gray-600 opacity-50 rounded-full cursor-not-allowed">
                      <FaInstagram className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-800 mb-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab("services")}
              className={`pb-4 px-2 font-semibold transition-colors relative ${
                activeTab === "services"
                  ? "text-[#FFCC00]"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Services ({services.length})
              {activeTab === "services" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("reviews")}
              className={`pb-4 px-2 font-semibold transition-colors relative ${
                activeTab === "reviews"
                  ? "text-[#FFCC00]"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Reviews
              {activeTab === "reviews" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "services" && (
          <div>
            {services.length === 0 ? (
              <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
                <Package className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  No Services Available
                </h3>
                <p className="text-gray-400">This shop hasn't added any services yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map((service) => (
                  <ServiceCard
                    key={service.serviceId}
                    service={service}
                    onBook={handleBook}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
            <Star className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h3 className="text-xl font-semibold text-white mb-2">Reviews Coming Soon</h3>
            <p className="text-gray-400">
              Shop reviews will be available in a future update.
            </p>
          </div>
        )}
      </div>

      {/* Service Details Modal */}
      {selectedService && (
        <ServiceDetailsModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onBook={handleBook}
        />
      )}

      {/* Checkout Modal */}
      {checkoutService && (
        <ServiceCheckoutModal
          service={checkoutService}
          onClose={() => setCheckoutService(null)}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </div>
  );
};
