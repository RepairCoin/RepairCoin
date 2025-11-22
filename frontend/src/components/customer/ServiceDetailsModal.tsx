"use client";

import React from "react";
import { X, DollarSign, Clock, MapPin, Phone, Mail, Image as ImageIcon, Tag } from "lucide-react";
import { ShopServiceWithShopInfo, SERVICE_CATEGORIES } from "@/services/api/services";

interface ServiceDetailsModalProps {
  service: ShopServiceWithShopInfo;
  onClose: () => void;
  onBook: (service: ShopServiceWithShopInfo) => void;
}

export const ServiceDetailsModal: React.FC<ServiceDetailsModalProps> = ({
  service,
  onClose,
  onBook,
}) => {
  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-[#1A1A1A] z-10">
          <h2 className="text-2xl font-bold text-white">Service Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
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

                {service.description && (
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-2">Description</h4>
                    <p className="text-sm text-gray-400">{service.description}</p>
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
      </div>
    </div>
  );
};
