import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink, ShieldCheck, Package, Users, Building2 } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface RCGPurchaseModalProps {
  open: boolean;
  onClose: () => void;
  currentBalance: number;
  currentTier: string;
  nextTierRequired: number;
}

export function RCGPurchaseModal({ 
  open, 
  onClose, 
  currentBalance, 
  currentTier,
  nextTierRequired 
}: RCGPurchaseModalProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const purchaseOptions = [
    {
      id: 'uniswap',
      title: 'DEX Trading',
      subtitle: 'Coming Soon',
      description: 'Will be available on Base mainnet',
      icon: ExternalLink,
      color: 'text-gray-400',
      bgColor: 'bg-gray-900/20',
      action: () => alert('DEX trading will be available when RCG launches on Base mainnet. Currently on testnet.'),
      features: ['Not on testnet', 'Mainnet only', 'Coming soon'],
      disabled: true
    },
    {
      id: 'otc',
      title: 'Bulk Purchase',
      subtitle: 'Market + 5%',
      description: 'Large purchases with support',
      icon: Package,
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/20',
      action: () => window.location.href = '/shop/rcg-otc',
      features: ['10K-200K', 'Support', 'Flexible pay'],
      recommended: nextTierRequired > 0 && (nextTierRequired - currentBalance) >= 10000
    },
    {
      id: 'private',
      title: 'Private Sale',
      subtitle: 'Market - 5-15%',
      description: 'Volume discounts for 100K+',
      icon: Building2,
      color: 'text-purple-400',
      bgColor: 'bg-purple-900/20',
      action: () => window.location.href = 'mailto:rcg-sales@repaircoin.com?subject=Private RCG Sale Inquiry',
      features: ['100K+ only', 'Best price', 'Vesting']
    },
    {
      id: 'commitment',
      title: 'Commitment',
      subtitle: '$500/month',
      description: 'No RCG required',
      icon: ShieldCheck,
      color: 'text-green-400',
      bgColor: 'bg-green-900/20',
      action: () => window.location.href = '/shop?tab=subscription',
      features: ['No upfront', '6 months', 'Standard tier'],
      available: currentTier === 'none'
    }
  ];

  const recommendedAmount = nextTierRequired > 0 ? nextTierRequired - currentBalance : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#1a1a1a] border-gray-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <DialogTitle className="text-xl text-[#FFCC00]">Purchase RCG Tokens</DialogTitle>
          {nextTierRequired > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              Need {formatNumber(recommendedAmount)} RCG for next tier • Current: {formatNumber(currentBalance)} RCG
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Testnet Notice */}
          <div className="bg-amber-900/20 border border-amber-700 rounded-lg px-3 py-2">
            <p className="text-xs text-amber-300">
              <span className="font-semibold">Testnet:</span> RCG trading will be available on mainnet launch
            </p>
          </div>

          {/* Purchase Options */}
          <div className="grid gap-3">
            {purchaseOptions.filter(opt => opt.available !== false).map(option => (
              <Card 
                key={option.id}
                className={`bg-[#212121] border-gray-700 transition-all ${
                  option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                } ${
                  selectedOption === option.id && !option.disabled ? 'ring-2 ring-[#FFCC00]' : ''
                } ${option.recommended ? 'ring-1 ring-green-500' : ''}`}
                onClick={() => !option.disabled && setSelectedOption(option.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${option.bgColor} flex-shrink-0`}>
                      <option.icon className={`h-5 w-5 ${option.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-white text-sm">{option.title}</h3>
                          <p className="text-xs text-gray-400">{option.subtitle}</p>
                        </div>
                        {option.recommended && (
                          <span className="text-xs bg-green-900/20 text-green-400 px-2 py-0.5 rounded-full whitespace-nowrap">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-300 mt-1.5 line-clamp-2">{option.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {option.features.map((feature, i) => (
                          <span key={i} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={onClose}
              className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const option = purchaseOptions.find(opt => opt.id === selectedOption);
                if (option) {
                  option.action();
                  onClose();
                }
              }}
              disabled={!selectedOption}
              className="bg-[#FFCC00] text-black hover:bg-[#FFDD33]"
            >
              Proceed
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}