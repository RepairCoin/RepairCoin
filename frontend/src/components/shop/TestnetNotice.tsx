import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface TestnetNoticeProps {
  className?: string;
}

export function TestnetNotice({ className = '' }: TestnetNoticeProps) {
  return (
    <Alert className={`bg-amber-900/20 border-amber-700 ${className}`}>
      <AlertCircle className="h-4 w-4 text-amber-400" />
      <AlertDescription className="text-amber-300">
        <span className="font-semibold">Testnet Mode:</span> RCG is currently deployed on Base Sepolia testnet. 
        DEX trading and real pricing will be available when we launch on mainnet.
      </AlertDescription>
    </Alert>
  );
}