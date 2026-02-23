/**
 * Auth Recovery Mechanism
 *
 * Automatically detects and recovers from corrupted auth state
 * when multiple failures occur within a short time window.
 *
 * Trigger: 3+ auth failures within 30 seconds
 * Action: Clear all caches, localStorage keys, cookies, and redirect to home
 */

const AUTH_FAIL_THRESHOLD = 3;
const AUTH_FAIL_WINDOW_MS = 30000; // 30 seconds

interface AuthFailure {
  timestamp: number;
  error: string;
}

let authFailures: AuthFailure[] = [];

/**
 * Record an auth failure and check if recovery is needed.
 * Call this whenever an auth-related operation fails.
 */
export function recordAuthFailure(error: string): void {
  const now = Date.now();

  // Remove failures outside the sliding window
  authFailures = authFailures.filter(
    f => now - f.timestamp < AUTH_FAIL_WINDOW_MS
  );

  authFailures.push({ timestamp: now, error });
  console.log(`[AuthRecovery] Failure recorded (${authFailures.length}/${AUTH_FAIL_THRESHOLD}):`, error);

  // Check if threshold exceeded
  if (authFailures.length >= AUTH_FAIL_THRESHOLD) {
    triggerAuthRecovery();
  }
}

/**
 * Trigger full auth recovery - clears all state and redirects to home.
 * This is the nuclear option for when auth is completely broken.
 */
export function triggerAuthRecovery(): void {
  console.warn('[AuthRecovery] 🚨 Multiple failures detected - triggering recovery');

  // 1. Clear thirdweb/walletconnect keys from localStorage
  const keysToRemove: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('thirdweb') || key.includes('walletconnect') || key.includes('wagmi'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('[AuthRecovery] Cleared localStorage keys:', keysToRemove.length);
  } catch (e) {
    console.error('[AuthRecovery] Error clearing localStorage:', e);
  }

  // 2. Clear sessionStorage (our caches)
  try {
    sessionStorage.clear();
    console.log('[AuthRecovery] Cleared sessionStorage');
  } catch (e) {
    console.error('[AuthRecovery] Error clearing sessionStorage:', e);
  }

  // 3. Clear auth cookies (client-accessible ones only)
  try {
    document.cookie.split(";").forEach(c => {
      const name = c.trim().split("=")[0];
      if (name && (name.includes('auth') || name.includes('token') || name.includes('session'))) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      }
    });
    console.log('[AuthRecovery] Cleared auth cookies');
  } catch (e) {
    console.error('[AuthRecovery] Error clearing cookies:', e);
  }

  // 4. Reset failure count
  authFailures = [];

  // 5. Redirect to home with fresh state
  console.log('[AuthRecovery] Redirecting to home...');
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
}

/**
 * Reset failure count on successful auth.
 * Call this after any successful auth operation.
 */
export function resetAuthFailures(): void {
  if (authFailures.length > 0) {
    console.log('[AuthRecovery] ✅ Auth success - resetting failure count');
    authFailures = [];
  }
}

/**
 * Get current failure count (for debugging/monitoring)
 */
export function getFailureCount(): number {
  return authFailures.length;
}

/**
 * Check if recovery was recently triggered (within last 5 seconds)
 * Useful to prevent redirect loops
 */
export function wasRecoveryTriggered(): boolean {
  try {
    const recoveryTime = sessionStorage.getItem('rc_recovery_triggered');
    if (recoveryTime) {
      const elapsed = Date.now() - parseInt(recoveryTime, 10);
      return elapsed < 5000; // Within last 5 seconds
    }
  } catch (e) {}
  return false;
}
