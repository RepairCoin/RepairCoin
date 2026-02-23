"use client";

import React, { useState, useEffect } from "react";
import { X, DollarSign, Clock, CheckCircle, AlertCircle, Coins, Calendar, Ban } from "lucide-react";
import { ShopServiceWithShopInfo } from "@/services/api/services";
import { createPaymentIntent } from "@/services/api/services";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { useCustomerStore } from "@/stores/customerStore";
import { useAuthStore } from "@/stores/authStore";
import { TimeSlotPicker } from "./TimeSlotPicker";
import { DateAvailabilityPicker } from "./DateAvailabilityPicker";
import { formatLocalDate } from "@/utils/dateUtils";
import { appointmentsApi, TimeSlotConfig } from "@/services/api/appointments";
import { getCustomerNoShowStatus, CustomerNoShowStatus } from "@/services/api/noShow";

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
  const { balanceData, fetchCustomerData } = useCustomerStore();
  const { address } = useAuthStore();
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

  // No-Show Status State
  const [noShowStatus, setNoShowStatus] = useState<CustomerNoShowStatus | null>(null);
  const [loadingNoShowStatus, setLoadingNoShowStatus] = useState(false);

  // Fetch customer balance when modal opens
  useEffect(() => {
    if (address && !balanceData) {
      fetchCustomerData(address);
    }
  }, [address, balanceData, fetchCustomerData]);

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

  // Fetch no-show status when modal opens
  useEffect(() => {
    const loadNoShowStatus = async () => {
      if (!address) return;

      try {
        setLoadingNoShowStatus(true);
        const status = await getCustomerNoShowStatus(address, service.shopId);
        setNoShowStatus(status);
      } catch (error) {
        console.error('Error loading no-show status:', error);
        // Non-critical error, don't block booking
      } finally {
        setLoadingNoShowStatus(false);
      }
    };
    loadNoShowStatus();
  }, [address, service.shopId]);

  // RCN Redemption State
  const [rcnToRedeem, setRcnToRedeem] = useState(0);
  const [showRedemption, setShowRedemption] = useState(true);
  const customerBalance = balanceData?.availableBalance || 0;

  // Calculate discount and final amount with tier-based caps
  const RCN_TO_USD = 0.10;
  const MIN_SERVICE_PRICE = 10;

  // Determine max discount percentage based on tier
  // Tier 2 (caution) and Tier 3 (deposit_required) have 80% cap
  // Tier 0 (normal) and Tier 1 (warning) have 20% cap
  const isRestrictedTier = noShowStatus?.tier === 'caution' || noShowStatus?.tier === 'deposit_required';
  const MAX_DISCOUNT_PCT = isRestrictedTier ? 0.80 : 0.20;

  const showRedemptionSection = service.priceUsd >= MIN_SERVICE_PRICE;
  const canUseRedemption = showRedemptionSection && customerBalance > 0;
  const maxDiscountUsd = service.priceUsd * MAX_DISCOUNT_PCT;
  const maxRcnRedeemable = customerBalance > 0 ? Math.floor(Math.min(maxDiscountUsd / RCN_TO_USD, customerBalance)) : 0;

  const actualRcnRedeemed = Math.min(rcnToRedeem, maxRcnRedeemable);
  const discountUsd = actualRcnRedeemed * RCN_TO_USD;

  // Calculate deposit requirement
  const DEPOSIT_AMOUNT = 25.00;
  const requiresDeposit = noShowStatus?.tier === 'deposit_required';
  const depositAmount = requiresDeposit ? DEPOSIT_AMOUNT : 0;

  // Final amount includes service price (after discount) + deposit
  const serviceAmount = Math.max(service.priceUsd - discountUsd, 0);
  const finalAmount = serviceAmount + depositAmount;

  // Check if customer is suspended
  const isSuspended = noShowStatus?.tier === 'suspended' && !noShowStatus?.canBook;

  // Validate advance booking hours
  const validateAdvanceBooking = (): { isValid: boolean; error: string | null } => {
    if (!bookingDate || !bookingTimeSlot || !noShowStatus) {
      return { isValid: true, error: null };
    }

    const minimumHours = noShowStatus.minimumAdvanceHours;
    if (minimumHours === 0) {
      return { isValid: true, error: null };
    }

    // Parse the booking time slot (format: "HH:MM AM/PM")
    const [time, period] = bookingTimeSlot.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    let hour24 = hours;
    if (period === 'PM' && hours !== 12) hour24 += 12;
    if (period === 'AM' && hours === 12) hour24 = 0;

    const bookingDateTime = new Date(bookingDate);
    bookingDateTime.setHours(hour24, minutes, 0, 0);

    const now = new Date();
    const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilBooking < minimumHours) {
      return {
        isValid: false,
        error: `Your account requires booking at least ${minimumHours} hours in advance. Please select a later date/time.`
      };
    }

    return { isValid: true, error: null };
  };

  const advanceBookingValidation = validateAdvanceBooking();

  const handleInitializePayment = async () => {
    if (paymentInitialized) return;

    // Check advance booking validation
    if (!advanceBookingValidation.isValid) {
      setError(advanceBookingValidation.error || 'Invalid booking time');
      return;
    }

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

              {/* Suspension Warning - Block Booking */}
              {isSuspended && noShowStatus && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 mb-6">
                  <div className="flex items-start gap-4">
                    <Ban className="w-8 h-8 text-red-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-lg font-bold text-red-400 mb-2">Account Suspended</p>
                      <p className="text-sm text-gray-300 mb-3">
                        Your booking privileges have been suspended due to {noShowStatus.noShowCount} missed appointments.
                      </p>
                      {noShowStatus.bookingSuspendedUntil && (
                        <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-3 mb-3">
                          <p className="text-sm text-red-300">
                            <strong>Suspended Until:</strong>{' '}
                            {new Date(noShowStatus.bookingSuspendedUntil).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      )}
                      <div className="space-y-2">
                        {noShowStatus.restrictions.map((restriction, index) => (
                          <p key={index} className="text-xs text-gray-400">• {restriction}</p>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-3">
                        Please contact support if you believe this is an error.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tier Restriction Warning */}
              {!isSuspended && noShowStatus && (noShowStatus.tier === 'caution' || noShowStatus.tier === 'deposit_required') && (
                <div className={`border rounded-xl p-4 mb-6 ${
                  noShowStatus.tier === 'deposit_required'
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-orange-500/10 border-orange-500/30'
                }`}>
                  <div className="flex items-start gap-3">
                    <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      noShowStatus.tier === 'deposit_required' ? 'text-red-400' : 'text-orange-400'
                    }`} />
                    <div className="flex-1">
                      <p className={`text-sm font-semibold mb-2 ${
                        noShowStatus.tier === 'deposit_required' ? 'text-red-400' : 'text-orange-400'
                      }`}>
                        {noShowStatus.tier === 'deposit_required' ? 'Deposit Required - Account Restricted' : 'Account Restrictions Active'}
                      </p>
                      <p className="text-xs text-gray-300 mb-2">
                        Due to {noShowStatus.noShowCount} missed appointment{noShowStatus.noShowCount > 1 ? 's' : ''}, the following restrictions apply:
                      </p>
                      <div className="space-y-1">
                        {noShowStatus.restrictions.map((restriction, index) => (
                          <p key={index} className="text-xs text-gray-400">• {restriction}</p>
                        ))}
                      </div>
                      {noShowStatus.tier === 'deposit_required' && noShowStatus.successfulAppointmentsSinceTier3 !== undefined && (
                        <div className="mt-3 bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                          <p className="text-xs text-gray-400">
                            <strong className="text-white">Recovery Progress:</strong> {noShowStatus.successfulAppointmentsSinceTier3}/3 successful appointments
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Complete 3 successful appointments to restore your account.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Advance Booking Validation Error */}
              {!advanceBookingValidation.isValid && bookingDate && bookingTimeSlot && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-400">Booking Time Too Soon</p>
                      <p className="text-sm text-gray-300 mt-1">{advanceBookingValidation.error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Deposit Required Notice */}
              {requiresDeposit && !isSuspended && !paymentInitialized && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 mb-6">
                  <div className="flex items-start gap-3">
                    <DollarSign className="w-6 h-6 text-blue-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-400 mb-2">Refundable Deposit Required</p>
                      <p className="text-sm text-gray-300 mb-3">
                        A ${DEPOSIT_AMOUNT.toFixed(2)} refundable deposit is required due to your account status.
                      </p>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Service Price:</span>
                          <span className="text-white font-semibold">${serviceAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Refundable Deposit:</span>
                          <span className="text-blue-400 font-semibold">+${depositAmount.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-blue-500/20 pt-2 flex justify-between text-base">
                          <span className="text-white font-bold">Total Due Now:</span>
                          <span className="text-white font-bold">${finalAmount.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-400 space-y-1">
                        <p>✓ Deposit will be fully refunded when you attend your appointment</p>
                        <p>✓ Complete 3 successful appointments to remove deposit requirement</p>
                        {noShowStatus?.successfulAppointmentsSinceTier3 !== undefined && (
                          <p className="text-blue-400 font-semibold">
                            Progress: {noShowStatus.successfulAppointmentsSinceTier3}/3 successful appointments
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Appointment Scheduling Section */}
              {!paymentInitialized && !isSuspended && (
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
              {showRedemptionSection && !paymentInitialized && !isSuspended && (
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
                          <span>{maxRcnRedeemable} RCN (Max {(MAX_DISCOUNT_PCT * 100).toFixed(0)}%)</span>
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
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Service Price:</span>
                            <span className="text-white">${serviceAmount.toFixed(2)}</span>
                          </div>
                          {requiresDeposit && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Refundable Deposit:</span>
                              <span className="text-blue-400">+${depositAmount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-700">
                            <span className="text-white">Total Due:</span>
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
              {!paymentInitialized && !isSuspended && (
                <button
                  onClick={handleInitializePayment}
                  disabled={loading || !bookingDate || !bookingTimeSlot || !advanceBookingValidation.isValid}
                  className="w-full bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-bold text-lg px-6 py-4 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mb-6"
                >
                  {loading ? "Preparing..." : `Proceed to Payment - $${finalAmount.toFixed(2)}`}
                </button>
              )}

              {/* Suspended - Cannot Book */}
              {isSuspended && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6 text-center">
                  <Ban className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Booking unavailable due to suspension</p>
                </div>
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
