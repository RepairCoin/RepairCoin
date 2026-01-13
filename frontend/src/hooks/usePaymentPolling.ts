'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import apiClient from '@/services/api/client';

interface PurchaseStatusData {
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  amount?: number;
  stripeStatus?: string;
  sessionStatus?: string;
  message?: string;
  reason?: string;
}

interface UsePaymentPollingOptions {
  purchaseId: string;
  enabled: boolean;
  interval?: number;  // default 2500ms
  timeout?: number;   // default 120000ms (2 min)
  onSuccess: (data: PurchaseStatusData) => void;
  onTimeout: () => void;
  onError: (error: string) => void;
}

/**
 * Smart Payment Polling Hook
 *
 * Polls the purchase status endpoint until payment is confirmed or timeout.
 * Uses setTimeout (not setInterval) for smart polling.
 * Pauses when tab is not visible, resumes when visible.
 *
 * @param options - Configuration options
 * @returns { elapsedSeconds, isPolling, checkNow }
 */
export function usePaymentPolling({
  purchaseId,
  enabled,
  interval = 2500,
  timeout = 120000, // 2 minutes
  onSuccess,
  onTimeout,
  onError,
}: UsePaymentPollingOptions) {
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const isPollingRef = useRef<boolean>(false);
  const hasCompletedRef = useRef<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPolling, setIsPolling] = useState(false);

  // Update elapsed time every second
  useEffect(() => {
    if (!enabled) return;

    const elapsedInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(elapsedInterval);
  }, [enabled]);

  /**
   * Single poll request
   */
  const poll = useCallback(async () => {
    // Skip if not enabled, already polling, or already completed
    if (!enabled || isPollingRef.current || hasCompletedRef.current) {
      return;
    }

    // Check timeout
    const elapsed = Date.now() - startTimeRef.current;
    if (elapsed >= timeout) {
      console.log('[usePaymentPolling] Timeout reached after', Math.floor(elapsed / 1000), 'seconds');
      setIsPolling(false);
      onTimeout();
      return;
    }

    isPollingRef.current = true;
    setIsPolling(true);

    try {
      console.log('[usePaymentPolling] Checking purchase status for:', purchaseId);

      const response = await apiClient.post(`/shops/purchase-sync/check-payment/${purchaseId}`);

      console.log('[usePaymentPolling] Response:', response);

      // Handle completed status
      if (response.success && response.data?.status === 'completed') {
        console.log('[usePaymentPolling] Payment completed!');
        hasCompletedRef.current = true;
        setIsPolling(false);
        onSuccess(response.data);
        return;
      }

      // Handle failed/expired status
      if (response.data?.status === 'failed' || response.data?.reason === 'expired') {
        console.log('[usePaymentPolling] Payment failed or expired');
        hasCompletedRef.current = true;
        setIsPolling(false);
        onError(response.message || 'Payment session has expired. Please create a new purchase.');
        return;
      }

      // Still pending - schedule next poll
      console.log('[usePaymentPolling] Still pending, polling again in', interval, 'ms');
      pollTimeoutRef.current = setTimeout(poll, interval);

    } catch (error) {
      console.error('[usePaymentPolling] Error checking status:', error);
      // On error, continue polling (network might be temporarily unavailable)
      pollTimeoutRef.current = setTimeout(poll, interval);
    } finally {
      isPollingRef.current = false;
    }
  }, [purchaseId, enabled, interval, timeout, onSuccess, onTimeout, onError]);

  /**
   * Manual check - useful for retry button
   */
  const checkNow = useCallback(() => {
    // Reset timeout and completion state for manual retry
    startTimeRef.current = Date.now();
    hasCompletedRef.current = false;
    setElapsedSeconds(0);

    // Clear any existing timeout
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }

    // Start polling immediately
    poll();
  }, [poll]);

  /**
   * Handle page visibility changes - pause when hidden, resume when visible
   */
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible' && enabled && !hasCompletedRef.current) {
      console.log('[usePaymentPolling] Tab visible again, checking status immediately');
      // Check immediately when user returns
      if (!isPollingRef.current) {
        poll();
      }
    }
  }, [enabled, poll]);

  // Start polling when enabled
  useEffect(() => {
    if (enabled && !hasCompletedRef.current) {
      console.log('[usePaymentPolling] Starting polling for purchase:', purchaseId);
      startTimeRef.current = Date.now();
      poll();
    }

    return () => {
      // Cleanup on unmount or when disabled
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [enabled, purchaseId, poll]);

  // Handle visibility changes
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  return {
    elapsedSeconds,
    isPolling,
    checkNow,
  };
}
