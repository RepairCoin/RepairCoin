"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, DollarSign, Clock, CheckCircle, AlertCircle, Coins, Calendar, Ban } from "lucide-react";
import { ShopServiceWithShopInfo } from "@/services/api/services";
import { createPaymentIntent, getBookableLocations, BookableLocation } from "@/services/api/services";
import { getApiBaseUrl } from "@/utils/apiUrl";
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
  /**
   * Raw ISO 8601 slot string from the AI-suggested booking flow (Phase 3
   * Task 10): the customer taps a tap-to-book card in chat → route reads
   * ?suggestedSlotIso=... → passes the unmodified string here.
   *
   * Parsing is intentionally deferred to inside this modal, after the
   * shop's timezone is loaded via appointmentsApi.getTimeSlotConfig.
   * Without that timezone we cannot extract the date + HH:MM correctly:
   * a slot like "2026-05-15T18:25:00Z" represents 2:25 PM in a NYC shop
   * but 2:25 AM May 16 in a Manila customer's browser-local time. Using
   * the customer's local timezone here would land the picker on the
   * wrong date and miss the slot list entirely (the slot list comes from
   * the API in shop-tz HH:MM, so a local-tz HH:MM pre-fill matches
   * nothing on that wrong date).
   */
  initialBookingSlotIso?: string | null;
  /**
   * The AI chat conversation this booking came from, when the customer
   * arrived via an AI booking card. Sent through to createPaymentIntent so
   * the order row is linked to the conversation — that link drives the AI
   * "your appointment is confirmed" message posted after payment.
   */
  conversationId?: string | null;
}

/**
 * Extract { date, HH:MM } from an ISO slot string interpreted in the given
 * IANA timezone. Returns null when the ISO is malformed or formatToParts
 * fails to produce the expected fields (very old browsers / bogus tz name).
 *
 * The returned `bookingDate` is constructed via `new Date(year, month-1, day)`
 * so that subsequent `formatLocalDate(bookingDate)` (browser-local getters)
 * returns the same Y-M-D we extracted in shop tz. Downstream consumers
 * (TimeSlotPicker, formatLocalDate) read getDate/getMonth in browser-local
 * time, so the Date must be a "browser-local midnight on the shop-tz date".
 */
function parseSlotIsoInTimezone(
  slotIso: string,
  timeZone: string
): { bookingDate: Date; bookingTimeSlot: string } | null {
  const d = new Date(slotIso);
  if (Number.isNaN(d.getTime())) return null;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
  } catch {
    return null;
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const yearStr = get("year");
  const monthStr = get("month");
  const dayStr = get("day");
  let hourStr = get("hour");
  const minuteStr = get("minute");
  if (!yearStr || !monthStr || !dayStr || !hourStr || !minuteStr) return null;
  // Chrome / V8 quirk: hour12:false with 'en-US' sometimes yields "24" for
  // midnight instead of "00". Normalize.
  if (hourStr === "24") hourStr = "00";
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return {
    bookingDate: new Date(year, month - 1, day),
    bookingTimeSlot: `${hourStr}:${minuteStr}`,
  };
}

/**
 * Convert a wall-clock time (year, month0-indexed, day, hour, minute)
 * interpreted in the given IANA timezone into its UTC epoch milliseconds.
 *
 * `new Date(y, m, d, h, mi)` interprets the wall time in the BROWSER's
 * timezone. The booking slot's wall time is in the SHOP's timezone, so a
 * customer outside that timezone (e.g. a Manila customer booking a New York
 * shop, ~12h apart) miscounts the real lead time to the slot — which makes
 * the advance-notice check falsely reject perfectly valid slots. Anchoring
 * to the shop timezone fixes that.
 */
function zonedWallTimeToUtcMs(
  year: number,
  month0: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): number {
  // Naive: pretend the wall time is UTC, then correct by the tz offset.
  const naiveUtcMs = Date.UTC(year, month0, day, hour, minute, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(naiveUtcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  let h = get("hour");
  if (h === 24) h = 0; // some Intl impls emit 24 for midnight
  const tzWallAsUtcMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    h,
    get("minute"),
    get("second")
  );
  const offsetMs = tzWallAsUtcMs - naiveUtcMs;
  return naiveUtcMs - offsetMs;
}

// Inner form component that uses Stripe hooks
const CheckoutForm: React.FC<{
  service: ShopServiceWithShopInfo;
  clientSecret: string;
  orderId: string;
  finalAmount: number;
  connectedAccountId?: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}> = ({ service, clientSecret, orderId, finalAmount, connectedAccountId, onSuccess, onError }) => {
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
          const confirmResponse = await fetch(`${getApiBaseUrl()}/services/orders/confirm`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              paymentIntentId: result.paymentIntent.id,
              connectedAccountId
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
  initialBookingSlotIso = null,
  conversationId = null,
}) => {
  const { balanceData, fetchCustomerData } = useCustomerStore();
  const address = useAuthStore((state) => state.account?.address);
  const userProfile = useAuthStore((state) => state.userProfile);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");
  // Direct charge: the PaymentIntent lives on the shop's connected account, so Stripe.js must be
  // initialised against it to confirm the payment.
  const [connectedAccountId, setConnectedAccountId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentInitialized, setPaymentInitialized] = useState(false);

  // Booking Date & Time State. The AI-suggested-slot flow (Phase 3 Task 10)
  // pre-fills these from initialBookingSlotIso, but only after the shop's
  // timezone has loaded — see the effect below. Until then both stay null
  // and the customer's date/time pickers behave as in a non-suggested flow.
  const [bookingDate, setBookingDate] = useState<Date | null>(null);
  const [bookingTimeSlot, setBookingTimeSlot] = useState<string | null>(null);
  // Selected branch. Defaults to the primary (or first) location; only shown when the shop
  // exposes more than one bookable location. Fetched by shopId so it works regardless of how
  // this modal was opened (marketplace card, shop profile, dedicated checkout page).
  const [bookableLocations, setBookableLocations] = useState<BookableLocation[]>(service.locations ?? []);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getBookableLocations(service.shopId)
      .then((locs) => {
        if (!active) return;
        const list = locs.length ? locs : (service.locations ?? []);
        setBookableLocations(list);
        setSelectedLocationId(
          (prev) => prev ?? (list.find((l) => l.isPrimary)?.id ?? list[0]?.id ?? null)
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [service.shopId]);
  const [timeSlotConfig, setTimeSlotConfig] = useState<TimeSlotConfig | null>(null);
  // Guard so the AI-slot pre-fill only fires ONCE per modal mount. Without
  // this, any timeSlotConfig refetch would clobber the customer's manual
  // date/time edits with the original AI suggestion.
  const [suggestedSlotApplied, setSuggestedSlotApplied] = useState(false);

  // Apply the AI-suggested slot in the shop's timezone, once the shop's
  // timezone is known. The fix for the cross-timezone bug:
  // a slot like 2026-05-15T18:25Z (2:25 PM in a NYC shop) was previously
  // parsed in the customer's local tz, landing the picker on May 16 02:25
  // for a Manila customer and missing the picker's slot list entirely.
  // Now we parse in the shop's tz so the date matches what the card said.
  useEffect(() => {
    if (suggestedSlotApplied) return;
    if (!initialBookingSlotIso) return;
    const tz = timeSlotConfig?.timezone;
    if (!tz) return;
    const parsed = parseSlotIsoInTimezone(initialBookingSlotIso, tz);
    if (!parsed) {
      // Malformed ISO or unsupported timezone — silently skip the pre-fill.
      // Customer still sees the modal with empty pickers and can pick.
      setSuggestedSlotApplied(true);
      return;
    }
    setBookingDate(parsed.bookingDate);
    setBookingTimeSlot(parsed.bookingTimeSlot);
    setSuggestedSlotApplied(true);
  }, [initialBookingSlotIso, timeSlotConfig?.timezone, suggestedSlotApplied]);

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
  // Use address from account or userProfile (whichever loads first)
  const customerAddress = address || userProfile?.address;
  useEffect(() => {
    const loadNoShowStatus = async () => {
      if (!customerAddress) return;

      try {
        setLoadingNoShowStatus(true);
        const status = await getCustomerNoShowStatus(customerAddress, service.shopId);
        setNoShowStatus(status);
      } catch (error) {
        console.error('Error loading no-show status:', error);
        // Non-critical error, don't block booking
      } finally {
        setLoadingNoShowStatus(false);
      }
    };
    loadNoShowStatus();
  }, [customerAddress, service.shopId]);

  // RCN Redemption State
  const [rcnToRedeem, setRcnToRedeem] = useState(0);
  const [showRedemption, setShowRedemption] = useState(true);
  const customerBalance = balanceData?.availableBalance || 0;

  // Calculate discount and final amount with tier-based caps
  const RCN_TO_USD = 0.10;
  const MIN_SERVICE_PRICE = 10;

  // Determine max redeemable based on home shop, cross-shop limit, and no-show tier
  // Home shop: 100% of balance | Cross-shop: 20% of balance (matching backend VerificationService)
  const isHomeShop = noShowStatus?.isHomeShop === true;
  const isRestrictedTier = noShowStatus?.tier === 'caution' || noShowStatus?.tier === 'deposit_required';

  // Cross-shop limit: 20% of customer's balance (not service price)
  const crossShopMaxRcn = isHomeShop ? customerBalance : Math.floor(customerBalance * 0.20 * 100) / 100;

  // No-show tier cap: percentage of service price
  const tierCapPct = isRestrictedTier && noShowStatus?.maxRcnRedemptionPercent
    ? noShowStatus.maxRcnRedemptionPercent / 100
    : 1.00;
  const tierMaxRcn = Math.floor((service.priceUsd * tierCapPct) / RCN_TO_USD);

  // Service price cap: can't discount more than the service costs
  const servicePriceMaxRcn = Math.floor(service.priceUsd / RCN_TO_USD);

  const showRedemptionSection = service.priceUsd >= MIN_SERVICE_PRICE;
  const rcnDataReady = noShowStatus !== null && !loadingNoShowStatus && customerBalance >= 0 && !!customerAddress;
  const canUseRedemption = showRedemptionSection && customerBalance > 0 && rcnDataReady;
  const maxRcnRedeemable = customerBalance > 0 ? Math.floor(Math.min(crossShopMaxRcn, tierMaxRcn, servicePriceMaxRcn, customerBalance)) : 0;

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

    // Parse the booking time slot. TimeSlotPicker passes the raw API value
    // ("HH:MM" 24-hour) and the AI prefill (parseSlotIsoInTimezone) also
    // yields "HH:MM" — but tolerate a trailing "AM/PM" defensively.
    const [time, period] = bookingTimeSlot.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    let hour24 = hours;
    if (period === 'PM' && hours !== 12) hour24 += 12;
    if (period === 'AM' && hours === 12) hour24 = 0;

    // Anchor the slot's wall time to the SHOP timezone, not the browser's.
    // Without this, a customer outside the shop timezone miscounts the lead
    // time (a Manila customer booking a New York shop is off by ~12h) and a
    // valid slot is falsely rejected as "Booking Time Too Soon".
    const shopTz = timeSlotConfig?.timezone || 'America/New_York';
    const slotUtcMs = zonedWallTimeToUtcMs(
      bookingDate.getFullYear(),
      bookingDate.getMonth(),
      bookingDate.getDate(),
      hour24,
      minutes,
      shopTz
    );

    const hoursUntilBooking = (slotUtcMs - Date.now()) / (1000 * 60 * 60);

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
        locationId: selectedLocationId || undefined,
        conversationId: conversationId || undefined,
      });

      if (response) {
        setClientSecret(response.clientSecret);
        setOrderId(response.orderId);
        setConnectedAccountId(response.connectedAccountId);
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

  // Direct-charge bookings must confirm in the shop's Stripe account context — same publishable
  // key and same form, just scoped to the connected account. Falls back to the platform instance
  // if (unexpectedly) there's no connected account.
  const activeStripePromise = useMemo(() => {
    if (!connectedAccountId) return stripePromise;
    return loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "", {
      stripeAccount: connectedAccountId,
    });
  }, [connectedAccountId]);

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

              {/* Group Rewards Info - HIDDEN per client request */}
              {/* {service.groups && service.groups.length > 0 && (
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 mb-6">
                  <h3 className="text-sm font-bold text-purple-300 uppercase mb-2">
                    Bonus Group Rewards
                  </h3>
                  <div className="space-y-2">
                    {service.groups.map((group) => {
                      const isAvailable = group.available !== false;
                      const tokens = (group.estimatedTokens ?? service.priceUsd * (group.tokenRewardPercentage / 100) * group.bonusMultiplier).toFixed(1);
                      return (
                        <div key={group.groupId} className={`flex items-center justify-between text-sm ${!isAvailable ? 'opacity-50' : ''}`}>
                          <span className="text-purple-200 flex items-center gap-1.5">
                            <span>{group.icon || '🎁'}</span>
                            <span>{group.groupName}</span>
                          </span>
                          {isAvailable ? (
                            <span className="text-purple-300 font-bold">+{tokens} {group.customTokenSymbol}</span>
                          ) : (
                            <span className="text-gray-500 text-xs">Temporarily unavailable</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {service.groups.some(g => g.available === false) && (
                    <p className="text-xs text-gray-500 mt-2">
                      Some group tokens are temporarily unavailable due to shop allocation limits.
                    </p>
                  )}
                </div>
              )} */}

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

                  {/* Branch Picker — only when the shop offers more than one location */}
                  {bookableLocations.length > 1 && (
                    <div className="mb-6">
                      <label className="block text-xs font-medium text-gray-300 mb-2">
                        Choose a location
                      </label>
                      <select
                        value={selectedLocationId ?? ''}
                        onChange={(e) => setSelectedLocationId(e.target.value || null)}
                        className="w-full px-3 py-2 rounded-lg bg-[#0D0D0D] border border-gray-700 text-white focus:border-[#FFCC00] outline-none"
                      >
                        {bookableLocations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                            {[l.city, l.state].filter(Boolean).length
                              ? ` — ${[l.city, l.state].filter(Boolean).join(', ')}`
                              : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

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
                      locationId={selectedLocationId || undefined}
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
                      locationId={selectedLocationId || undefined}
                    />
                  )}
                </div>
              )}

              {/* RCN Redemption Section */}
              {showRedemptionSection && !paymentInitialized && !isSuspended && !rcnDataReady && (
                <div className="bg-[#0D0D0D] border border-gray-700 rounded-xl p-5 mb-6">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-gray-500" />
                    <span className="text-sm text-gray-400">Loading RCN rewards...</span>
                  </div>
                </div>
              )}

              {showRedemptionSection && !paymentInitialized && !isSuspended && rcnDataReady && (
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
                          <span>{maxRcnRedeemable} RCN{customerBalance > 0 ? ` (Max ${Math.min(isHomeShop ? 100 : 20, isRestrictedTier && noShowStatus?.maxRcnRedemptionPercent ? noShowStatus.maxRcnRedemptionPercent : 100)}%)` : ''}</span>
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
                  <Elements stripe={activeStripePromise} options={options}>
                    <CheckoutForm
                      service={service}
                      clientSecret={clientSecret}
                      orderId={orderId}
                      finalAmount={finalAmount}
                      connectedAccountId={connectedAccountId}
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
