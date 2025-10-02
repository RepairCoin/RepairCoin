import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Info, ExternalLink, CreditCard, Shield, AlertCircle, X } from 'lucide-react';
import { RCGPurchaseModal } from './RCGPurchaseModal';
import Link from 'next/link';

interface OnboardingModalProps {
  shopData: {
    shopId: string;
    name: string;
    operational_status?: string;
    rcg_balance?: number;
    rcg_tier?: string;
  };
  open: boolean;
  onClose: () => void;
}

export function OnboardingModal({ shopData, open, onClose }: OnboardingModalProps) {
  const [showRCGModal, setShowRCGModal] = useState(false);
  
  const isOperational = shopData.operational_status === 'rcg_qualified' || 
                       shopData.operational_status === 'subscription_qualified';

  const rcgBalance = shopData.rcg_balance || 0;
  const hasEnoughRCG = rcgBalance >= 10000;
  const hasSubscription = shopData.operational_status === 'subscription_qualified';

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl bg-gray-900 border-amber-600/50 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-amber-200">
              <AlertCircle className="h-6 w-6 text-amber-500" />
              <span>Shop Partner Requirements</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-amber-100">
              To operate as a RepairCoin partner shop and purchase RCN tokens, you must meet one of the following requirements:
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              {/* RCG Option */}
              <div className={`bg-black/30 rounded-lg p-4 border ${hasEnoughRCG ? 'border-green-600' : 'border-gray-700'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Shield className={`h-5 w-5 ${hasEnoughRCG ? 'text-green-500' : 'text-gray-400'}`} />
                    <h4 className="font-medium text-white">RCG Governance Tokens</h4>
                  </div>
                  {hasEnoughRCG && (
                    <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
                      ✓ Qualified
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-300 mb-3">
                  Hold at least 10,000 RCG tokens to become a partner shop. Higher holdings unlock better RCN pricing tiers.
                </p>
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Your Balance:</span>
                    <span className={`font-medium ${hasEnoughRCG ? 'text-green-400' : 'text-amber-400'}`}>
                      {rcgBalance.toLocaleString()} RCG
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Required:</span>
                    <span className="font-medium text-white">10,000 RCG</span>
                  </div>
                  {!hasEnoughRCG && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Need:</span>
                      <span className="font-medium text-amber-400">
                        {(10000 - rcgBalance).toLocaleString()} more RCG
                      </span>
                    </div>
                  )}
                </div>
                {!hasEnoughRCG && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white border-amber-700"
                    onClick={() => setShowRCGModal(true)}
                  >
                    Buy RCG Tokens
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Monthly Subscription Option */}
              <div className={`bg-black/30 rounded-lg p-4 border ${hasSubscription ? 'border-green-600' : 'border-gray-700'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <CreditCard className={`h-5 w-5 ${hasSubscription ? 'text-green-500' : 'text-gray-400'}`} />
                    <h4 className="font-medium text-white">Monthly Subscription</h4>
                  </div>
                  {hasSubscription && (
                    <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
                      ✓ Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-300 mb-3">
                  Pay $500/month to operate without RCG tokens. Cancel anytime.
                </p>
                <div className="space-y-1 mb-3 text-sm text-gray-400">
                  <div>• Monthly payment plan</div>
                  <div>• Standard RCN pricing ($0.10)</div>
                  <div>• No upfront token purchase</div>
                </div>
                {!hasSubscription && (
                  <Link href="/shop/subscription-form">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white border-blue-700"
                      onClick={onClose}
                    >
                      Start Monthly Subscription
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            <Alert className="bg-red-900/20 border-red-600/50">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-red-200">
                <strong>Important:</strong> You cannot purchase RCN tokens or issue rewards to customers until you meet one of these requirements.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end pt-4 border-t border-gray-700">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <RCGPurchaseModal
        open={showRCGModal}
        onClose={() => setShowRCGModal(false)}
        currentBalance={rcgBalance}
        currentTier={shopData.rcg_tier || 'none'}
        nextTierRequired={10000}
      />
    </>
  );
}