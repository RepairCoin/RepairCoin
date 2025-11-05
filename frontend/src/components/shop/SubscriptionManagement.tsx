'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle, XCircle, CreditCard, Calendar, DollarSign } from 'lucide-react';
import Link from 'next/link';

interface Subscription {
  id?: number;
  shopId: string;
  status: 'pending' | 'active' | 'cancelled' | 'paused' | 'defaulted';
  monthlyAmount: number;
  subscriptionType: string;
  billingMethod?: 'credit_card' | 'ach' | 'wire' | 'crypto';
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
}

export const SubscriptionManagement: React.FC<SubscriptionManagementProps> = ({ shopId, shopWallet }) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [billingForm, setBillingForm] = useState({
    billingEmail: '',
    billingContact: '',
    billingPhone: ''
  });

  useEffect(() => {
    loadSubscriptionStatus();
    
    // Prefill form with shop data if available
    const shopData = JSON.parse(localStorage.getItem('shopData') || '{}');
    if (shopData) {
      setBillingForm(prev => ({
        ...prev,
        billingEmail: shopData.email || '',
        billingContact: `${shopData.firstName || ''} ${shopData.lastName || ''}`.trim() || shopData.ownerName || '',
        billingPhone: shopData.phoneNumber || ''
      }));
    }
  }, [shopId]);

  const loadSubscriptionStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('shopAuthToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/subscription/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Subscription status error:', response.status, errorData);
        throw new Error(errorData?.error || 'Failed to load subscription status');
      }

      const result = await response.json();
      if (result.success && result.data.currentSubscription) {
        const sub = result.data.currentSubscription;
        setSubscription({
          ...sub,
          // Map backend fields to frontend interface
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          currentPeriodEnd: sub.currentPeriodEnd || sub.nextPaymentDate
        });
        console.log('✅ SUBSCRIPTION STATUS: TRUE - Active subscription found:', {
          subscriptionId: sub.id,
          status: sub.status,
          subscriptionType: sub.subscriptionType,
          monthlyAmount: sub.monthlyAmount,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          currentPeriodEnd: sub.currentPeriodEnd
        });
      } else {
        console.log('❌ SUBSCRIPTION STATUS: FALSE - No active subscription found');
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      setError(error instanceof Error ? error.message : 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  };

  const syncSubscription = async () => {
    try {
      setSyncing(true);
      setError(null);

      const token = localStorage.getItem('shopAuthToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/subscription/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to sync subscription');
      }

      const result = await response.json();
      if (result.data?.synced) {
        setSuccessMessage('Subscription synced successfully!');
        // Reload subscription status
        await loadSubscriptionStatus();
      } else {
        setError(result.message || 'No new subscription to sync');
      }
    } catch (error) {
      console.error('Error syncing subscription:', error);
      setError(error instanceof Error ? error.message : 'Failed to sync subscription');
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
        setError('Please fill in all required fields');
        setSubscribing(false);
        return;
      }

      const token = localStorage.getItem('shopAuthToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/subscription/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          billingMethod: 'credit_card', // Always credit card now
          billingEmail: billingForm.billingEmail,
          billingContact: billingForm.billingContact,
          billingPhone: billingForm.billingPhone,
          notes: 'Monthly subscription enrollment'
        })
      });

      const result = await response.json();
      
      // Check if response is successful (2xx status codes)
      if (!response.ok && !(response.status >= 200 && response.status < 300)) {
        throw new Error(result.error || 'Failed to create subscription');
      }
      
      // If we get a successful response, check if it's because of existing pending subscription
      if (!result.success && result.error) {
        throw new Error(result.error);
      }

      // Update subscription state with the enrollment data
      if (result.data.enrollment) {
        setSubscription({
          ...result.data.enrollment,
          subscriptionType: 'monthly_subscription'
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
        setSuccessMessage('Redirecting to secure payment...');
        setTimeout(() => {
          window.location.href = result.data.paymentUrl;
        }, 1500);
      } else {
        // Show success message
        setSuccessMessage(result.data.nextSteps || result.data.message);
        setTimeout(() => setSuccessMessage(null), 10000);
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      setError(error instanceof Error ? error.message : 'Failed to subscribe');
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancel = async () => {
    try {
      setCancelling(true);
      setError(null);

      const token = localStorage.getItem('shopAuthToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/subscription/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: cancellationReason || 'Cancelled by shop owner'
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel subscription');
      }

      // Update subscription state
      if (result.data.subscription) {
        setSubscription({
          ...result.data.subscription,
          subscriptionType: 'stripe_subscription'
        });
      } else {
        // Reload to get updated status
        await loadSubscriptionStatus();
      }
      setShowCancelModal(false);
      setCancellationReason('');
      
      // Show success message
      setSuccessMessage(result.data.message || 'Subscription cancelled successfully. You can resubscribe at any time.');
      
      // Clear success message after 10 seconds
      setTimeout(() => setSuccessMessage(null), 10000);
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      setError(error instanceof Error ? error.message : 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivate = async () => {
    try {
      setSubscribing(true);
      setError(null);

      const token = localStorage.getItem('shopAuthToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/subscription/reactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to reactivate subscription');
      }

      // Update subscription state
      if (result.data.subscription) {
        setSubscription({
          ...result.data.subscription,
          subscriptionType: 'stripe_subscription'
        });
      }
      
      // Show success message
      setSuccessMessage(result.data.message || 'Subscription reactivated successfully! Your subscription will continue as normal.');
      
      // Clear success message after 10 seconds
      setTimeout(() => setSuccessMessage(null), 10000);
      
      // Reload to ensure we have the latest status
      await loadSubscriptionStatus();
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      setError(error instanceof Error ? error.message : 'Failed to reactivate subscription');
    } finally {
      setSubscribing(false);
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
      <h3 className="text-2xl font-bold text-[#FFCC00] mb-6">Monthly Subscription</h3>
      
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

      {subscription && subscription.status === 'active' ? (
        <div className="space-y-6">
          {/* Active Subscription Status */}
          {subscription.cancelAtPeriodEnd ? (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-yellow-400" />
                  <div>
                    <h4 className="text-lg font-semibold text-yellow-400">Subscription Ending</h4>
                    <p className="text-sm text-gray-400">Your subscription will end on {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'end of billing period'}</p>
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
                    <h4 className="text-lg font-semibold text-green-400">Active Subscription</h4>
                    <p className="text-sm text-gray-400">Your shop is operationally qualified</p>
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
              <p className="text-xl font-bold text-white">${subscription.monthlyAmount}/mo</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">Payments Made</span>
              </div>
              <p className="text-xl font-bold text-white">{subscription.paymentsMade}</p>
              <p className="text-sm text-gray-500">${subscription.totalPaid} total</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">Next Payment</span>
              </div>
              <p className="text-xl font-bold text-white">
                {subscription.nextPaymentDate 
                  ? new Date(subscription.nextPaymentDate).toLocaleDateString()
                  : 'Not scheduled'}
              </p>
            </div>
          </div>

          {/* Cancel/Reactivate Button */}
          <div className="pt-4 border-t border-gray-700">
            {subscription.cancelAtPeriodEnd ? (
              <div>
                <Button
                  onClick={handleReactivate}
                  className="bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold"
                >
                  Reactivate Subscription
                </Button>
                <p className="text-sm text-gray-400 mt-2">
                  Changed your mind? Reactivate to keep your subscription after {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'the current period'}.
                </p>
              </div>
            ) : (
              <div>
                <Button
                  onClick={() => setShowCancelModal(true)}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700"
                >
                  Cancel Subscription
                </Button>
                <p className="text-sm text-gray-400 mt-2">
                  You can cancel anytime and resubscribe when needed.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : subscription && subscription.status === 'pending' ? (
        <div className="space-y-6">
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-400" />
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-yellow-400">Subscription Pending</h4>
                <p className="text-sm text-gray-300 mt-1">
                  Your subscription request has been submitted. Please complete the payment setup to activate your subscription.
                </p>
              </div>
            </div>
          </div>
          
          {/* Subscription Details */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-white mb-4">Subscription Details</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Monthly Amount:</span>
                <span className="text-white font-medium">${subscription.monthlyAmount}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Term:</span>
                <span className="text-white font-medium">{subscription.termMonths || 6} months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Commitment:</span>
                <span className="text-white font-medium">${subscription.totalCommitment || (subscription.monthlyAmount * 6)}</span>
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
      ) : (
        <div className="space-y-6">
          {/* No Active Subscription */}
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <XCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-white mb-2">No Active Subscription</h4>
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
                <Link href="/shop/subscription-form">
                 Subscribe Now
                </Link>
               
              </Button>
              
              <Button
                onClick={syncSubscription}
                variant="outline"
                disabled={syncing}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                {syncing ? 'Syncing...' : 'Sync Status'}
              </Button>
            </div>
            
            {/* Show reactivate option if previously subscribed */}
            {subscription && subscription.status === 'cancelled' && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">
                  Previously subscribed? Reactivate instantly!
                </p>
                <Button
                  onClick={handleReactivate}
                  variant="outline"
                  className="border-[#FFCC00] text-[#FFCC00] hover:bg-[#FFCC00] hover:text-black"
                >
                  Reactivate Subscription
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
                <label htmlFor="billingContact" className="block text-sm font-medium mb-1">
                  Billing Contact Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="billingContact"
                  value={billingForm.billingContact}
                  onChange={(e) => setBillingForm({ ...billingForm, billingContact: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                  placeholder="John Doe"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="billingEmail" className="block text-sm font-medium mb-1">
                  Billing Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="billingEmail"
                  value={billingForm.billingEmail}
                  onChange={(e) => setBillingForm({ ...billingForm, billingEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                  placeholder="billing@example.com"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="billingPhone" className="block text-sm font-medium mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="billingPhone"
                  value={billingForm.billingPhone}
                  onChange={(e) => setBillingForm({ ...billingForm, billingPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              
              <div>
                <label htmlFor="paymentMethod" className="block text-sm font-medium mb-1">
                  Payment Method
                </label>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <CreditCard className="w-5 h-5 text-gray-600" />
                  <span className="text-gray-700 font-medium">Credit Card (via Stripe)</span>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-gray-500">
              You'll be redirected to Stripe to securely complete your subscription setup.
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
              {subscribing ? 'Creating...' : 'Create Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription className="pt-4">
              Are you sure you want to cancel your subscription? You'll lose operational status immediately.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-800 mb-2">After cancellation:</h4>
              <ul className="space-y-1 text-sm text-red-700">
                <li>• Cannot issue RCN rewards</li>
                <li>• Cannot process redemptions</li>
                <li>• Cannot purchase RCN tokens</li>
                <li>• Lose operational status</li>
              </ul>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Reason for cancellation (optional)
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full p-2 border rounded-lg"
                rows={3}
                placeholder="Let us know why you're cancelling..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelModal(false)}
              disabled={cancelling}
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};