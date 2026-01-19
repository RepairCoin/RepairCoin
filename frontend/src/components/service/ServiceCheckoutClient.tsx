'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, Clock, MapPin, Star, Calendar, Loader2, AlertCircle, ShoppingCart } from 'lucide-react';
import { ShopServiceWithShopInfo } from '@/services/api/services';
import { useAuthStore } from '@/stores/authStore';
import { ServiceCheckoutModal } from '@/components/customer/ServiceCheckoutModal';
import { sanitizeDescription } from '@/utils/sanitize';

interface ServiceCheckoutClientProps {
  serviceId: string;
}

export const ServiceCheckoutClient: React.FC<ServiceCheckoutClientProps> = ({ serviceId }) => {
  const router = useRouter();
  const { isAuthenticated, userType } = useAuthStore();
  const [service, setService] = useState<ShopServiceWithShopInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    fetchServiceDetails();
  }, [serviceId]);

  const fetchServiceDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/services/${serviceId}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Service not found');
      }

      const data = await response.json();
      setService(data.data);
    } catch (err) {
      console.error('Error fetching service:', err);
      setError(err instanceof Error ? err.message : 'Failed to load service');
    } finally {
      setLoading(false);
    }
  };

  const handleBookNow = () => {
    // If customer is authenticated, show checkout modal
    if (isAuthenticated && userType === 'customer') {
      setShowCheckout(true);
    } else {
      // Redirect to marketplace with this service pre-selected
      router.push(`/customer/marketplace?service=${serviceId}`);
    }
  };

  const handleCheckoutSuccess = () => {
    setShowCheckout(false);
    // Redirect to orders page
    router.push('/customer/orders?success=true');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading service details...</p>
        </div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] flex items-center justify-center p-4">
        <div className="bg-[#101010] border border-gray-800 rounded-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Service Not Found</h1>
          <p className="text-gray-400 mb-6">
            {error || 'The service you\'re looking for doesn\'t exist or has been removed.'}
          </p>
          <button
            onClick={() => router.push('/customer/marketplace')}
            className="px-6 py-3 bg-[#FFCC00] hover:bg-[#e6b800] text-[#101010] font-semibold rounded-lg transition-colors"
          >
            Browse All Services
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Back to Marketplace Link */}
          <button
            onClick={() => router.push('/customer/marketplace')}
            className="text-[#FFCC00] hover:text-[#e6b800] mb-6 flex items-center gap-2 transition-colors"
          >
            ← Back to Marketplace
          </button>

          {/* Service Card */}
          <div className="bg-[#101010] border border-gray-800 rounded-xl overflow-hidden">
            {/* Service Image */}
            {service.imageUrl && (
              <div className="w-full h-80 overflow-hidden">
                <img
                  src={service.imageUrl}
                  alt={service.serviceName}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Service Details */}
            <div className="p-8">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-white mb-2">
                    {service.serviceName}
                  </h1>

                  {/* Shop Name */}
                  <div className="flex items-center gap-2 text-gray-400 mb-3">
                    <MapPin className="w-4 h-4" />
                    <span>{service.shopName}</span>
                  </div>

                  {/* Rating */}
                  {service.avgRating > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= Math.round(service.avgRating)
                                ? 'text-[#FFCC00] fill-[#FFCC00]'
                                : 'text-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-400">
                        ({service.reviewCount} reviews)
                      </span>
                    </div>
                  )}
                </div>

                {/* Price */}
                <div className="text-right">
                  <div className="flex items-center gap-2 text-3xl font-bold text-green-500">
                    <DollarSign className="w-8 h-8" />
                    {service.priceUsd.toFixed(2)}
                  </div>
                  <p className="text-sm text-gray-400 mt-1">USD</p>
                </div>
              </div>

              {/* Duration */}
              {service.durationMinutes && (
                <div className="flex items-center gap-2 text-gray-300 mb-6">
                  <Clock className="w-5 h-5" />
                  <span>{service.durationMinutes} minutes</span>
                </div>
              )}

              {/* Description */}
              {service.description && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-white mb-3">Description</h2>
                  <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {sanitizeDescription(service.description)}
                  </p>
                </div>
              )}

              {/* Group Rewards */}
              {service.groups && service.groups.length > 0 && (
                <div className="mb-8 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                  <h3 className="text-sm font-bold text-purple-300 uppercase mb-2">
                    🎁 Bonus Group Rewards
                  </h3>
                  <p className="text-sm text-purple-200">
                    Earn <span className="font-bold">{service.groups.map(g => g.customTokenSymbol).join(', ')}</span> tokens when you complete this service!
                  </p>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleBookNow}
                className="w-full py-4 bg-[#FFCC00] hover:bg-[#e6b800] text-[#101010] font-bold text-lg rounded-lg transition-colors flex items-center justify-center gap-3 shadow-lg"
              >
                <ShoppingCart className="w-6 h-6" />
                <span>Book Now</span>
              </button>

              {/* Info Text */}
              {!isAuthenticated && (
                <p className="text-center text-sm text-gray-400 mt-4">
                  You'll be redirected to connect your wallet and complete the booking
                </p>
              )}
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-8 bg-[#101010] border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">How it Works</h2>
            <div className="space-y-3 text-gray-300">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FFCC00] text-[#101010] flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <p>Click "Book Now" and connect your wallet</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FFCC00] text-[#101010] flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <p>Select your preferred date and time</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FFCC00] text-[#101010] flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <p>Complete payment to confirm your booking</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FFCC00] text-[#101010] flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <p>Earn RCN tokens when service is completed!</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && service && (
        <ServiceCheckoutModal
          service={service}
          onClose={() => setShowCheckout(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </>
  );
};
