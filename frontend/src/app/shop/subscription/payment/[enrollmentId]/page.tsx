'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, CreditCard, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface EnrollmentDetails {
  id: number;
  shopId: string;
  status: string;
  monthlyAmount: number;
  billingMethod: string;
  billingReference: string;
  shopDetails?: {
    companyName: string;
    email: string;
    phoneNumber: string;
  };
}

export default function SubscriptionPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const enrollmentId = params.enrollmentId as string;
  
  const [enrollment, setEnrollment] = useState<EnrollmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);

  useEffect(() => {
    if (enrollmentId) {
      loadEnrollmentDetails();
    }
  }, [enrollmentId]);

  const loadEnrollmentDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('shopAuthToken');

      // Use public endpoint for payment page
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/subscription/enrollment-public/${enrollmentId}`);


      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Failed to load enrollment details (${response.status})`);
      }

      const result = await response.json();
      if (result.success) {
        setEnrollment(result.data);
      } else {
        throw new Error(result.error || 'Failed to load enrollment');
      }
    } catch (error) {
      console.error('Error loading enrollment:', error);
      setError(error instanceof Error ? error.message : 'Failed to load payment details');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    try {
      setProcessing(true);
      setError(null);

      // In a real implementation, this would integrate with Stripe Payment Elements
      // For now, we'll simulate the payment process
      await new Promise(resolve => setTimeout(resolve, 2000));

      const token = localStorage.getItem('shopAuthToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Call backend to confirm payment
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/subscription/payment/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enrollmentId: enrollmentId,
          paymentMethodId: 'pm_card_visa', // This would come from Stripe
          amount: enrollment?.monthlyAmount || 500
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Payment failed');
      }

      setPaymentComplete(true);
      
      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        router.push('/shop?tab=subscription');
      }, 3000);

    } catch (error) {
      console.error('Payment error:', error);
      setError(error instanceof Error ? error.message : 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#000000] to-[#111111] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00] mx-auto mb-4" />
          <p className="text-gray-400">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (error && !enrollment) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#000000] to-[#111111] flex items-center justify-center">
        <div className="bg-[#212121] rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Payment Error</h1>
            <p className="text-gray-400 mb-6">{error}</p>
            <Button
              onClick={() => router.push('/shop?tab=subscription')}
              className="bg-[#FFCC00] hover:bg-[#FFD700] text-black"
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (paymentComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#000000] to-[#111111] flex items-center justify-center">
        <div className="bg-[#212121] rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
            <p className="text-gray-400 mb-6">
              Your subscription has been activated. You can now start issuing RCN rewards.
            </p>
            <p className="text-sm text-gray-500">
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#000000] to-[#111111] py-12">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="bg-[#212121] rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#FFCC00] mb-2">Complete Your Subscription</h1>
            <p className="text-gray-400">Set up your payment method for monthly billing</p>
          </div>

          {/* Enrollment Details */}
          {enrollment && (
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">Subscription Details</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Shop Name</span>
                  <span className="text-white">{enrollment.shopDetails?.companyName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Monthly Amount</span>
                  <span className="text-white font-bold">${enrollment.monthlyAmount}/month</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Billing Email</span>
                  <span className="text-white">{enrollment.billingReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Commitment Period</span>
                  <span className="text-white">6 months</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Form */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Payment Information</h2>
            
            {/* In production, this would be replaced with Stripe Payment Element */}
            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg p-4 border-2 border-[#FFCC00]">
                <div className="flex items-center gap-3 mb-3">
                  <CreditCard className="w-5 h-5 text-[#FFCC00]" />
                  <span className="text-white font-medium">Test Payment Mode</span>
                </div>
                <p className="text-sm text-gray-400 mb-2">
                  This is a test payment interface. In production, you would enter your actual card details.
                </p>
                <p className="text-sm text-gray-500">
                  Test card: 4242 4242 4242 4242
                </p>
              </div>

              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                  <strong>Note:</strong> Your card will be charged ${enrollment?.monthlyAmount || 500} monthly 
                  for the next 6 months. You can cancel anytime, but the monthly fee is non-refundable.
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={() => router.push('/shop?tab=subscription')}
              variant="outline"
              disabled={processing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              disabled={processing || !enrollment}
              className="flex-1 bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Complete Payment
                </>
              )}
            </Button>
          </div>

          {/* Security Notice */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Your payment information is secure and encrypted. 
              We never store your card details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}