"use client";

import React, { useState, useEffect } from "react";
import { X, DollarSign, Clock, CheckCircle, AlertCircle, Coins, Calendar } from "lucide-react";
import { ShopServiceWithShopInfo } from "@/services/api/services";
import { createPaymentIntent } from "@/services/api/services";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { useCustomerStore } from "@/stores/customerStore";
import { TimeSlotPicker } from "./TimeSlotPicker";
import { DateAvailabilityPicker } from "./DateAvailabilityPicker";
import { formatLocalDate } from "@/utils/dateUtils";
import { appointmentsApi, TimeSlotConfig } from "@/services/api/appointments";

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

interface ServiceCheckoutModalProps {
  service: ShopServiceWithShopInfo;
  onClose: () => void;
  onSuccess: () => void;
}

// Inner form component that uses Stripe hooks
const CheckoutForm: React.FC<{
  service: ShopServiceWithShopInfo;
  clientSecret: string;
  orderId: string;
  finalAmount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}> = ({ service, clientSecret, orderId, finalAmount, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent double submission
    if (hasSubmitted || processing) {
      return;
    }

    if (!stripe || !elements) {
      return;
    }

    // Validate that payment element is complete before submitting
    const {error: submitError} = await elements.submit();
    if (submitError) {
      setErrorMessage(submitError.message || "Please complete all required fields");
      return;
    }

    setHasSubmitted(true);
    setProcessing(true);
    setErrorMessage("");

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/customer/orders?success=true&orderId=${orderId}`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        setErrorMessage(result.error.message || "Payment failed");
        onError(result.error.message || "Payment failed");
        setProcessing(false);
        setHasSubmitted(false);
      } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        // Payment succeeded - now confirm on backend to update order status
        try {
          const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
          const confirmResponse = await fetch(`${backendUrl}/services/orders/confirm`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              paymentIntentId: result.paymentIntent.id
            })
          });

          if (!confirmResponse.ok) {
            throw new Error('Failed to confirm payment on server');
          }

          onSuccess();
        } catch (confirmError) {
          setErrorMessage("Payment succeeded but order update failed. Please contact support.");
          setProcessing(false);
          setHasSubmitted(false);
        }
      } else {
        setErrorMessage("Payment status unclear. Please contact support.");
        setProcessing(false);
        setHasSubmitted(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setErrorMessage(message);
      onError(message);
      setProcessing(false);
      setHasSubmitted(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      {/* Payment Element */}
      <div className="bg-[#0D0D0D] border border-gray-700 rounded-xl p-4">
        <PaymentElement
          options={{
            layout: 'tabs'
          }}
        />
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">Payment Failed</p>
            <p className="text-sm text-red-300 mt-1">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-bold text-lg px-6 py-4 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {processing ? "Processing..." : `Pay $${finalAmount.toFixed(2)}`}
      </button>

      {/* Security Notice */}
      <p className="text-xs text-gray-500 text-center">
        Your payment information is processed securely by Stripe. We never store your card details.
      </p>
    </form>
  );
};

// Main checkout modal component
export const ServiceCheckoutModal: React.FC<ServiceCheckoutModalProps> = ({
  service,
  onClose,
  onSuccess,
}) => {
  const { balanceData } = useCustomerStore();
  const [clientSecret, setClientSecret] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentInitialized, setPaymentInitialized] = useState(false);

  // Booking Date & Time State
  const [bookingDate, setBookingDate] = useState<Date | null>(null);
  const [bookingTimeSlot, setBookingTimeSlot] = useState<string | null>(null);
  const [timeSlotConfig, setTimeSlotConfig] = useState<TimeSlotConfig | null>(null);

  // Load shop's time slot configuration for booking advance days
  useEffect(() => {
    const loadTimeSlotConfig = async () => {
      try {
        const config = await appointmentsApi.getPublicTimeSlotConfig(service.shopId);
        setTimeSlotConfig(config);
      } catch (error) {
        console.error('Error loading time slot config:', error);
      }
    };
    loadTimeSlotConfig();
  }, [service.shopId]);

  // RCN Redemption State
  const [rcnToRedeem, setRcnToRedeem] = useState(0);
  const [showRedemption, setShowRedemption] = useState(true);
  const customerBalance = balanceData?.availableBalance || 0;

  // Calculate discount and final amount
  const RCN_TO_USD = 0.10;
  const MAX_DISCOUNT_PCT = 0.20; // 20% cap
  const MIN_SERVICE_PRICE = 10;

  const showRedemptionSection = service.priceUsd >= MIN_SERVICE_PRICE;
  const canUseRedemption = showRedemptionSection && customerBalance > 0;
  const maxDiscountUsd = service.priceUsd * MAX_DISCOUNT_PCT;
  const maxRcnRedeemable = customerBalance > 0 ? Math.floor(Math.min(maxDiscountUsd / RCN_TO_USD, customerBalance)) : 0;

  const actualRcnRedeemed = Math.min(rcnToRedeem, maxRcnRedeemable);
  const discountUsd = actualRcnRedeemed * RCN_TO_USD;
  const finalAmount = Math.max(service.priceUsd - discountUsd, 0);

  const handleInitializePayment = async () => {
    if (paymentInitialized) return;

    try {
      setLoading(true);
      setPaymentInitialized(true);

      const response = await createPaymentIntent({
        serviceId: service.serviceId,
        bookingDate: bookingDate ? formatLocalDate(bookingDate) : undefined,
        bookingTime: bookingTimeSlot || undefined,
        rcnToRedeem: actualRcnRedeemed > 0 ? actualRcnRedeemed : undefined,
      });

      if (response) {
        setClientSecret(response.clientSecret);
        setOrderId(response.orderId);
      } else {
        setError("Failed to initialize payment. Please try again.");
        setPaymentInitialized(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize payment. Please try again.");
      setPaymentInitialized(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    setTimeout(() => {
      onSuccess();
      onClose();
    }, 2000);
  };

  const handlePaymentError = (errorMsg: string) => {
    setError(errorMsg);
  };

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: "night",
      variables: {
        colorPrimary: "#FFCC00",
        colorBackground: "#0D0D0D",
        colorText: "#ffffff",
        colorDanger: "#ef4444",
        fontFamily: "system-ui, sans-serif",
        borderRadius: "12px",
      },
    },
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #FFCC00;
          cursor: pointer;
          border: 3px solid #1A1A1A;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #FFCC00;
          cursor: pointer;
          border: 3px solid #1A1A1A;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
      `}</style>
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-[#1A1A1A] z-10">
          <h2 className="text-2xl font-bold text-white">Complete Your Booking</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={paymentSuccess}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Success Message */}
          {paymentSuccess && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 flex items-center gap-4 mb-6">
              <CheckCircle className="w-12 h-12 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-lg font-bold text-green-400">Payment Successful!</p>
                <p className="text-sm text-gray-400 mt-1">
                  Your booking has been confirmed. Redirecting...
                </p>
              </div>
            </div>
          )}

          {/* Service Summary */}
          {!paymentSuccess && (
            <>
              <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-5 mb-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Booking Summary</h3>

                <div className="flex items-start gap-4">
                  {service.imageUrl ? (
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                      <img
                        src={service.imageUrl}
                        alt={service.serviceName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex-shrink-0" />
                  )}

                  <div className="flex-1">
                    <h4 className="font-bold text-white mb-1">{service.serviceName}</h4>
                    <p className="text-sm text-gray-400 mb-2">{service.companyName}</p>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-green-500">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-bold">{service.priceUsd.toFixed(2)}</span>
                      </div>
                      {service.durationMinutes && (
                        <div className="flex items-center gap-1 text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span>{service.durationMinutes} min</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Appointment Scheduling Section */}
              {!paymentInitialized && (
                <div className="bg-[#0D0D0D] border border-[#FFCC00]/30 rounded-xl p-5 mb-6">
                  <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#FFCC00]" />
                    Schedule Your Appointment
                    <span className="text-xs bg-[#FFCC00]/20 text-[#FFCC00] px-2 py-0.5 rounded-full ml-auto">
                      Required
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Select a date and time for your service appointment
                  </p>

                  {/* Date Picker */}
                  <div className="mb-6">
                    <DateAvailabilityPicker
                      shopId={service.shopId}
                      selectedDate={bookingDate}
                      onDateSelect={(date) => {
                        setBookingDate(date);
                        setBookingTimeSlot(null); // Reset time slot when date changes
                      }}
                      maxAdvanceDays={timeSlotConfig?.bookingAdvanceDays || 30}
                      minBookingHours={timeSlotConfig?.minBookingHours || 0}
                      allowWeekendBooking={timeSlotConfig?.allowWeekendBooking ?? true}
                    />
                  </div>

                  {/* Time Slot Picker */}
                  {bookingDate && (
                    <TimeSlotPicker
                      shopId={service.shopId}
                      serviceId={service.serviceId}
                      selectedDate={bookingDate}
                      selectedTimeSlot={bookingTimeSlot}
                      onTimeSlotSelect={setBookingTimeSlot}
                      shopTimezone={timeSlotConfig?.timezone || 'America/New_York'}
                    />
                  )}
                </div>
              )}

              {/* RCN Redemption Section */}
              {showRedemptionSection && !paymentInitialized && (
                <div className="bg-[#0D0D0D] border border-[#FFCC00]/30 rounded-xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Coins className="w-5 h-5 text-[#FFCC00]" />
                      <h3 className="text-sm font-semibold text-white">Use RCN for Discount</h3>
                    </div>
                    <button
                      onClick={() => setShowRedemption(!showRedemption)}
                      className="text-xs text-[#FFCC00] hover:text-[#FFD700] transition-colors"
                    >
                      {showRedemption ? "Hide" : "Show"}
                    </button>
                  </div>

                  <div className="text-xs text-gray-400 mb-3">
                    Balance: <span className={`font-semibold ${customerBalance > 0 ? 'text-[#FFCC00]' : 'text-gray-500'}`}>
                      {customerBalance.toFixed(0)} RCN
                    </span>
                    {" "}(${ (customerBalance * RCN_TO_USD).toFixed(2)})
                  </div>

                  {customerBalance === 0 && (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-3">
                      <p className="text-xs text-gray-400">
                        💰 Complete services to earn RCN and unlock discounts!
                      </p>
                    </div>
                  )}

                  {showRedemption && (
                    <div className="space-y-4">
                      {/* Slider */}
                      <div className={customerBalance === 0 ? 'opacity-50 pointer-events-none' : ''}>
                        <input
                          type="range"
                          min="0"
                          max={maxRcnRedeemable || 100}
                          step="1"
                          value={rcnToRedeem}
                          onChange={(e) => setRcnToRedeem(Number(e.target.value))}
                          disabled={customerBalance === 0}
                          className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: maxRcnRedeemable > 0
                              ? `linear-gradient(to right, #FFCC00 0%, #FFCC00 ${(rcnToRedeem / maxRcnRedeemable) * 100}%, #374151 ${(rcnToRedeem / maxRcnRedeemable) * 100}%, #374151 100%)`
                              : '#374151'
                          }}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>0 RCN</span>
                          <span>{maxRcnRedeemable} RCN (Max 20%)</span>
                        </div>
                      </div>

                      {/* Redemption Details */}
                      {actualRcnRedeemed > 0 && (
                        <div className="bg-[#1A1A1A] border border-gray-700 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Redeeming:</span>
                            <span className="text-[#FFCC00] font-semibold">{actualRcnRedeemed} RCN</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Discount:</span>
                            <span className="text-green-500 font-semibold">-${discountUsd.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm pt-2 border-t border-gray-700">
                            <span className="text-gray-400">Original Price:</span>
                            <span className="text-gray-400 line-through">${service.priceUsd.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-base font-bold">
                            <span className="text-white">Final Price:</span>
                            <span className="text-[#FFCC00]">${finalAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Remaining Balance:</span>
                            <span className="text-gray-500">{(customerBalance - actualRcnRedeemed).toFixed(0)} RCN</span>
                          </div>
                        </div>
                      )}

                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                        <p className="text-xs text-blue-300">
                          💡 You'll earn RCN on the full ${service.priceUsd.toFixed(2)} service price when completed!
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Warning if service price too low */}
              {service.priceUsd < MIN_SERVICE_PRICE && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
                  <p className="text-sm text-yellow-300">
                    💡 RCN redemption is available for services ${MIN_SERVICE_PRICE} and above.
                  </p>
                </div>
              )}

              {/* Appointment Required Notice */}
              {!paymentInitialized && (!bookingDate || !bookingTimeSlot) && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-400">Appointment Required</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Please select a date and time slot for your appointment before proceeding to payment.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Proceed to Payment Button */}
              {!paymentInitialized && (
                <button
                  onClick={handleInitializePayment}
                  disabled={loading || !bookingDate || !bookingTimeSlot}
                  className="w-full bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-bold text-lg px-6 py-4 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mb-6"
                >
                  {loading ? "Preparing..." : `Proceed to Payment - $${finalAmount.toFixed(2)}`}
                </button>
              )}

              {/* Payment Form */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto mb-4"></div>
                    <p className="text-white">Preparing payment...</p>
                  </div>
                </div>
              )}

              {error && !clientSecret && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-400">Error</p>
                    <p className="text-sm text-red-300 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {clientSecret && !loading && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Payment Information</h3>
                  <Elements stripe={stripePromise} options={options}>
                    <CheckoutForm
                      service={service}
                      clientSecret={clientSecret}
                      orderId={orderId}
                      finalAmount={finalAmount}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                  </Elements>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
