"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { X, DollarSign, Clock, MapPin, Phone, Mail, Image as ImageIcon, Tag, Store, Coins, TrendingUp } from "lucide-react";
import { ShopServiceWithShopInfo, SERVICE_CATEGORIES } from "@/services/api/services";
import { StarRating } from "./StarRating";
import { FavoriteButton } from "./FavoriteButton";
import { ShareButton } from "./ShareButton";
import { ReviewList } from "./ReviewList";
import { SimilarServices } from "./SimilarServices";
import { calculateTotalRcn } from "@/utils/rcnCalculator";
import { useCustomerStore } from "@/stores/customerStore";
import { sanitizeDescription } from "@/utils/sanitize";

interface ServiceDetailsModalProps {
  service: ShopServiceWithShopInfo;
  onClose: () => void;
  onBook: (service: ShopServiceWithShopInfo) => void;
  onViewDetails?: (service: ShopServiceWithShopInfo) => void;
  onFavoriteChange?: (serviceId: string, isFavorited: boolean) => void;
}

export const ServiceDetailsModal: React.FC<ServiceDetailsModalProps> = ({
  service,
  onClose,
  onBook,
  onViewDetails,
  onFavoriteChange,
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"details" | "reviews">("details");
  const { customerData } = useCustomerStore();

  const handleViewSimilar = (similarService: ShopServiceWithShopInfo) => {
    if (onViewDetails) {
      onViewDetails(similarService);
    }
  };

  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  // Calculate RCN earnings for this service
  const customerTier = customerData?.tier || 'BRONZE';
  const { baseRcn, tierBonus, totalRcn, qualifies } = calculateTotalRcn(service.priceUsd, customerTier);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1A1A1A] z-10 border-b border-gray-800">
          <div className="flex items-center justify-between p-6">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-2">Service Details</h2>
              {/* Average Rating */}
              {service.averageRating && service.averageRating > 0 && (
                <StarRating
                  value={service.averageRating}
                  size="sm"
                  showNumber
                  showCount
                  totalCount={service.reviewCount}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <FavoriteButton
                serviceId={service.serviceId}
                initialIsFavorited={service.isFavorited}
                size="md"
                onFavoriteChange={(isFavorited) => onFavoriteChange?.(service.serviceId, isFavorited)}
              />
              <ShareButton
                serviceId={service.serviceId}
                serviceName={service.serviceName}
                shopName={service.companyName}
                size="md"
              />
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors ml-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-t border-gray-800">
            <button
              onClick={() => setActiveTab("details")}
              className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
                activeTab === "details"
                  ? "text-[#FFCC00] border-b-2 border-[#FFCC00]"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab("reviews")}
              className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
                activeTab === "reviews"
                  ? "text-[#FFCC00] border-b-2 border-[#FFCC00]"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Reviews {service.reviewCount ? `(${service.reviewCount})` : ""}
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Details Tab */}
          {activeTab === "details" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Image and Basic Info */}
              <div>
              {/* Service Image */}
              {service.imageUrl ? (
                <div className="w-full aspect-video rounded-xl overflow-hidden bg-gray-800 mb-4">
                  <img
                    src={service.imageUrl}
                    alt={service.serviceName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full aspect-video rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center mb-4">
                  <ImageIcon className="w-16 h-16 text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500">No image available</p>
                </div>
              )}

              {/* Service Info */}
              <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-5">
                <h3 className="text-xl font-bold text-white mb-3">{service.serviceName}</h3>

                {service.category && (
                  <div className="mb-4">
                    <span className="inline-block text-sm bg-[#FFCC00]/10 border border-[#FFCC00]/30 text-[#FFCC00] px-3 py-1.5 rounded-full">
                      {getCategoryLabel(service.category)}
                    </span>
                  </div>
                )}

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-green-500">
                    <DollarSign className="w-5 h-5" />
                    <span className="text-2xl font-bold">${service.priceUsd.toFixed(2)}</span>
                  </div>

                  {service.durationMinutes && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-5 h-5" />
                      <span>{service.durationMinutes} minutes</span>
                    </div>
                  )}
                </div>

                {/* RCN Earning Section */}
                {qualifies && (
                  <div className="bg-gradient-to-r from-[#FFCC00]/20 to-[#FFD700]/20 border border-[#FFCC00]/40 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Coins className="w-5 h-5 text-[#FFCC00]" />
                      <h4 className="text-sm font-bold text-white">RCN Rewards</h4>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Base Reward</span>
                        <span className="text-lg font-bold text-[#FFCC00]">{baseRcn} RCN</span>
                      </div>

                      {tierBonus > 0 && (
                        <div className="flex items-center justify-between border-t border-[#FFCC00]/20 pt-2">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4 text-green-400" />
                            <span className="text-sm text-gray-300">{customerTier} Tier Bonus</span>
                          </div>
                          <span className="text-lg font-bold text-green-400">+{tierBonus} RCN</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-[#FFCC00]/20 pt-2 mt-2">
                        <span className="text-base font-semibold text-white">Total Earnings</span>
                        <span className="text-2xl font-bold text-[#FFCC00]">{totalRcn} RCN</span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 mt-3">
                      Earned when service is completed • 1 RCN = $0.10 USD value
                    </p>
                  </div>
                )}

                {service.description && (
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-2">Description</h4>
                    <p className="text-sm text-gray-400 whitespace-pre-line">{sanitizeDescription(service.description)}</p>
                  </div>
                )}

                {/* Tags */}
                {service.tags && service.tags.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Tags
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {service.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="text-xs bg-[#FFCC00]/10 border border-[#FFCC00]/30 text-[#FFCC00] px-3 py-1 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Shop Info */}
            <div>
              <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-5 mb-4">
                <h3 className="text-lg font-bold text-white mb-4">About the Shop</h3>

                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-1">Business Name</h4>
                    <p className="text-white font-medium">{service.companyName}</p>
                  </div>

                  {service.shopAddress && (
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Location
                      </h4>
                      <p className="text-gray-400 text-sm ml-6">{service.shopAddress}</p>
                      {service.shopCity && (
                        <p className="text-gray-400 text-sm ml-6">{service.shopCity}</p>
                      )}
                    </div>
                  )}

                  {service.shopPhone && (
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Phone
                      </h4>
                      <a
                        href={`tel:${service.shopPhone}`}
                        className="text-[#FFCC00] text-sm ml-6 hover:underline"
                      >
                        {service.shopPhone}
                      </a>
                    </div>
                  )}

                  {service.shopEmail && (
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </h4>
                      <a
                        href={`mailto:${service.shopEmail}`}
                        className="text-[#FFCC00] text-sm ml-6 hover:underline break-all"
                      >
                        {service.shopEmail}
                      </a>
                    </div>
                  )}

                  {service.shopIsVerified && (
                    <div className="pt-3 border-t border-gray-800">
                      <span className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-semibold px-3 py-1.5 rounded-full">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Verified Shop
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Booking Info */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 mb-4">
                <h4 className="text-sm font-semibold text-blue-400 mb-2">Booking Information</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Payment is processed securely through Stripe</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>You can cancel before payment completion</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Earn RCN rewards when service is completed</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* View Shop Button */}
                <button
                  onClick={() => {
                    if (service.shopId) {
                      router.push(`/customer/shop/${service.shopId}`);
                      onClose();
                    }
                  }}
                  className="w-full bg-[#1A1A1A] border-2 border-gray-700 text-white font-semibold text-base px-6 py-3 rounded-xl hover:border-[#FFCC00] hover:bg-[#2A2A2A] transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Store className="w-5 h-5" />
                  Visit Shop Profile
                </button>

                {/* Book Now Button */}
                <button
                  onClick={() => onBook(service)}
                  className="w-full bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-bold text-lg px-6 py-4 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  Book This Service
                </button>
              </div>
              </div>
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === "reviews" && (
            <div>
              <ReviewList serviceId={service.serviceId} />
            </div>
          )}

          {/* Similar Services Section */}
          {activeTab === "details" && (
            <SimilarServices
              serviceId={service.serviceId}
              onBook={onBook}
              onViewDetails={handleViewSimilar}
              limit={6}
            />
          )}
        </div>
      </div>
    </div>
  );
};
