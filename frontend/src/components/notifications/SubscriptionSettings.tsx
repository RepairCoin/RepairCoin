"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Loader2
} from "lucide-react";
import Link from "next/link";
import apiClient from "@/services/api/client";

interface Subscription {
  id?: number;
  shopId: string;
  status: "pending" | "active" | "cancelled" | "paused" | "defaulted";
  monthlyAmount: number;
  subscriptionType: string;
  paymentsMade: number;
  totalPaid: number;
  nextPaymentDate?: string;
  lastPaymentDate?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
  cancelledAt?: string;
  pausedAt?: string;
  activatedAt?: string;
}

interface SubscriptionSettingsProps {
  userType?: 'customer' | 'shop' | 'admin';
}

export function SubscriptionSettings({ userType = 'shop' }: SubscriptionSettingsProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userType === 'shop') {
      loadSubscriptionStatus();
    } else {
      setLoading(false);
    }
  }, [userType]);

  const loadSubscriptionStatus = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/shops/subscription/status");

      if (response.success && response.data.currentSubscription) {
        const sub = response.data.currentSubscription;
        setSubscription({
          ...sub,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          currentPeriodEnd: sub.currentPeriodEnd || sub.nextPaymentDate,
        });
      }
    } catch (error) {
      console.error("Error loading subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  // Only show for shop users
  if (userType !== 'shop') {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-[#212121] rounded-2xl overflow-hidden border border-gray-800/50">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFCC00]/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-[#FFCC00]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Subscription</h3>
              <p className="text-sm text-gray-400">Manage your RepairCoin subscription</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#212121] rounded-2xl overflow-hidden border border-gray-800/50">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFCC00]/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-[#FFCC00]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Subscription</h3>
            <p className="text-sm text-gray-400">Manage your RepairCoin subscription</p>
          </div>
        </div>

        {subscription && (
          <Link
            href="/shop/settings"
            className="text-sm px-4 py-2 bg-[#2F2F2F] text-[#FFCC00] rounded-full font-medium hover:bg-[#3F3F3F] transition-colors flex items-center gap-2"
          >
            Manage
            <ExternalLink className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div className="px-6 py-6 space-y-6">
        {subscription && subscription.status === "active" ? (
          <>
            {/* Active Status Banner */}
            {subscription.cancelAtPeriodEnd ? (
              <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-300 mb-1">
                    Subscription Ending
                  </p>
                  <p className="text-xs text-yellow-200/80">
                    Your subscription will end on {subscription.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                      : "end of billing period"}
                  </p>
                </div>
                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium whitespace-nowrap">
                  Cancelling
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-300 mb-1">
                    Active Subscription
                  </p>
                  <p className="text-xs text-green-200/80">
                    Your shop is operationally qualified
                  </p>
                </div>
                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                  Active
                </span>
              </div>
            )}

            {/* Subscription Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 p-3 bg-[#2F2F2F] rounded-lg border border-gray-700">
                <DollarSign className="w-5 h-5 text-[#FFCC00]" />
                <div>
                  <p className="text-xs text-gray-400">Monthly Fee</p>
                  <p className="text-sm font-semibold text-white">${subscription.monthlyAmount}/mo</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-[#2F2F2F] rounded-lg border border-gray-700">
                <CreditCard className="w-5 h-5 text-[#FFCC00]" />
                <div>
                  <p className="text-xs text-gray-400">Payments Made</p>
                  <p className="text-sm font-semibold text-white">{subscription.paymentsMade}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-[#2F2F2F] rounded-lg border border-gray-700">
                <Calendar className="w-5 h-5 text-[#FFCC00]" />
                <div>
                  <p className="text-xs text-gray-400">
                    {subscription.cancelAtPeriodEnd ? "Ends On" : "Next Payment"}
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {subscription.cancelAtPeriodEnd
                      ? subscription.currentPeriodEnd
                        ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : "Soon"
                      : subscription.nextPaymentDate
                      ? new Date(subscription.nextPaymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : "Not scheduled"}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between p-4 bg-[#2F2F2F] rounded-lg border border-gray-700">
              <div>
                <p className="text-sm font-medium text-white">Need to make changes?</p>
                <p className="text-xs text-gray-400 mt-1">
                  View payment history, update billing info, or manage your subscription
                </p>
              </div>
              <Link
                href="/shop/settings"
                className="px-4 py-2 bg-[#FFCC00] hover:bg-yellow-400 text-black rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                Go to Settings
              </Link>
            </div>
          </>
        ) : subscription && subscription.status === "paused" ? (
          <>
            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-300 mb-1">
                  Subscription Paused
                </p>
                <p className="text-xs text-blue-200/80">
                  Your subscription has been temporarily paused by the administrator
                </p>
              </div>
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                Paused
              </span>
            </div>

            <div className="p-4 bg-[#2F2F2F] rounded-lg border border-gray-700">
              <p className="text-sm text-gray-300 mb-3">
                You cannot issue rewards or process redemptions while paused. Contact support to resolve any issues.
              </p>
              <Link
                href="/shop/settings"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFCC00] hover:bg-yellow-400 text-black rounded-lg text-sm font-medium transition-colors"
              >
                View Details
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </>
        ) : subscription && subscription.status === "cancelled" ? (
          <>
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-300 mb-1">
                  Subscription Cancelled
                </p>
                <p className="text-xs text-red-200/80">
                  {subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) > new Date()
                    ? `You have access until ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                    : "Your subscription has ended"}
                </p>
              </div>
              <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
                Cancelled
              </span>
            </div>

            <div className="p-4 bg-[#2F2F2F] rounded-lg border border-gray-700">
              <p className="text-sm text-gray-300 mb-3">
                Want to continue using RepairCoin? You can resubscribe at any time to regain full platform access.
              </p>
              <Link
                href="/shop/subscription-form"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFCC00] hover:bg-yellow-400 text-black rounded-lg text-sm font-medium transition-colors"
              >
                Resubscribe Now
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </>
        ) : (
          <>
            {/* No Subscription */}
            <div className="flex items-start gap-3 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
              <XCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-300 mb-1">
                  No Active Subscription
                </p>
                <p className="text-xs text-gray-400">
                  Subscribe for $500/month to operate without RCG tokens
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-300">
                With a monthly subscription, you can:
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Issue RCN rewards to customers</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Process customer redemptions</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Purchase RCN tokens at $0.10 each</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/shop/subscription-form"
                className="flex-1 px-4 py-2 bg-[#FFCC00] hover:bg-yellow-400 text-black rounded-lg text-sm font-medium transition-colors text-center"
              >
                Subscribe Now
              </Link>
              <Link
                href="/shop/settings"
                className="px-4 py-2 bg-[#2F2F2F] hover:bg-[#3F3F3F] text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                Learn More
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
