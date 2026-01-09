"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  CreditCard,
  Calendar,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import apiClient from "@/services/api/client";
import { CountryPhoneInput } from "../ui/CountryPhoneInput";
import { useNotificationStore } from "@/stores/notificationStore";

interface Subscription {
  id?: number;
  shopId: string;
  status: "pending" | "active" | "cancelled" | "paused" | "defaulted";
  monthlyAmount: number;
  subscriptionType: string;
  billingMethod?: "credit_card" | "ach" | "wire" | "crypto";
  billingReference?: string;
  paymentsMade: number;
  totalPaid: number;
  nextPaymentDate?: string;
  lastPaymentDate?: string;
  isActive?: boolean;
  enrolledAt: string;
  activatedAt?: string;
  cancelledAt?: string;
  pausedAt?: string;
  resumedAt?: string;
  cancellationReason?: string;
  pauseReason?: string;
  notes?: string;
  createdBy?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
  termMonths?: number;
  totalCommitment?: number;
}

interface SubscriptionManagementProps {
  shopId: string;
  shopWallet?: string;
  isSuspended?: boolean;
  isPaused?: boolean;
}

export const SubscriptionManagement: React.FC<SubscriptionManagementProps> = ({
  shopId,
  shopWallet,
  isSuspended = false,
  isPaused = false,
}) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [billingForm, setBillingForm] = useState({
    billingEmail: "",
    billingContact: "",
    billingPhone: "",
  });

  // Get notifications from the store for real-time updates
  const { notifications } = useNotificationStore();
  const lastNotificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadSubscriptionStatus();

    // Prefill form with shop data if available
    const shopData = JSON.parse(localStorage.getItem("shopData") || "{}");
    if (shopData) {
      setBillingForm((prev) => ({
        ...prev,
        billingEmail: shopData.email || "",
        billingContact:
          `${shopData.firstName || ""} ${shopData.lastName || ""}`.trim() ||
          shopData.ownerName ||
          "",
        billingPhone: shopData.phoneNumber || "",
      }));
    }
  }, [shopId]);

  // Listen for subscription-related notifications and auto-refresh
  useEffect(() => {
    const latestNotification = notifications[0];
    if (!latestNotification) return;

    // Check if this is a new notification we haven't processed
    if (latestNotification.id === lastNotificationIdRef.current) return;

    // Skip if an operation is in progress (prevents modal flicker from double refresh)
    if (cancelling || reactivating) {
      console.log('📋 Skipping notification refresh - operation in progress');
      lastNotificationIdRef.current = latestNotification.id;
      return;
    }

    // Check if it's a subscription-related notification
    const subscriptionNotificationTypes = [
      'subscription_cancelled',
      'subscription_self_cancelled',
      'subscription_paused',
      'subscription_resumed',
      'subscription_reactivated'
    ];

    if (subscriptionNotificationTypes.includes(latestNotification.notificationType)) {
      console.log('📋 Subscription notification received, refreshing subscription status...', {
        type: latestNotification.notificationType,
        id: latestNotification.id
      });
      lastNotificationIdRef.current = latestNotification.id;
      loadSubscriptionStatus();
    }
  }, [notifications, cancelling, reactivating]);

  const loadSubscriptionStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get("/shops/subscription/status");

      if (!response.success) {
        console.error("Subscription status error:", response);
        throw new Error(response.error || "Failed to load subscription status");
      }

      const result = response;
      if (result.success && result.data.currentSubscription) {
        const sub = result.data.currentSubscription;
        setSubscription({
          ...sub,
          // Map backend fields to frontend interface
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          currentPeriodEnd: sub.currentPeriodEnd || sub.nextPaymentDate,
        });
        console.log(
          "✅ SUBSCRIPTION STATUS: TRUE - Active subscription found:",
          {
            subscriptionId: sub.id,
            status: sub.status,
            subscriptionType: sub.subscriptionType,
            monthlyAmount: sub.monthlyAmount,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            currentPeriodEnd: sub.currentPeriodEnd,
          }
        );
      } else {
        console.log(
          "❌ SUBSCRIPTION STATUS: FALSE - No active subscription found"
        );
      }
    } catch (error) {
      console.error("Error loading subscription:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load subscription"
      );
    } finally {
      setLoading(false);
    }
  };

  const syncSubscription = async () => {
    try {
      setSyncing(true);
      setError(null);

      const response = await apiClient.post("/shops/subscription/sync");

      if (!response.success) {
        throw new Error(response.error || "Failed to sync subscription");
      }

      const result = response;
      if (result.data?.synced) {
        setSuccessMessage("Subscription synced successfully!");
        // Reload subscription status
        await loadSubscriptionStatus();
      } else {
        setError(result.message || "No new subscription to sync");
      }
    } catch (error) {
      console.error("Error syncing subscription:", error);
      setError(
        error instanceof Error ? error.message : "Failed to sync subscription"
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      setSubscribing(true);
      setError(null);

      // Validate form
      if (!billingForm.billingEmail || !billingForm.billingContact) {
        setError("Please fill in all required fields");
        setSubscribing(false);
        return;
      }

      const result = await apiClient.post("/shops/subscription/subscribe", {
        billingMethod: "credit_card", // Always credit card now
        billingEmail: billingForm.billingEmail,
        billingContact: billingForm.billingContact,
        billingPhone: billingForm.billingPhone,
        notes: "Monthly subscription enrollment",
      });

      // If we get a successful response, check if it's because of existing pending subscription
      if (!result.success && result.error) {
        throw new Error(result.error);
      }

      // Update subscription state with the enrollment data
      if (result.data.enrollment) {
        setSubscription({
          ...result.data.enrollment,
          subscriptionType: "monthly_subscription",
        });
      }
      setShowSubscribeModal(false);

      // Handle pending subscription resume
      if (result.data.isPendingResume) {
        setSuccessMessage(result.data.message);
        // Redirect to payment page for pending subscriptions
        if (result.data.paymentUrl) {
          setTimeout(() => {
            window.location.href = result.data.paymentUrl;
          }, 2000);
        }
      } else if (result.data.paymentUrl) {
        // Handle payment redirect for new subscriptions
        setSuccessMessage("Redirecting to secure payment...");
        setTimeout(() => {
          window.location.href = result.data.paymentUrl;
        }, 1500);
      } else {
        // Show success message
        setSuccessMessage(result.data.nextSteps || result.data.message);
        setTimeout(() => setSuccessMessage(null), 10000);
      }
    } catch (error) {
      console.error("Error subscribing:", error);
      setError(error instanceof Error ? error.message : "Failed to subscribe");
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancel = async () => {
    try {
      setCancelling(true);
      setError(null);

      const result = await apiClient.post("/shops/subscription/cancel", {
        reason: cancellationReason || "Cancelled by shop owner",
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to cancel subscription");
      }

      setShowCancelModal(false);
      setCancellationReason("");

      // Show success message
      setSuccessMessage(
        result.data.message ||
          "Subscription cancelled successfully. You can resubscribe at any time."
      );

      // Clear success message after 10 seconds
      setTimeout(() => setSuccessMessage(null), 10000);

      // Reload to ensure we have the latest status with properly formatted data
      await loadSubscriptionStatus();
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      setError(
        error instanceof Error ? error.message : "Failed to cancel subscription"
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivate = async () => {
    try {
      setReactivating(true);
      setError(null);

      const result = await apiClient.post("/shops/subscription/reactivate");

      if (!result.success) {
        throw new Error(result.error || "Failed to reactivate subscription");
      }

      setShowReactivateModal(false);

      // Show success message
      setSuccessMessage(
        result.data.message ||
          "Subscription reactivated successfully! Your subscription will continue as normal."
      );

      // Clear success message after 10 seconds
      setTimeout(() => setSuccessMessage(null), 10000);

      // Reload to ensure we have the latest status with properly formatted data
      await loadSubscriptionStatus();
    } catch (error) {
      console.error("Error reactivating subscription:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to reactivate subscription"
      );
    } finally {
      setReactivating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#212121] rounded-2xl shadow-xl p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#212121] rounded-2xl shadow-xl p-6">
      <h3 className="text-2xl font-bold text-[#FFCC00] mb-6">
        Monthly Subscription
      </h3>

      {successMessage && (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p className="text-green-300">{successMessage}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-300">{error}</p>
          </div>
        </div>
      )}

      {subscription && subscription.status === "active" ? (
        <div className="space-y-6">
          {/* Subscription Status Banner */}
          {/* When suspended, always show normal active view - cancellation warning is irrelevant */}
          {!isSuspended && subscription.cancelAtPeriodEnd ? (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-yellow-400" />
                  <div>
                    <h4 className="text-lg font-semibold text-yellow-400">
                      Subscription Ending
                    </h4>
                    <p className="text-sm text-gray-400">
                      Your subscription will end on{" "}
                      {subscription.currentPeriodEnd
                        ? new Date(
                            subscription.currentPeriodEnd
                          ).toLocaleDateString()
                        : "end of billing period"}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
                  Cancelling
                </span>
              </div>
              <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-300">
                  <strong>What happens when your subscription ends:</strong>
                </p>
                <ul className="mt-2 space-y-1 text-sm text-gray-400">
                  <li>• You won't be able to issue RCN rewards</li>
                  <li>• You won't be able to process redemptions</li>
                  <li>• Your shop will lose operational status</li>
                  <li>• You can resubscribe anytime to restore access</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <div>
                    <h4 className="text-lg font-semibold text-green-400">
                      Active Subscription
                    </h4>
                    <p className="text-sm text-gray-400">
                      Your shop is operationally qualified
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                  Active
                </span>
              </div>
            </div>
          )}

          {/* Subscription Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">Monthly Fee</span>
              </div>
              <p className="text-xl font-bold text-white">
                ${subscription.monthlyAmount}/mo
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">Payments Made</span>
              </div>
              <p className="text-xl font-bold text-white">
                {subscription.paymentsMade}
              </p>
              <p className="text-sm text-gray-500">
                ${subscription.totalPaid} total
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">
                  {subscription.cancelAtPeriodEnd
                    ? "Subscription Ends"
                    : "Next Payment"}
                </span>
              </div>
              <p className="text-xl font-bold text-white">
                {subscription.cancelAtPeriodEnd
                  ? subscription.currentPeriodEnd
                    ? new Date(
                        subscription.currentPeriodEnd
                      ).toLocaleDateString()
                    : new Date(
                        subscription.nextPaymentDate || ""
                      ).toLocaleDateString()
                  : subscription.nextPaymentDate
                  ? new Date(subscription.nextPaymentDate).toLocaleDateString()
                  : "Not scheduled"}
              </p>
            </div>
          </div>

          {/* Cancel/Reactivate Button - Hidden for suspended/paused shops */}
          {!isSuspended && !isPaused && (
            <div className="pt-4 border-t border-gray-700">
              {subscription.cancelAtPeriodEnd ? (
                <div>
                  <Button
                    onClick={() => setShowReactivateModal(true)}
                    className="bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold"
                  >
                    Reactivate Subscription
                  </Button>
                  <p className="text-sm text-gray-400 mt-2">
                    Changed your mind? Reactivate to keep your subscription after{" "}
                    {subscription.currentPeriodEnd
                      ? new Date(
                          subscription.currentPeriodEnd
                        ).toLocaleDateString()
                      : "the current period"}
                    .
                  </p>
                </div>
              ) : (
                <div>
                  <Button
                    onClick={() => setShowCancelModal(true)}
                    variant="destructive"
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors
  font-medium flex items-center justify-center gap-2"
                  >
                    Cancel Subscription
                  </Button>
                  <p className="text-sm text-gray-400 mt-2">
                    You can cancel anytime and resubscribe when needed.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : subscription && subscription.status === "paused" ? (
        <div className="space-y-6">
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-blue-400" />
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-blue-400">
                  Subscription Paused
                </h4>
                <p className="text-sm text-gray-300 mt-1">
                  Your subscription has been temporarily paused by the
                  administrator.
                </p>
              </div>
            </div>
          </div>

          {/* What this means */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-white mb-4">
              What This Means
            </h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">Limited Operations</p>
                  <p className="text-sm text-gray-400">
                    You cannot issue rewards or process redemptions while paused
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">Billing Paused</p>
                  <p className="text-sm text-gray-400">
                    You will not be charged while your subscription is paused
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">
                    Subscription Retained
                  </p>
                  <p className="text-sm text-gray-400">
                    Your subscription details and history are preserved
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Subscription Details */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-white mb-4">
              Subscription Details
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Monthly Amount:</span>
                <span className="text-white font-medium">
                  ${subscription.monthlyAmount}/mo
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
                  Paused
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Paused On:</span>
                <span className="text-white font-medium">
                  {subscription.pausedAt
                    ? new Date(subscription.pausedAt).toLocaleDateString()
                    : "Recently"}
                </span>
              </div>
              {subscription.pauseReason && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Reason:</span>
                  <span className="text-white font-medium">
                    {subscription.pauseReason}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Contact Admin */}
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-yellow-400 mb-2">
              Need Help?
            </h4>
            <p className="text-sm text-gray-300 mb-3">
              Your subscription has been paused by the administrator. Please
              contact support to resolve any issues or have your subscription
              resumed.
            </p>
            {/*  <div className="flex gap-3">
              <Button
                onClick={syncSubscription}
                variant="outline"
                disabled={syncing}
                className="border-yellow-600 text-yellow-300 hover:bg-yellow-700 hover:text-white"
              >
                {syncing ? 'Syncing...' : 'Check Status'}
              </Button>
            </div> */}
          </div>
        </div>
      ) : subscription && subscription.status === "pending" ? (
        <div className="space-y-6">
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-400" />
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-yellow-400">
                  Subscription Pending
                </h4>
                <p className="text-sm text-gray-300 mt-1">
                  Your subscription request has been submitted. Please complete
                  the payment setup to activate your subscription.
                </p>
              </div>
            </div>
          </div>

          {/* Subscription Details */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-white mb-4">
              Subscription Details
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Monthly Amount:</span>
                <span className="text-white font-medium">
                  ${subscription.monthlyAmount}/mo
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Term:</span>
                <span className="text-white font-medium">
                  {subscription.termMonths || 6} months
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Commitment:</span>
                <span className="text-white font-medium">
                  $
                  {subscription.totalCommitment ||
                    subscription.monthlyAmount * 6}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Payment Method:</span>
                <span className="text-white font-medium">Credit Card</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => {
                const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/shop/subscription/payment/${subscription.id}`;
                window.location.href = paymentUrl;
              }}
              className="bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold"
            >
              Complete Payment Setup
            </Button>
            <Button
              onClick={() => setShowCancelModal(true)}
              variant="outline"
              className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
            >
              Cancel Subscription Request
            </Button>
          </div>
        </div>
      ) : subscription && subscription.status === "cancelled" ? (
        <div className="space-y-6">
          {/* Cancelled Subscription - Check if still within access period */}
          {subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) > new Date() ? (
            <>
              {/* Still has access until period end */}
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-yellow-400" />
                    <div>
                      <h4 className="text-lg font-semibold text-yellow-400">
                        Subscription Cancelled
                      </h4>
                      <p className="text-sm text-gray-300 mt-1">
                        You still have <strong>full access</strong> until{" "}
                        {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
                    Access Until {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Good News - Current Access Info */}
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <p className="text-blue-300">
                  <strong className="text-blue-400">Good news:</strong> You retain{" "}
                  <strong>full platform access</strong> until{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
                  During this period, you can continue to issue rewards, process
                  redemptions, and manage your services as normal.
                </p>
              </div>

              {/* What happens after */}
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                <h4 className="font-semibold text-red-400 mb-3">
                  After {new Date(subscription.currentPeriodEnd).toLocaleDateString()}, you will no longer be able to:
                </h4>
                <ul className="space-y-2 text-sm text-red-300">
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                    <span>Issue RCN rewards to customers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                    <span>Process customer redemptions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                    <span>Manage services in the marketplace</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                    <span>Look up customer information</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                    <span>Purchase RCN tokens</span>
                  </li>
                </ul>
                <p className="mt-3 text-sm text-gray-400 italic">
                  Note: You will still be able to view your purchase history and limited analytics.
                </p>
              </div>

              {/* Subscription Details */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-white mb-4">
                  Subscription Details
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Monthly Amount:</span>
                    <span className="text-white font-medium">
                      ${subscription.monthlyAmount}/mo
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cancelled On:</span>
                    <span className="text-white font-medium">
                      {subscription.cancelledAt
                        ? new Date(subscription.cancelledAt).toLocaleDateString()
                        : "Recently"}
                    </span>
                  </div>
                  {subscription.cancellationReason && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Reason:</span>
                      <span className="text-white font-medium">
                        {subscription.cancellationReason}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Full Access Until:</span>
                    <span className="text-yellow-400 font-medium">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Paid:</span>
                    <span className="text-white font-medium">
                      ${subscription.totalPaid}
                    </span>
                  </div>
                </div>
              </div>

              {/* Resubscribe CTA - subscription is cancelled, need to create new subscription */}
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                <h4 className="font-semibold text-green-400 mb-2">
                  Changed your mind?
                </h4>
                <p className="text-gray-300 mb-4">
                  You can resubscribe before your access ends to continue
                  using RepairCoin without interruption.
                </p>
                <Button
                  onClick={() => setShowSubscribeModal(true)}
                  className="bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold"
                >
                  Resubscribe Now
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* No access - subscription fully ended */}
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="w-6 h-6 text-red-400" />
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-red-400">
                      Subscription Cancelled
                    </h4>
                    <p className="text-sm text-gray-300 mt-1">
                      Your subscription has ended and platform features are no longer accessible.
                    </p>
                  </div>
                </div>
              </div>

              {/* What you cannot do */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-white mb-4">
                  Features No Longer Available
                </h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                    <span>Issue RCN rewards to customers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                    <span>Process customer redemptions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                    <span>Manage services in the marketplace</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                    <span>Look up customer information</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                    <span>Purchase RCN tokens</span>
                  </li>
                </ul>
                <p className="mt-4 text-sm text-gray-500 italic">
                  You can still view your purchase history and limited analytics.
                </p>
              </div>

              {/* Subscription Details */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-white mb-4">
                  Previous Subscription
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Monthly Amount:</span>
                    <span className="text-white font-medium">
                      ${subscription.monthlyAmount}/mo
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cancelled On:</span>
                    <span className="text-white font-medium">
                      {subscription.cancelledAt
                        ? new Date(subscription.cancelledAt).toLocaleDateString()
                        : "Recently"}
                    </span>
                  </div>
                  {subscription.cancellationReason && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Reason:</span>
                      <span className="text-white font-medium">
                        {subscription.cancellationReason}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Paid:</span>
                    <span className="text-white font-medium">
                      ${subscription.totalPaid}
                    </span>
                  </div>
                </div>
              </div>

              {/* Resubscribe Section */}
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                <h4 className="font-semibold text-green-400 mb-2">
                  Want to continue using RepairCoin?
                </h4>
                <p className="text-gray-300 mb-4">
                  You can resubscribe at any time by clicking the button below.
                  Alternatively, holding 10,000+ RCG tokens grants you full platform
                  access without a monthly subscription.
                </p>
                <Button className="bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold">
                  <Link href="/shop/subscription-form">Subscribe Again</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* No Active Subscription */}
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <XCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-white mb-2">
              No Active Subscription
            </h4>
            <p className="text-gray-400 mb-6">
              Subscribe for $500/month to operate without RCG tokens
            </p>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span>Issue RCN rewards to customers</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span>Process customer redemptions</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span>Purchase RCN tokens at $0.10 each</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span>Cancel anytime</span>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                /* onClick={() => setShowSubscribeModal(true)} */
                className="bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold"
              >
                <Link href="/shop/subscription-form">Subscribe Now</Link>
              </Button>

              <Button
                onClick={syncSubscription}
                variant="outline"
                disabled={syncing}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                {syncing ? "Syncing..." : "Sync Status"}
              </Button>
            </div>

            {/* Show resubscribe option if previously subscribed */}
            {subscription && subscription.status === "cancelled" && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">
                  Previously subscribed? Subscribe again to continue!
                </p>
                <Button
                  onClick={() => setShowSubscribeModal(true)}
                  variant="outline"
                  className="border-[#FFCC00] text-[#FFCC00] hover:bg-[#FFCC00] hover:text-black"
                >
                  Resubscribe
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subscribe Modal */}
      <Dialog open={showSubscribeModal} onOpenChange={setShowSubscribeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subscribe to Monthly Plan</DialogTitle>
            <DialogDescription className="pt-4">
              Subscribe for $500/month to operate your shop without RCG tokens.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-gray-100 rounded-lg p-4">
              <h4 className="font-semibold mb-2">What's Included:</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Full operational status</li>
                <li>• Issue RCN rewards</li>
                <li>• Process redemptions</li>
                <li>• Purchase RCN at $0.10 each</li>
                <li>• Cancel anytime</li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="billingContact"
                  className="block text-sm font-medium mb-1"
                >
                  Billing Contact Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="billingContact"
                  value={billingForm.billingContact}
                  onChange={(e) =>
                    setBillingForm({
                      ...billingForm,
                      billingContact: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="billingEmail"
                  className="block text-sm font-medium mb-1"
                >
                  Billing Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="billingEmail"
                  value={billingForm.billingEmail}
                  onChange={(e) =>
                    setBillingForm({
                      ...billingForm,
                      billingEmail: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                  placeholder="billing@example.com"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="billingPhone"
                  className="block text-sm font-medium mb-1"
                >
                  Phone Number
                </label>
                <CountryPhoneInput
                  value={billingForm.billingPhone}
                  onChange={(phone) =>
                    setBillingForm({
                      ...billingForm,
                      billingPhone: phone,
                    })
                  }
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label
                  htmlFor="paymentMethod"
                  className="block text-sm font-medium mb-1"
                >
                  Payment Method
                </label>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <CreditCard className="w-5 h-5 text-gray-600" />
                  <span className="text-gray-700 font-medium">
                    Credit Card (via Stripe)
                  </span>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-500">
              You'll be redirected to Stripe to securely complete your
              subscription setup.
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSubscribeModal(false)}
              disabled={subscribing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="bg-[#FFCC00] hover:bg-[#FFD700] text-black"
            >
              {subscribing ? "Creating..." : "Create Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate Modal */}
      <Dialog open={showReactivateModal} onOpenChange={setShowReactivateModal}>
        <DialogContent className="sm:max-w-md bg-[#1A1A1A] border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">
              Reactivate Subscription
            </DialogTitle>
            <DialogDescription className="pt-2 text-gray-400">
              Confirm that you want to reactivate your subscription and continue
              with automatic billing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
              <h4 className="font-semibold text-green-400 mb-3">
                After reactivation:
              </h4>
              <ul className="space-y-2 text-sm text-green-300">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                  <span>Your subscription will continue automatically</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                  <span>You'll be charged $500 on your next billing date</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                  <span>Full operational status will be maintained</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                  <span>
                    Continue issuing rewards and processing redemptions
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
              <p className="text-sm text-yellow-300">
                Your subscription will no longer end on{" "}
                {subscription?.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                  : "the scheduled date"}{" "}
                and will renew automatically.
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setShowReactivateModal(false)}
              disabled={reactivating}
              className="flex-1 bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReactivate}
              disabled={reactivating}
              className="flex-1 bg-[#FFCC00] hover:bg-[#FFD700] text-black font-semibold disabled:opacity-50"
            >
              {reactivating ? "Reactivating..." : "Confirm Reactivation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="sm:max-w-md bg-[#1A1A1A] border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">
              Cancel Subscription
            </DialogTitle>
            <DialogDescription className="pt-2 text-gray-400">
              Are you sure you want to cancel your subscription? You'll lose
              operational status immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
              <h4 className="font-semibold text-red-400 mb-3">
                After cancellation:
              </h4>
              <ul className="space-y-2 text-sm text-red-300">
                <li className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  <span>Cannot issue RCN rewards</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  <span>Cannot process redemptions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  <span>Cannot purchase RCN tokens</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  <span>Lose operational status</span>
                </li>
              </ul>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Let us know why you're cancelling...
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full p-3 bg-[#2F2F2F] border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent resize-none placeholder:text-gray-500"
                rows={3}
                placeholder="Share your feedback (optional)"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelModal(false);
                setCancellationReason("");
              }}
              disabled={cancelling}
              className="flex-1 bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              Keep Subscription
            </Button>
            <Button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
            >
              {cancelling ? "Cancelling..." : "Cancel Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
