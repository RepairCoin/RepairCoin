'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle, XCircle, CreditCard, Calendar, DollarSign } from 'lucide-react';
import { shopApi } from '@/services/api/shop';

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
}

export const SubscriptionManagement: React.FC<SubscriptionManagementProps> = ({ shopId }) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

      const result = await shopApi.getSubscriptionStatus();
      
      if (result && result.currentSubscription) {
        setSubscription(result.currentSubscription);
        console.log('✅ SUBSCRIPTION STATUS: TRUE - Active subscription found:', {
          subscriptionId: result.currentSubscription.id,
          status: result.currentSubscription.status,
          subscriptionType: result.currentSubscription.subscriptionType,
          monthlyAmount: result.currentSubscription.monthlyAmount
        });
      } else {
        console.log('❌ SUBSCRIPTION STATUS: FALSE - No active subscription found');
        setSubscription(null);
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

      // Validate form
      if (!billingForm.billingEmail || !billingForm.billingContact) {
        setError('Please fill in all required fields');
        setSubscribing(false);
        return;
      }

      const result = await shopApi.subscribeToCommitment({
        billingMethod: 'credit_card', // Always credit card now
        billingEmail: billingForm.billingEmail,
        billingContact: billingForm.billingContact,
        billingPhone: billingForm.billingPhone || undefined,
        notes: 'Monthly subscription enrollment'
      });
      
      if (!result) {
        throw new Error('Failed to create subscription');
      }

      setShowSubscribeModal(false);
      
      // Handle payment redirect for new subscriptions
      if (result.paymentUrl) {
        setSuccessMessage('Redirecting to secure payment...');
        setTimeout(() => {
          window.location.href = result.paymentUrl as string;
        }, 1500);
      } else {
        // Show success message
        setSuccessMessage(result.nextSteps || result.message);
        setTimeout(() => setSuccessMessage(null), 10000);
      }
      
      // Reload subscription status
      setTimeout(() => loadSubscriptionStatus(), 2000);
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

      const result = await shopApi.cancelSubscription(cancellationReason || 'Cancelled by shop owner');
      
      if (!result) {
        throw new Error('Failed to cancel subscription');
      }

      // Update subscription state
      if (result.enrollment) {
        setSubscription({
          ...result.enrollment,
          subscriptionType: 'monthly_commitment'
        });
      } else {
        // Reload to get updated status
        await loadSubscriptionStatus();
      }
      setShowCancelModal(false);
      setCancellationReason('');
      
      // Show success message
      setSuccessMessage(result.message || 'Subscription cancelled successfully. You can resubscribe at any time.');
      
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
                <span className="text-white font-medium">6 months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Commitment:</span>
                <span className="text-white font-medium">${subscription.monthlyAmount * 6}</span>
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