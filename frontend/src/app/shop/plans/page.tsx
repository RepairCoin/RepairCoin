"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveAccount } from 'thirdweb/react';
import { CheckIcon, XIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface Plan {
  id: string;
  name: string;
  price: number;
  rcnTokens: number;
  features: string[];
  notIncluded?: string[];
  popular?: boolean;
  savings?: string;
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free Trial',
    price: 0,
    rcnTokens: 50,
    features: [
      '50 RCN tokens to start',
      'Basic dashboard access',
      'Customer rewards system',
      'Email support',
      'Valid for 30 days'
    ],
    notIncluded: [
      'Cross-shop network access',
      'Advanced analytics',
      'Priority support'
    ]
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 129,
    rcnTokens: 1500,
    features: [
      '1,500 RCN tokens',
      'Full dashboard access',
      'Customer rewards system',
      'Cross-shop network access',
      'Basic analytics',
      'Email & chat support',
      'Monthly reports'
    ],
    notIncluded: [
      'Advanced analytics',
      'API access',
      'Custom integrations'
    ]
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 259,
    rcnTokens: 3500,
    popular: true,
    savings: 'Save $90',
    features: [
      '3,500 RCN tokens',
      'Everything in Starter',
      'Advanced analytics',
      'Priority support',
      'API access',
      'Custom reports',
      'Bulk operations',
      'Staff accounts (up to 5)'
    ],
    notIncluded: [
      'Custom integrations',
      'Dedicated account manager'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 499,
    rcnTokens: 7500,
    savings: 'Save $250',
    features: [
      '7,500 RCN tokens',
      'Everything in Professional',
      'Custom integrations',
      'Dedicated account manager',
      'Unlimited staff accounts',
      'White-label options',
      'Custom training',
      'SLA guarantee',
      '24/7 phone support'
    ]
  }
];

export default function ShopPlansPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    // Get shop ID from localStorage (saved during registration)
    const savedShopId = localStorage.getItem('recentlyRegisteredShopId');
    if (savedShopId) {
      setShopId(savedShopId);
    }
  }, []);

  const handleSelectPlan = async (plan: Plan) => {
    if (!account?.address) {
      toast.error('Please connect your wallet');
      return;
    }

    setSelectedPlan(plan.id);
    setProcessing(true);

    try {
      if (plan.id === 'free') {
        // For free plan, redirect directly to dashboard
        toast.success('Free trial activated! Redirecting to dashboard...');
        setTimeout(() => {
          router.push('/shop?tab=purchase');
        }, 2000);
      } else {
        // For paid plans, redirect to purchase tab with plan details
        toast.success(`${plan.name} plan selected! Redirecting to payment...`);
        
        // Store plan details in sessionStorage for the purchase tab
        sessionStorage.setItem('selectedPlan', JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          price: plan.price,
          rcnTokens: plan.rcnTokens
        }));
        
        setTimeout(() => {
          router.push('/shop?tab=purchase&plan=' + plan.id);
        }, 2000);
      }
    } catch (error) {
      console.error('Error selecting plan:', error);
      toast.error('Failed to select plan. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            Choose Your RepairCoin Plan
          </h1>
          <p className="text-xl text-gray-300 mb-2">
            Start building customer loyalty today with RCN tokens
          </p>
          <p className="text-lg text-green-400">
            Your shop is approved! Select a plan to get started immediately.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-gray-800 rounded-2xl p-6 border-2 transition-all duration-300 ${
                plan.popular 
                  ? 'border-yellow-400 shadow-2xl shadow-yellow-400/20 scale-105' 
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black px-4 py-1 rounded-full text-sm font-bold">
                    MOST POPULAR
                  </span>
                </div>
              )}

              {/* Savings Badge */}
              {plan.savings && (
                <div className="absolute -top-4 right-4">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                    {plan.savings}
                  </span>
                </div>
              )}

              {/* Plan Name */}
              <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>

              {/* Price */}
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">
                  ${plan.price}
                </span>
                {plan.price > 0 && (
                  <span className="text-gray-400 ml-2">/month</span>
                )}
              </div>

              {/* RCN Tokens */}
              <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
                <p className="text-yellow-400 font-bold text-lg">
                  {plan.rcnTokens.toLocaleString()} RCN
                </p>
                <p className="text-gray-400 text-sm">
                  ${(plan.rcnTokens * 0.1).toFixed(2)} value
                </p>
              </div>

              {/* Features */}
              <div className="space-y-3 mb-6">
                <p className="text-gray-400 text-sm font-semibold uppercase">Included:</p>
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-start">
                    <CheckIcon className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </div>
                ))}
                
                {plan.notIncluded && plan.notIncluded.length > 0 && (
                  <>
                    <div className="border-t border-gray-700 my-4"></div>
                    {plan.notIncluded.map((feature, index) => (
                      <div key={index} className="flex items-start opacity-50">
                        <XIcon className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-500 text-sm line-through">{feature}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* CTA Button */}
              <button
                onClick={() => handleSelectPlan(plan)}
                disabled={processing && selectedPlan === plan.id}
                className={`w-full py-3 px-4 rounded-lg font-bold transition-all duration-300 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-black hover:from-yellow-300 hover:to-orange-300'
                    : plan.id === 'free'
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500'
                } ${
                  processing && selectedPlan === plan.id
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:scale-105 active:scale-95'
                }`}
              >
                {processing && selectedPlan === plan.id ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processing...
                  </span>
                ) : plan.id === 'free' ? (
                  'Start Free Trial'
                ) : (
                  'Get Started'
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <p className="text-gray-400 mb-4">
            All plans include instant activation • No setup fees • Cancel anytime
          </p>
          <div className="flex items-center justify-center space-x-8">
            <div className="flex items-center">
              <CheckIcon className="w-5 h-5 text-green-400 mr-2" />
              <span className="text-gray-300">30-day money back guarantee</span>
            </div>
            <div className="flex items-center">
              <CheckIcon className="w-5 h-5 text-green-400 mr-2" />
              <span className="text-gray-300">Secure payment processing</span>
            </div>
            <div className="flex items-center">
              <CheckIcon className="w-5 h-5 text-green-400 mr-2" />
              <span className="text-gray-300">24/7 support available</span>
            </div>
          </div>
        </div>

        {/* Skip to Dashboard Link */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/shop')}
            className="text-gray-400 hover:text-gray-300 underline text-sm"
          >
            Skip for now and go to dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}