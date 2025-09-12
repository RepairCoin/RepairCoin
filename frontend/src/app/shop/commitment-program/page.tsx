'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, DollarSign, Calendar, Zap, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useActiveAccount } from 'thirdweb/react';
import apiClient from '@/services/api/client';
import { useShopRegistration } from '@/hooks/useShopRegistration';
import Link from 'next/link';

export default function CommitmentProgram() {
  const router = useRouter();
  const account = useActiveAccount();
  const { existingApplication } = useShopRegistration();
  const [agreed, setAgreed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [billingMethod, setBillingMethod] = useState<'credit_card' | 'ach' | 'wire'>('credit_card');

  const benefits = [
    {
      icon: DollarSign,
      title: 'No Upfront RCG Purchase',
      description: 'Start accepting RepairCoin without buying 10,000 RCG tokens'
    },
    {
      icon: Shield,
      title: 'Standard Tier Benefits',
      description: 'Get all Standard tier features immediately upon approval'
    },
    {
      icon: Calendar,
      title: 'Monthly Subscription',
      description: 'Simple $500/month subscription, cancel anytime'
    },
    {
      icon: Zap,
      title: 'Immediate Activation',
      description: 'Start rewarding customers as soon as your subscription is approved'
    }
  ];

  const requirements = [
    '$500 monthly subscription fee',
    'No long-term commitment - cancel anytime',
    'Monthly automatic billing via ACH or credit card',
    'Standard verification and compliance checks',
    'Cannot hold RCG tokens while subscribed'
  ];

  const handleEnroll = async () => {
    if (!agreed || !account) return;
    
    if (!existingApplication.shopId) {
      setError('Shop ID not found. Please ensure you are registered as a shop.');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      // Get auth token first
      const authResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/shop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: account.address }),
      });
      
      if (authResponse.ok) {
        const authResult = await authResponse.json();
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${authResult.token}`;
      }
      
      // Submit commitment enrollment
      const response = await apiClient.post('/admin/commitment/enrollments', {
        shopId: existingApplication.shopId,
        monthlyAmount: 500,
        termMonths: 6,
        billingMethod,
        notes: `Shop ${existingApplication.shopId} enrolled via web interface`
      });
      
      if (response.data.success) {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to enroll in commitment program');
    } finally {
      setIsProcessing(false);
    }
  };

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] py-12">
        <div className="max-w-3xl mx-auto px-4">
          <Card className="bg-[#1A1A1A] border-gray-700">
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                Application Submitted Successfully!
              </h2>
              <p className="text-gray-400 mb-6">
                Your commitment program enrollment has been submitted and is pending admin approval.
                You will be notified once your application is reviewed.
              </p>
              <Link href="/shop">
                <Button className="bg-[#FFCC00] hover:bg-[#E5B800] text-black">
                  Return to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="bg-amber-900/20 border-amber-700">
          <AlertCircle className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-300">
            Please connect your wallet to continue with the commitment program
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Back Button */}
      <Link href="/shop">
        <Button variant="ghost" className="mb-6 text-gray-400 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </Link>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#FFCC00] mb-2">Monthly Subscription</h1>
        <p className="text-gray-400">Join RepairCoin without upfront RCG investment</p>
      </div>

      <div className="grid gap-6">
        {/* Program Overview */}
        <Card className="bg-[#212121] border-gray-700">
          <CardHeader>
            <CardTitle className="text-xl text-white">Program Overview</CardTitle>
            <CardDescription className="text-gray-400">
              Perfect for shops that want to test RepairCoin before making a large RCG investment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-900/20 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <p className="font-medium text-green-400">Alternative to 10,000 RCG requirement</p>
              </div>
              <p className="text-sm text-gray-300">
                Instead of purchasing RCG tokens upfront, pay a simple $500 monthly subscription
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {benefits.map((benefit, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-gray-800 rounded-lg">
                      <benefit.icon className="h-5 w-5 text-[#FFCC00]" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium text-white text-sm">{benefit.title}</h3>
                    <p className="text-xs text-gray-400 mt-1">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Requirements */}
        <Card className="bg-[#212121] border-gray-700">
          <CardHeader>
            <CardTitle className="text-xl text-white">Program Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {requirements.map((req, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#FFCC00]" />
                  </div>
                  <span className="text-sm text-gray-300">{req}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Comparison */}
        <Card className="bg-[#212121] border-gray-700">
          <CardHeader>
            <CardTitle className="text-xl text-white">Program Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400"></th>
                    <th className="text-center py-3 px-4 text-white">RCG Purchase</th>
                    <th className="text-center py-3 px-4 text-white">Monthly Subscription</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-gray-400">Upfront Cost</td>
                    <td className="text-center py-3 px-4 text-white">$5,000</td>
                    <td className="text-center py-3 px-4 text-green-400">$0</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-gray-400">Monthly Fee</td>
                    <td className="text-center py-3 px-4 text-white">None</td>
                    <td className="text-center py-3 px-4 text-white">$500</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-gray-400">Commitment</td>
                    <td className="text-center py-3 px-4 text-white">None</td>
                    <td className="text-center py-3 px-4 text-white">Cancel anytime</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-gray-400">Can stop anytime</td>
                    <td className="text-center py-3 px-4 text-green-400">Yes (sell tokens)</td>
                    <td className="text-center py-3 px-4 text-green-400">Yes (cancel subscription)</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4 text-gray-400">RCN price discounts</td>
                    <td className="text-center py-3 px-4 text-green-400">Yes (up to 40% off)</td>
                    <td className="text-center py-3 px-4 text-gray-400">No (standard rate)</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-gray-400">Governance rights</td>
                    <td className="text-center py-3 px-4 text-green-400">Yes</td>
                    <td className="text-center py-3 px-4 text-gray-400">No</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Billing Method Selection */}
        <Card className="bg-[#212121] border-gray-700">
          <CardHeader>
            <CardTitle className="text-xl text-white">Billing Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                value="credit_card"
                checked={billingMethod === 'credit_card'}
                onChange={(e) => setBillingMethod(e.target.value as any)}
                className="w-4 h-4 text-[#FFCC00]"
              />
              <span className="text-white">Credit Card</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                value="ach"
                checked={billingMethod === 'ach'}
                onChange={(e) => setBillingMethod(e.target.value as any)}
                className="w-4 h-4 text-[#FFCC00]"
              />
              <span className="text-white">ACH Transfer</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                value="wire"
                checked={billingMethod === 'wire'}
                onChange={(e) => setBillingMethod(e.target.value as any)}
                className="w-4 h-4 text-[#FFCC00]"
              />
              <span className="text-white">Wire Transfer</span>
            </label>
          </CardContent>
        </Card>

        {/* Terms Agreement */}
        <Card className="bg-[#212121] border-gray-700">
          <CardHeader>
            <CardTitle className="text-xl text-white">Terms & Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4 max-h-48 overflow-y-auto">
              <p className="text-xs text-gray-300 space-y-2">
                <span className="block">1. Monthly subscription fee of $500 will be charged automatically.</span>
                <span className="block">2. No long-term commitment - you can cancel anytime with 30 days notice.</span>
                <span className="block">3. Subscription must remain active to maintain operational status.</span>
                <span className="block">4. Missing payments will result in loss of shop operational privileges.</span>
                <span className="block">5. Cannot hold RCG tokens while maintaining an active subscription.</span>
                <span className="block">6. You may switch to RCG token ownership at any time by cancelling subscription.</span>
              </p>
            </div>
            
            <div className="flex items-start gap-3">
              <Checkbox 
                id="terms" 
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked as boolean)}
              />
              <label htmlFor="terms" className="text-sm text-gray-300 cursor-pointer">
                I agree to the subscription terms and authorize monthly charges of $500 until I cancel
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert className="bg-red-900/20 border-red-600/50">
            <AlertDescription className="text-red-200">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleEnroll}
            disabled={!agreed || isProcessing}
            className="flex-1 bg-[#FFCC00] text-black hover:bg-[#FFDD33]"
          >
            {isProcessing ? 'Processing...' : 'Start Monthly Subscription'}
          </Button>
        </div>
      </div>
    </div>
  );
}