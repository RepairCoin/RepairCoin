"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Plus,
  Trash2,
  Star,
  AlertCircle,
  CheckCircle,
  Loader
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/services/api/client";
import { loadStripe, Stripe, StripeElements } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from "@stripe/react-stripe-js";

// Initialize Stripe
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  "pk_test_51QPPk7RwJwt4ptvDCH4FPnbRpSYRt02F6EbW89d0YUU8S2aZztLyKbI3SxoM66TJOg5v8TRqm3Y1xkUgYNsqPL8t00kOYCDOuF"
);

interface PaymentMethod {
  id: string;
  type: string;
  card: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
  isDefault: boolean;
  createdAt: string;
}

export const PaymentMethodsTab: React.FC = () => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/shops/payment-methods");

      if (response.data?.success) {
        setPaymentMethods(response.data.paymentMethods || []);
      }
    } catch (error: any) {
      console.error("Error loading payment methods:", error);
      toast.error(error.response?.data?.error || "Failed to load payment methods");
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      const response = await apiClient.post(
        `/shops/payment-methods/${paymentMethodId}/set-default`
      );

      if (response.data?.success) {
        toast.success("Default payment method updated");
        loadPaymentMethods();
      }
    } catch (error: any) {
      console.error("Error setting default payment method:", error);
      toast.error(error.response?.data?.error || "Failed to set default payment method");
    }
  };

  const handleDelete = async (paymentMethodId: string) => {
    if (!confirm("Are you sure you want to delete this payment method?")) {
      return;
    }

    try {
      const response = await apiClient.delete(`/shops/payment-methods/${paymentMethodId}`);

      if (response.data?.success) {
        toast.success("Payment method deleted");
        loadPaymentMethods();
      }
    } catch (error: any) {
      console.error("Error deleting payment method:", error);
      toast.error(error.response?.data?.error || "Failed to delete payment method");
    }
  };

  const getCardBrandIcon = (brand: string) => {
    const brandLower = brand.toLowerCase();

    // Return emoji or color for different card brands
    const brandColors: Record<string, string> = {
      visa: "text-blue-500",
      mastercard: "text-orange-500",
      amex: "text-blue-600",
      discover: "text-orange-600",
      diners: "text-blue-400",
      jcb: "text-red-500",
      unionpay: "text-red-600",
    };

    return brandColors[brandLower] || "text-gray-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Payment Methods</h2>
          <p className="text-gray-400 mt-1">
            Manage your saved payment methods for subscriptions
          </p>
        </div>
        <button
          onClick={() => setShowAddCard(true)}
          className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Card
        </button>
      </div>

      {/* Payment Methods List */}
      {paymentMethods.length === 0 ? (
        <div className="bg-gray-800/50 rounded-xl p-12 text-center border border-gray-700/50">
          <CreditCard className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No payment methods</h3>
          <p className="text-gray-400 mb-6">
            Add a payment method to manage your subscription and purchases
          </p>
          <button
            onClick={() => setShowAddCard(true)}
            className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Your First Card
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paymentMethods.map((pm) => (
            <div
              key={pm.id}
              className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border-2 transition-all ${
                pm.isDefault
                  ? "border-yellow-500 shadow-lg shadow-yellow-500/20"
                  : "border-gray-700/50 hover:border-gray-600"
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <CreditCard className={`w-8 h-8 ${pm.card ? getCardBrandIcon(pm.card.brand) : "text-gray-500"}`} />
                  <div>
                    <div className="text-white font-semibold capitalize">
                      {pm.card?.brand || pm.type}
                    </div>
                    {pm.isDefault && (
                      <div className="flex items-center gap-1 text-yellow-500 text-xs mt-1">
                        <Star className="w-3 h-3 fill-current" />
                        <span>Default</span>
                      </div>
                    )}
                  </div>
                </div>

                {!pm.isDefault && (
                  <button
                    onClick={() => handleDelete(pm.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Card Details */}
              {pm.card && (
                <div className="space-y-2 mb-4">
                  <div className="text-gray-300 text-lg tracking-wider font-mono">
                    •••• •••• •••• {pm.card.last4}
                  </div>
                  <div className="text-gray-400 text-sm">
                    Expires {String(pm.card.expMonth).padStart(2, "0")}/{pm.card.expYear}
                  </div>
                </div>
              )}

              {/* Actions */}
              {!pm.isDefault && (
                <button
                  onClick={() => handleSetDefault(pm.id)}
                  className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Set as Default
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Card Modal */}
      {showAddCard && (
        <Elements stripe={stripePromise}>
          <AddCardModal
            onClose={() => setShowAddCard(false)}
            onSuccess={() => {
              setShowAddCard(false);
              loadPaymentMethods();
            }}
          />
        </Elements>
      )}

      {/* Info Section */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300">
            <p className="font-medium mb-1">Secure Payment Processing</p>
            <p className="text-blue-400">
              Your payment information is securely processed by Stripe. We never store your full card details on our servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add Card Modal Component
const AddCardModal: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
}> = ({ onClose, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create setup intent
      const setupIntentResponse = await apiClient.post("/shops/payment-methods/setup-intent");

      if (!setupIntentResponse.data?.success || !setupIntentResponse.data?.clientSecret) {
        throw new Error("Failed to create setup intent");
      }

      const clientSecret = setupIntentResponse.data.clientSecret;

      // Confirm card setup
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Card element not found");
      }

      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (setupIntent?.payment_method) {
        // Set as default
        await apiClient.post(
          `/shops/payment-methods/${setupIntent.payment_method}/set-default`
        );
      }

      toast.success("Payment method added successfully");
      onSuccess();
    } catch (error: any) {
      console.error("Error adding payment method:", error);
      setError(error.response?.data?.error || error.message || "Failed to add payment method");
      toast.error(error.response?.data?.error || error.message || "Failed to add payment method");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
        <h3 className="text-xl font-bold text-white mb-4">Add Payment Method</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card Element */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: "16px",
                    color: "#fff",
                    "::placeholder": {
                      color: "#6b7280",
                    },
                  },
                  invalid: {
                    color: "#ef4444",
                  },
                },
              }}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Success Info */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-300">
              This card will be set as your default payment method for subscriptions
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={!stripe || loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Card"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
