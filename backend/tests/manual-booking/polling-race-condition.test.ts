/**
 * Polling Race Condition Tests
 *
 * These tests simulate the exact polling behavior from the frontend
 * ManualBookingModal and AppointmentsTab to verify:
 *
 * 1. The `cancelled` flag prevents orphaned timer chains
 * 2. Effect cleanup properly stops all async operations
 * 3. Multiple rapid effect re-runs don't accumulate timers
 * 4. No infinite loops or memory leaks from polling
 *
 * This is a pure logic test - no React, no DOM, just the timer/async behavior.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Use real timers for race condition testing
// (fake timers can mask the actual race)
describe('Polling Race Condition Prevention', () => {
  let activeTimers: Set<NodeJS.Timeout>;

  beforeEach(() => {
    activeTimers = new Set();
  });

  afterEach(() => {
    // Force-clear any lingering timers
    activeTimers.forEach(t => clearTimeout(t));
    activeTimers.clear();
  });

  /**
   * Simulates the FIXED polling effect from ManualBookingModal.
   * Returns a cleanup function (like React useEffect cleanup).
   */
  function simulatePollingEffect(options: {
    pollFn: () => Promise<{ paymentStatus: string }>;
    onPaid: () => void;
    intervalMs: number;
  }): { cleanup: () => void; getTimerCount: () => number } {
    let cancelled = false;
    let timerRef: NodeJS.Timeout | null = null;
    let timerCount = 0;

    const pollStatus = async () => {
      if (cancelled) return;
      try {
        const result = await options.pollFn();
        if (cancelled) return;
        if (result.paymentStatus === 'paid') {
          options.onPaid();
          return; // Stop polling
        }
      } catch {
        if (cancelled) return;
      }
      if (!cancelled) {
        timerCount++;
        timerRef = setTimeout(pollStatus, options.intervalMs);
        activeTimers.add(timerRef);
      }
    };

    timerCount++;
    timerRef = setTimeout(pollStatus, options.intervalMs);
    activeTimers.add(timerRef);

    return {
      cleanup: () => {
        cancelled = true;
        if (timerRef) {
          clearTimeout(timerRef);
          activeTimers.delete(timerRef);
          timerRef = null;
        }
      },
      getTimerCount: () => timerCount,
    };
  }

  /**
   * Simulates the BROKEN polling effect (without cancelled flag).
   * This is what the OLD code looked like - for comparison.
   */
  function simulateBrokenPollingEffect(options: {
    pollFn: () => Promise<{ paymentStatus: string }>;
    onPaid: () => void;
    intervalMs: number;
  }): { cleanup: () => void; orphanedTimers: NodeJS.Timeout[] } {
    let timerRef: NodeJS.Timeout | null = null;
    const orphanedTimers: NodeJS.Timeout[] = [];

    const pollStatus = async () => {
      try {
        const result = await options.pollFn();
        if (result.paymentStatus === 'paid') {
          options.onPaid();
          return;
        }
      } catch {
        // ignore
      }
      // BUG: No cancelled check - creates orphaned timer after cleanup
      const newTimer = setTimeout(pollStatus, options.intervalMs);
      timerRef = newTimer;
      orphanedTimers.push(newTimer);
      activeTimers.add(newTimer);
    };

    timerRef = setTimeout(pollStatus, options.intervalMs);
    activeTimers.add(timerRef);

    return {
      cleanup: () => {
        if (timerRef) {
          clearTimeout(timerRef);
          activeTimers.delete(timerRef);
          timerRef = null;
        }
      },
      orphanedTimers,
    };
  }

  // ============================================================
  // Test 1: Fixed polling stops cleanly on cleanup
  // ============================================================
  it('should stop polling when cleanup is called (cancelled flag)', async () => {
    let pollCount = 0;
    const pollFn = jest.fn<() => Promise<{ paymentStatus: string }>>().mockImplementation(async () => {
      pollCount++;
      return { paymentStatus: 'pending' };
    });
    const onPaid = jest.fn();

    const { cleanup } = simulatePollingEffect({
      pollFn,
      onPaid,
      intervalMs: 50,
    });

    // Let it poll twice
    await new Promise(r => setTimeout(r, 130));

    // Cleanup (simulates React effect cleanup)
    cleanup();

    const countAtCleanup = pollCount;

    // Wait to see if any orphaned polls happen
    await new Promise(r => setTimeout(r, 200));

    // Poll count should NOT have increased after cleanup
    expect(pollCount).toBe(countAtCleanup);
    expect(onPaid).not.toHaveBeenCalled();
  });

  // ============================================================
  // Test 2: Fixed polling stops when payment is detected
  // ============================================================
  it('should stop polling when payment status is paid', async () => {
    let pollCount = 0;
    const pollFn = jest.fn<() => Promise<{ paymentStatus: string }>>().mockImplementation(async () => {
      pollCount++;
      // Return paid on 3rd poll
      return { paymentStatus: pollCount >= 3 ? 'paid' : 'pending' };
    });
    const onPaid = jest.fn();

    const { cleanup } = simulatePollingEffect({
      pollFn,
      onPaid,
      intervalMs: 50,
    });

    // Wait for payment to be detected
    await new Promise(r => setTimeout(r, 400));

    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(pollCount).toBe(3); // Exactly 3 polls, then stops

    // Wait more - no additional polls should happen
    await new Promise(r => setTimeout(r, 200));
    expect(pollCount).toBe(3);

    cleanup();
  });

  // ============================================================
  // Test 3: Cleanup during in-flight API call doesn't create orphan
  // ============================================================
  it('should not create orphaned timer when cleanup happens during API call', async () => {
    let pollCount = 0;
    let resolveApiCall: ((v: { paymentStatus: string }) => void) | null = null;

    const pollFn = jest.fn<() => Promise<{ paymentStatus: string }>>().mockImplementation(() => {
      pollCount++;
      // Return a promise that we control (simulates slow API call)
      return new Promise(resolve => {
        resolveApiCall = resolve;
      });
    });
    const onPaid = jest.fn();

    const { cleanup } = simulatePollingEffect({
      pollFn,
      onPaid,
      intervalMs: 50,
    });

    // Wait for first poll to start
    await new Promise(r => setTimeout(r, 60));
    expect(pollCount).toBe(1);

    // Cleanup while API call is in-flight (simulates effect re-run)
    cleanup();

    // Now resolve the in-flight API call
    if (resolveApiCall) {
      resolveApiCall({ paymentStatus: 'pending' });
    }

    // Wait for any potential orphaned timer
    await new Promise(r => setTimeout(r, 200));

    // KEY ASSERTION: Only 1 poll happened, no orphaned continuation
    expect(pollCount).toBe(1);
  });

  // ============================================================
  // Test 4: Multiple rapid cleanups don't accumulate timers
  // ============================================================
  it('should handle rapid effect re-runs without timer accumulation', async () => {
    let totalPolls = 0;
    const pollFn = jest.fn<() => Promise<{ paymentStatus: string }>>().mockImplementation(async () => {
      totalPolls++;
      return { paymentStatus: 'pending' };
    });
    const onPaid = jest.fn();

    // Simulate 10 rapid effect re-runs (like React re-renders)
    const effects: ReturnType<typeof simulatePollingEffect>[] = [];
    for (let i = 0; i < 10; i++) {
      // Cleanup previous effect
      if (effects.length > 0) {
        effects[effects.length - 1].cleanup();
      }
      // Start new effect
      effects.push(simulatePollingEffect({
        pollFn,
        onPaid,
        intervalMs: 50,
      }));
    }

    // Wait for a polling cycle
    await new Promise(r => setTimeout(r, 130));

    // Cleanup the last effect
    effects[effects.length - 1].cleanup();

    const pollsAfterCleanup = totalPolls;

    // Wait more - nothing should poll
    await new Promise(r => setTimeout(r, 200));

    // Should NOT have exponential polls. Only the last effect should have polled.
    // With 10 rapid re-runs at 50ms interval, max ~2 polls from last effect
    expect(totalPolls).toBeLessThanOrEqual(pollsAfterCleanup);
    // Total polls should be small (not 10x or exponential)
    expect(totalPolls).toBeLessThan(5);
  });

  // ============================================================
  // Test 5: BROKEN version DOES create orphaned timers
  // (This proves the bug existed and our fix is necessary)
  // ============================================================
  it('BROKEN: old code creates orphaned timer on cleanup during API call', async () => {
    let pollCount = 0;
    let resolveApiCall: ((v: { paymentStatus: string }) => void) | null = null;

    const pollFn = jest.fn<() => Promise<{ paymentStatus: string }>>().mockImplementation(() => {
      pollCount++;
      return new Promise(resolve => {
        resolveApiCall = resolve;
      });
    });
    const onPaid = jest.fn();

    const { cleanup, orphanedTimers } = simulateBrokenPollingEffect({
      pollFn,
      onPaid,
      intervalMs: 50,
    });

    // Wait for first poll to start
    await new Promise(r => setTimeout(r, 60));
    expect(pollCount).toBe(1);

    // Cleanup while API call is in-flight
    cleanup();

    // Resolve the in-flight call AFTER cleanup
    if (resolveApiCall) {
      resolveApiCall({ paymentStatus: 'pending' });
    }

    // Wait for orphaned timer to fire
    await new Promise(r => setTimeout(r, 150));

    // BUG PROOF: The broken version continues polling after cleanup!
    expect(pollCount).toBeGreaterThan(1);

    // Force cleanup orphaned timers
    orphanedTimers.forEach(t => {
      clearTimeout(t);
      activeTimers.delete(t);
    });
  });

  // ============================================================
  // Test 6: Error handling doesn't break polling
  // ============================================================
  it('should continue polling after API errors', async () => {
    let pollCount = 0;
    const pollFn = jest.fn<() => Promise<{ paymentStatus: string }>>().mockImplementation(async () => {
      pollCount++;
      if (pollCount <= 2) {
        throw new Error('Network error');
      }
      return { paymentStatus: 'paid' };
    });
    const onPaid = jest.fn();

    const { cleanup } = simulatePollingEffect({
      pollFn,
      onPaid,
      intervalMs: 50,
    });

    // Wait for enough polls (2 errors + 1 success)
    await new Promise(r => setTimeout(r, 300));

    expect(pollCount).toBe(3);
    expect(onPaid).toHaveBeenCalledTimes(1);

    cleanup();
  });

  // ============================================================
  // Test 7: Concurrent WebSocket + Polling doesn't double-fire
  // ============================================================
  it('should handle WebSocket event stopping polling correctly', async () => {
    let pollCount = 0;
    let paymentConfirmed = false;

    const pollFn = jest.fn<() => Promise<{ paymentStatus: string }>>().mockImplementation(async () => {
      pollCount++;
      // Simulate: payment detected by WebSocket before poll returns
      if (paymentConfirmed) return { paymentStatus: 'paid' };
      return { paymentStatus: 'pending' };
    });

    let paidCount = 0;
    const onPaid = jest.fn().mockImplementation(() => {
      paidCount++;
    });

    const effect = simulatePollingEffect({
      pollFn,
      onPaid,
      intervalMs: 50,
    });

    // Wait for first poll
    await new Promise(r => setTimeout(r, 60));

    // Simulate WebSocket event arriving (sets paymentConfirmed = true)
    paymentConfirmed = true;
    effect.cleanup(); // Cleanup stops polling

    // Wait to see if any extra fires happen
    await new Promise(r => setTimeout(r, 200));

    // onPaid should have been called 0 times from polling
    // (WebSocket handler would call it separately in the real code)
    // The key is no crash, no infinite loop
    expect(paidCount).toBe(0);
    expect(pollCount).toBeLessThanOrEqual(2);
  });
});

// ============================================================
// Test Suite: usePaymentPolling callback stability
// ============================================================
describe('usePaymentPolling Callback Ref Stability', () => {
  /**
   * Simulates the FIXED usePaymentPolling hook behavior where
   * callbacks are stored in refs to prevent poll recreation.
   */
  function simulateStablePolling(options: {
    pollEndpoint: () => Promise<any>;
    onSuccess: () => void;
    onTimeout: () => void;
    onError: (msg: string) => void;
    intervalMs: number;
    timeoutMs: number;
  }) {
    // Stable refs (like useRef)
    let onSuccessRef: (data?: any) => void = options.onSuccess;
    let onTimeoutRef: () => void = options.onTimeout;
    let onErrorRef: (msg: string) => void = options.onError;
    let timerRef: NodeJS.Timeout | null = null;
    let isPolling = false;
    let hasCompleted = false;
    const startTime = Date.now();
    let pollCount = 0;

    const poll = async () => {
      if (isPolling || hasCompleted) return;

      if (Date.now() - startTime >= options.timeoutMs) {
        onTimeoutRef();
        return;
      }

      isPolling = true;
      try {
        const response = await options.pollEndpoint();
        if (response?.data?.status === 'completed') {
          hasCompleted = true;
          onSuccessRef(response.data);
          return;
        }
        if (response?.data?.status === 'failed') {
          hasCompleted = true;
          onErrorRef(response.message || 'Failed');
          return;
        }
        pollCount++;
        timerRef = setTimeout(poll, options.intervalMs);
      } catch {
        pollCount++;
        timerRef = setTimeout(poll, options.intervalMs);
      } finally {
        isPolling = false;
      }
    };

    poll();

    return {
      cleanup: () => {
        hasCompleted = true;
        if (timerRef) clearTimeout(timerRef);
      },
      updateCallbacks: (cbs: { onSuccess?: () => void; onTimeout?: () => void; onError?: (m: string) => void }) => {
        if (cbs.onSuccess) onSuccessRef = cbs.onSuccess;
        if (cbs.onTimeout) onTimeoutRef = cbs.onTimeout;
        if (cbs.onError) onErrorRef = cbs.onError;
      },
      getPollCount: () => pollCount,
    };
  }

  it('should not restart polling when callbacks change', async () => {
    const pollEndpoint = jest.fn<() => Promise<any>>().mockResolvedValue({
      data: { status: 'pending' },
    } as never);
    const onSuccess = jest.fn();
    const onTimeout = jest.fn();
    const onError = jest.fn();

    const poller = simulateStablePolling({
      pollEndpoint,
      onSuccess,
      onTimeout,
      onError,
      intervalMs: 50,
      timeoutMs: 10000,
    });

    // Wait for 2 polls
    await new Promise(r => setTimeout(r, 130));
    const pollsBeforeUpdate = poller.getPollCount();

    // Simulate callback reference changes (what happens on parent re-render)
    poller.updateCallbacks({
      onSuccess: jest.fn(),
      onTimeout: jest.fn(),
      onError: jest.fn(),
    });

    // Wait and check - poll count should continue linearly, not restart
    await new Promise(r => setTimeout(r, 130));
    const pollsAfterUpdate = poller.getPollCount();

    // Should have continued from where it was, not doubled
    expect(pollsAfterUpdate - pollsBeforeUpdate).toBeLessThanOrEqual(3);

    poller.cleanup();
  });

  it('should call the latest callback reference on success', async () => {
    let callCount = 0;
    const pollEndpoint = jest.fn<() => Promise<any>>().mockImplementation(async () => {
      callCount++;
      return {
        data: { status: callCount >= 3 ? 'completed' : 'pending' },
      };
    });

    const originalOnSuccess = jest.fn();
    const updatedOnSuccess = jest.fn();

    const poller = simulateStablePolling({
      pollEndpoint,
      onSuccess: originalOnSuccess,
      onTimeout: jest.fn(),
      onError: jest.fn(),
      intervalMs: 50,
      timeoutMs: 10000,
    });

    // After first poll, update callback
    await new Promise(r => setTimeout(r, 60));
    poller.updateCallbacks({ onSuccess: updatedOnSuccess });

    // Wait for success
    await new Promise(r => setTimeout(r, 300));

    // The UPDATED callback should be called, not the original
    expect(updatedOnSuccess).toHaveBeenCalledTimes(1);
    expect(originalOnSuccess).not.toHaveBeenCalled();

    poller.cleanup();
  });

  it('should timeout correctly', async () => {
    const pollEndpoint = jest.fn<() => Promise<any>>().mockResolvedValue({
      data: { status: 'pending' },
    } as never);
    const onTimeout = jest.fn();

    const poller = simulateStablePolling({
      pollEndpoint,
      onSuccess: jest.fn(),
      onTimeout,
      onError: jest.fn(),
      intervalMs: 30,
      timeoutMs: 150,
    });

    await new Promise(r => setTimeout(r, 250));

    expect(onTimeout).toHaveBeenCalledTimes(1);

    poller.cleanup();
  });
});
