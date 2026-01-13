'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePaymentPolling } from '@/hooks/usePaymentPolling';
import { ExternalLink, RefreshCw, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react';

type ModalState = 'waiting' | 'success' | 'timeout' | 'error';

interface PaymentWaitingModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseId: string;
  amount: number;
  totalCost: number;
  checkoutUrl: string;
  onSuccess: (purchaseId: string, amount: number) => void;
  onError: (error: string) => void;
}

export const PaymentWaitingModal: React.FC<PaymentWaitingModalProps> = ({
  isOpen,
  onClose,
  purchaseId,
  amount,
  totalCost,
  checkoutUrl,
  onSuccess,
  onError,
}) => {
  const [modalState, setModalState] = useState<ModalState>('waiting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const stripeWindowRef = useRef<Window | null>(null);
  const hasOpenedStripeRef = useRef<boolean>(false);

  // Open Stripe checkout in new tab
  const openStripeCheckout = useCallback(() => {
    console.log('[PaymentWaitingModal] Opening Stripe checkout:', checkoutUrl);
    stripeWindowRef.current = window.open(checkoutUrl, '_blank');
  }, [checkoutUrl]);

  // Open Stripe on mount (only once)
  useEffect(() => {
    if (isOpen && checkoutUrl && !hasOpenedStripeRef.current) {
      hasOpenedStripeRef.current = true;
      // Small delay to ensure modal is visible first
      setTimeout(() => {
        openStripeCheckout();
      }, 500);
    }
  }, [isOpen, checkoutUrl, openStripeCheckout]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      hasOpenedStripeRef.current = false;
      setModalState('waiting');
      setErrorMessage('');
    }
  }, [isOpen]);

  // Handle successful payment
  const handlePaymentSuccess = useCallback((data: { status: string; amount?: number }) => {
    console.log('[PaymentWaitingModal] Payment successful:', data);
    setModalState('success');
    // Close Stripe window if still open
    if (stripeWindowRef.current && !stripeWindowRef.current.closed) {
      stripeWindowRef.current.close();
    }
  }, []);

  // Handle timeout
  const handleTimeout = useCallback(() => {
    console.log('[PaymentWaitingModal] Payment timeout');
    setModalState('timeout');
  }, []);

  // Handle error
  const handleError = useCallback((error: string) => {
    console.log('[PaymentWaitingModal] Payment error:', error);
    setErrorMessage(error);
    setModalState('error');
  }, []);

  // Use payment polling hook
  const { elapsedSeconds, isPolling, checkNow } = usePaymentPolling({
    purchaseId,
    enabled: isOpen && modalState === 'waiting',
    interval: 2500,
    timeout: 120000, // 2 minutes
    onSuccess: handlePaymentSuccess,
    onTimeout: handleTimeout,
    onError: handleError,
  });

  // Handle retry from timeout state
  const handleRetry = () => {
    setModalState('waiting');
    checkNow();
  };

  // Handle continue after success
  const handleContinue = () => {
    onSuccess(purchaseId, amount);
  };

  // Handle cancel
  const handleCancel = () => {
    // Close Stripe window if still open
    if (stripeWindowRef.current && !stripeWindowRef.current.closed) {
      stripeWindowRef.current.close();
    }
    onClose();
  };

  // Handle error close
  const handleErrorClose = () => {
    onError(errorMessage);
  };

  // Format elapsed time
  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Prevent closing during waiting state
  const handleOpenChange = (open: boolean) => {
    if (!open && modalState === 'waiting') {
      // Don't allow closing during waiting state
      return;
    }
    if (!open) {
      handleCancel();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md w-full bg-[#1e1f22] border-gray-700"
        onPointerDownOutside={(e) => {
          // Prevent closing on backdrop click during waiting state
          if (modalState === 'waiting') {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing on escape during waiting state
          if (modalState === 'waiting') {
            e.preventDefault();
          }
        }}
      >
        {/* WAITING STATE */}
        {modalState === 'waiting' && (
          <>
            <DialogHeader className="text-center">
              <DialogTitle className="text-xl text-white flex items-center justify-center gap-2">
                <Clock className="w-5 h-5 text-[#FFCC00] animate-pulse" />
                Waiting for Payment...
              </DialogTitle>
              <DialogDescription className="text-gray-400 pt-2">
                Complete your payment in the Stripe window that opened.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center py-8 space-y-6">
              {/* Spinner */}
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-700 border-t-[#FFCC00]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[#FFCC00] text-lg font-bold">R</span>
                </div>
              </div>

              {/* Amount Info */}
              <div className="bg-gray-800/50 rounded-xl px-6 py-4 text-center">
                <p className="text-gray-400 text-sm">Amount</p>
                <p className="text-white text-2xl font-bold">{amount.toLocaleString()} RCN</p>
                <p className="text-gray-500 text-sm">${totalCost.toFixed(2)} USD</p>
              </div>

              {/* Elapsed Time */}
              <div className="text-gray-500 text-sm flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 ${isPolling ? 'animate-spin' : ''}`} />
                Checking status... {formatElapsed(elapsedSeconds)}
              </div>

              {/* Reopen Button */}
              <Button
                variant="outline"
                onClick={openStripeCheckout}
                className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                <ExternalLink className="w-4 h-4" />
                Open Payment Window Again
              </Button>

              <p className="text-gray-500 text-xs text-center max-w-xs">
                Don't see the payment window? Click the button above or check if it was blocked by your browser.
              </p>
            </div>
          </>
        )}

        {/* SUCCESS STATE */}
        {modalState === 'success' && (
          <>
            <DialogHeader className="text-center">
              <DialogTitle className="text-xl text-[#FFCC00] flex items-center justify-center gap-2">
                <CheckCircle className="w-6 h-6" />
                Payment Successful!
              </DialogTitle>
              <DialogDescription className="text-gray-400 pt-2">
                Your RCN tokens have been added to your account.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center py-8 space-y-6">
              {/* Success Animation */}
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFCC00] to-[#FFA500] flex items-center justify-center animate-bounce">
                  <CheckCircle className="w-10 h-10 text-gray-900" />
                </div>
                {/* Coin particles */}
                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-[#FFCC00] animate-ping opacity-75" />
                <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[#FFA500] animate-ping opacity-50" style={{ animationDelay: '0.2s' }} />
                <div className="absolute -bottom-2 left-1/2 w-5 h-5 rounded-full bg-[#FFCC00] animate-ping opacity-60" style={{ animationDelay: '0.4s' }} />
              </div>

              {/* Amount Info */}
              <div className="bg-green-900/30 border border-green-700/50 rounded-xl px-8 py-4 text-center">
                <p className="text-green-400 text-sm">Tokens Added</p>
                <p className="text-white text-3xl font-bold">+{amount.toLocaleString()} RCN</p>
              </div>

              {/* Continue Button */}
              <Button
                onClick={handleContinue}
                className="bg-[#FFCC00] hover:bg-[#FFCC00]/90 text-gray-900 font-bold px-8 py-3 rounded-full"
              >
                Continue
              </Button>
            </div>
          </>
        )}

        {/* TIMEOUT STATE */}
        {modalState === 'timeout' && (
          <>
            <DialogHeader className="text-center">
              <DialogTitle className="text-xl text-orange-400 flex items-center justify-center gap-2">
                <AlertCircle className="w-6 h-6" />
                Payment Timeout
              </DialogTitle>
              <DialogDescription className="text-gray-400 pt-2">
                We haven't received confirmation of your payment yet.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center py-8 space-y-6">
              {/* Info */}
              <div className="bg-orange-900/20 border border-orange-700/50 rounded-xl px-6 py-4 text-center max-w-sm">
                <p className="text-gray-300 text-sm">
                  If you completed your payment, it may take a moment to process.
                  Click below to check again.
                </p>
              </div>

              {/* Amount Reminder */}
              <div className="text-center">
                <p className="text-gray-500 text-sm">Pending purchase</p>
                <p className="text-white text-xl font-semibold">{amount.toLocaleString()} RCN</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button
                  onClick={handleRetry}
                  className="bg-[#FFCC00] hover:bg-[#FFCC00]/90 text-gray-900 font-semibold px-6"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Check Status Again
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </Button>
              </div>

              <p className="text-gray-500 text-xs text-center">
                Your balance will update automatically once payment is confirmed.
              </p>
            </div>
          </>
        )}

        {/* ERROR STATE */}
        {modalState === 'error' && (
          <>
            <DialogHeader className="text-center">
              <DialogTitle className="text-xl text-red-400 flex items-center justify-center gap-2">
                <XCircle className="w-6 h-6" />
                Payment Failed
              </DialogTitle>
              <DialogDescription className="text-gray-400 pt-2">
                There was a problem with your payment.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center py-8 space-y-6">
              {/* Error Message */}
              <div className="bg-red-900/20 border border-red-700/50 rounded-xl px-6 py-4 text-center max-w-sm">
                <p className="text-red-300 text-sm">
                  {errorMessage || 'Payment session has expired. Please create a new purchase.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button
                  onClick={handleErrorClose}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6"
                >
                  Close
                </Button>
              </div>

              <p className="text-gray-500 text-xs text-center">
                If you believe this is an error, please contact support.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentWaitingModal;
