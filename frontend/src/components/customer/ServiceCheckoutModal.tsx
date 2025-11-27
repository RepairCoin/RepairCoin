"use client";

import React, { useState, useEffect } from "react";
import { X, DollarSign, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { ShopServiceWithShopInfo } from "@/services/api/services";
import { createPaymentIntent } from "@/services/api/services";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";

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
  onSuccess: () => void;
  onError: (error: string) => void;
}> = ({ service, clientSecret, orderId, onSuccess, onError }) => {
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
        {processing ? "Processing..." : `Pay $${service.priceUsd.toFixed(2)}`}
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
  const [clientSecret, setClientSecret] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentInitialized, setPaymentInitialized] = useState(false);

  useEffect(() => {
    // Prevent duplicate payment intent creation
    if (paymentInitialized) return;

    // Create payment intent when modal opens
    const initializePayment = async () => {
      try {
        setPaymentInitialized(true);
        const response = await createPaymentIntent({
          serviceId: service.serviceId,
        });

        if (response) {
          setClientSecret(response.clientSecret);
          setOrderId(response.orderId);
        } else {
          setError("Failed to initialize payment. Please try again.");
          setPaymentInitialized(false); // Reset on error
        }
      } catch (err) {
        setError("Failed to initialize payment. Please try again.");
        setPaymentInitialized(false); // Reset on error
      } finally {
        setLoading(false);
      }
    };

    initializePayment();
  }, [service.serviceId, paymentInitialized]);

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
