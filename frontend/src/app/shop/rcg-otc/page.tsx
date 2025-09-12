'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package, Shield, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { useActiveAccount } from 'thirdweb/react';
import { useRCGPrice } from '@/hooks/useRCGPrice';

export default function RCGOTCPurchase() {
  const router = useRouter();
  const account = useActiveAccount();
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { marketPrice, loading: priceLoading, error: priceError, lastUpdated, refetch } = useRCGPrice();

  const otcPremium = 0.05; // 5% premium for convenience
  const effectivePrice = marketPrice * (1 + otcPremium);

  const packages = [
    {
      id: 'standard',
      name: 'Standard Tier Package',
      amount: 10000,
      price: 10000 * effectivePrice, // Market price + 5%
      tier: 'Standard',
      discount: '0%',
      benefits: [
        'Unlock Standard tier benefits',
        'Pay $0.10 per RCN (no discount)',
        'Join RepairCoin partner network',
        'Basic governance rights'
      ]
    },
    {
      id: 'premium',
      name: 'Premium Tier Package',
      amount: 50000,
      price: 50000 * effectivePrice, // Market price + 5%
      tier: 'Premium',
      discount: '20%',
      benefits: [
        'Unlock Premium tier benefits',
        'Pay $0.08 per RCN (20% discount)',
        'Priority support access',
        'Enhanced governance rights'
      ]
    },
    {
      id: 'elite',
      name: 'Elite Tier Package',
      amount: 200000,
      price: 200000 * effectivePrice, // Market price + 5%
      tier: 'Elite',
      discount: '40%',
      benefits: [
        'Unlock Elite tier benefits',
        'Pay $0.06 per RCN (40% discount)',
        'Dedicated account manager',
        'Maximum governance influence'
      ]
    }
  ];

  const handlePurchase = async () => {
    if (!selectedPackage || !account) return;
    
    setIsProcessing(true);
    
    // In a real implementation, this would:
    // 1. Create a payment request to the treasury
    // 2. Process payment via Stripe/crypto
    // 3. Execute RCG transfer from treasury wallet
    // 4. Update shop tier in database
    
    // For now, redirect to contact form
    const pkg = packages.find(p => p.id === selectedPackage);
    const subject = `OTC Purchase Request: ${pkg?.name}`;
    const body = `
Shop Wallet: ${account.address}
Package: ${pkg?.name}
RCG Amount: ${formatNumber(pkg?.amount || 0)}
Total Price: $${formatNumber(pkg?.price || 0)}

Please process this OTC purchase request.
    `;
    
    window.location.href = `mailto:treasury@repaircoin.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setIsProcessing(false);
  };

  if (!account) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="bg-amber-900/20 border-amber-700">
          <AlertCircle className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-300">
            Please connect your wallet to continue with OTC purchase
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#FFCC00] mb-2">RCG Bulk Purchase</h1>
        <p className="text-gray-400">Purchase RCG tokens in bulk at current market price + 5% convenience fee</p>
      </div>

      <div className="grid gap-6 mb-8">
        {/* Market Price Display */}
        <Card className="bg-[#212121] border-gray-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white">Current Pricing</CardTitle>
              {!priceLoading && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => refetch()}
                  className="text-gray-400 hover:text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {priceLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-gray-700 rounded animate-pulse" />
                <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4" />
              </div>
            ) : priceError ? (
              <Alert className="bg-red-900/20 border-red-700">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-300 text-sm">
                  Unable to fetch current price. Using fallback pricing.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Market Price (Uniswap):</span>
                  <span className="text-white">${marketPrice.toFixed(4)} per RCG</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Convenience Premium:</span>
                  <span className="text-white">+5%</span>
                </div>
                <div className="border-t border-gray-700 pt-2 flex justify-between text-sm">
                  <span className="text-gray-400">Your Price:</span>
                  <span className="text-[#FFCC00] font-bold">${effectivePrice.toFixed(4)} per RCG</span>
                </div>
                {lastUpdated && (
                  <p className="text-xs text-gray-500 mt-2">
                    Testnet pricing (mock data) • Updated: {lastUpdated.toLocaleTimeString()}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Alert className="bg-blue-900/20 border-blue-700">
          <Shield className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-300">
            Bulk purchases include white-glove service: assistance with wallet setup, transaction execution, and ongoing support.
          </AlertDescription>
        </Alert>

        <RadioGroup value={selectedPackage} onValueChange={setSelectedPackage}>
          {packages.map((pkg) => (
            <Card 
              key={pkg.id} 
              className={`bg-[#212121] border-gray-700 cursor-pointer transition-all ${
                selectedPackage === pkg.id ? 'ring-2 ring-[#FFCC00]' : ''
              }`}
              onClick={() => setSelectedPackage(pkg.id)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value={pkg.id} />
                    <div>
                      <CardTitle className="text-xl text-white">{pkg.name}</CardTitle>
                      <CardDescription className="text-gray-400">
                        {formatNumber(pkg.amount)} RCG for ${formatNumber(pkg.price)}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#FFCC00]">{pkg.discount}</p>
                    <p className="text-sm text-gray-400">RCN discount</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Price per RCG:</span>
                    <span className="text-white">${(pkg.price / pkg.amount).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-700 pt-3">
                    <p className="text-sm font-medium text-gray-300 mb-2">Benefits:</p>
                    <ul className="space-y-1">
                      {pkg.benefits.map((benefit, i) => (
                        <li key={i} className="text-sm text-gray-400 flex items-center gap-2">
                          <TrendingUp className="h-3 w-3 text-green-400" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </RadioGroup>

        {selectedPackage && (
          <Card className="bg-[#212121] border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-white">Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Your Wallet:</span>
                  <span className="text-white font-mono text-xs">{account.address}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">RCG Amount:</span>
                  <span className="text-white">{formatNumber(packages.find(p => p.id === selectedPackage)?.amount || 0)} RCG</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Price:</span>
                  <span className="text-[#FFCC00] font-bold">${formatNumber(packages.find(p => p.id === selectedPackage)?.price || 0)}</span>
                </div>
              </div>
              
              <Alert className="bg-gray-800 border-gray-700">
                <Package className="h-4 w-4 text-gray-400" />
                <AlertDescription className="text-gray-300 text-sm">
                  Payment options include USDC, bank transfer, or credit card. Our team will contact you within 24 hours to complete the purchase.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={!selectedPackage || isProcessing}
            className="flex-1 bg-[#FFCC00] text-black hover:bg-[#FFDD33]"
          >
            {isProcessing ? 'Processing...' : 'Submit Purchase Request'}
          </Button>
        </div>
      </div>
    </div>
  );
}