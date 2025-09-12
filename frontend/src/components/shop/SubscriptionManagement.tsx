'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle, XCircle, CreditCard, Calendar, DollarSign } from 'lucide-react';

interface Subscription {
  id?: number;
  shopId: string;
  status: 'pending' | 'active' | 'cancelled' | 'paused';
  monthlyAmount: number;
  subscriptionType: string;
  paymentsMade: number;
  totalPaid: number;
  nextPaymentDate?: string;
  lastPaymentDate?: string;
  enrolledAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
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

  useEffect(() => {
    loadSubscriptionStatus();
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
        throw new Error('Failed to load subscription status');
      }

      const result = await response.json();
      if (result.success && result.data.currentSubscription) {
        setSubscription(result.data.currentSubscription);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      setError(error instanceof Error ? error.message : 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      setSubscribing(true);
      setError(null);

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
          billingMethod: 'credit_card',
          notes: 'Monthly subscription enrollment'
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create subscription');
      }

      setSubscription(result.data);
      setShowSubscribeModal(false);
      
      // Show success message
      alert('Subscription created successfully! Please wait for payment setup instructions.');
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

      setSubscription(result.data);
      setShowCancelModal(false);
      setCancellationReason('');
      
      // Show success message
      alert('Subscription cancelled successfully. You can resubscribe at any time.');
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
        },
        body: JSON.stringify({
          paymentMethod: 'credit_card'
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to reactivate subscription');
      }

      setSubscription(result.data);
      
      // Show success message
      alert('Subscription reactivated successfully! Welcome back!');
      
      // Reload to update status
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

          {/* Cancel Button */}
          <div className="pt-4 border-t border-gray-700">
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
        </div>
      ) : subscription && subscription.status === 'pending' ? (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-400" />
            <div>
              <h4 className="text-lg font-semibold text-yellow-400">Subscription Pending</h4>
              <p className="text-sm text-gray-300 mt-1">
                Your subscription request has been submitted. Please wait for payment setup instructions.
              </p>
            </div>
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
                <span>Cancel anytime, no commitment</span>
              </div>
            </div>

            <Button
              onClick={() => setShowSubscribeModal(true)}
              className="bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold"
            >
              Subscribe Now
            </Button>
            
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
            
            <div className="text-sm text-gray-500">
              After subscribing, you'll receive payment setup instructions via email.
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