import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { recordAuthFailure } from "@/utils/authRecovery";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Send cookies with requests (critical for httpOnly cookies)
});

// Request interceptor - Add request metadata
apiClient.interceptors.request.use((config) => {
  // Cookies are automatically sent via withCredentials: true
  // No need to manually add Authorization header - the backend reads from cookies

  // Add request ID for tracking
  if (typeof window !== 'undefined') {
    config.headers['X-Request-ID'] = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  return config;
});

// Track if we're currently refreshing to avoid multiple simultaneous refresh requests
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

// Track refresh retry attempts
let refreshRetryCount = 0;
const MAX_REFRESH_RETRIES = 2;
const REFRESH_RETRY_DELAY = 1000; // 1 second

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

/**
 * Enhanced Response Interceptor with Smart Token Refresh
 *
 * This interceptor implements a robust token refresh mechanism:
 * 1. Detects 401 (Unauthorized) and TOKEN_EXPIRED errors
 * 2. Automatically attempts to refresh the access token using the refresh token
 * 3. Queues failed requests while refreshing (prevents duplicate refresh calls)
 * 4. Retries all queued requests after successful refresh
 * 5. Triggers logout on session revocation or refresh failure
 * 6. Detects sliding window token refresh (proactive refresh before expiry)
 *
 * The refresh token is stored in an httpOnly cookie and sent automatically.
 */
apiClient.interceptors.response.use(
  (response) => {
    // Check if the backend performed a sliding window token refresh
    // This happens when the access token is close to expiring and the user is active
    const tokenRefreshed = response.headers['x-token-refreshed'];
    if (tokenRefreshed === 'true') {
      // The new token is automatically set via httpOnly cookie by the backend
      // Dispatch an event so components can react if needed (e.g., update UI indicators)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:token-refreshed', {
          detail: { type: 'sliding-window' }
        }));
      }
    }

    // Return just the data, not the full axios response
    return response.data;
  },
  async (error: AxiosError<{ code?: string; message?: string; error?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Extract error details
    const errorCode = error.response?.data?.code;
    const errorMessage = error.response?.data?.error || error.response?.data?.message;
    const status = error.response?.status;

    // Check if this is a token expiration error
    const isTokenExpired =
      status === 401 &&
      (errorCode === 'TOKEN_EXPIRED' || errorMessage?.includes('expired'));

    // If error is 401/token expired and we haven't tried to refresh yet
    if ((status === 401 || isTokenExpired) && !originalRequest._retry) {
      // Don't retry certain endpoints - they're expected to fail when not authenticated
      if (originalRequest.url?.includes('/auth/refresh') ||
          originalRequest.url?.includes('/auth/check-user') ||
          originalRequest.url?.includes('/auth/session')) {
        // These endpoints failing is normal when not authenticated or when checking for existing sessions
        // Don't trigger logout/refresh for these
        // /auth/session is in this list because it's used to CHECK if a session exists
        // If it returns 401, that just means no session - don't try to refresh or logout
        return Promise.reject(error);
      }

      console.log('[API Client] 401 or token expired detected, initiating refresh...');

      if (isRefreshing) {
        // If already refreshing, queue this request
        console.log('[API Client] Refresh in progress, queuing request');
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            console.log('[API Client] Retrying queued request after refresh');
            return apiClient(originalRequest);
          })
          .catch((err) => {
            console.error('[API Client] Queued request failed:', err);
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      refreshRetryCount = 0;

      const attemptRefresh = async (): Promise<any> => {
        try {
          console.log(`[API Client] Attempting to refresh token (attempt ${refreshRetryCount + 1}/${MAX_REFRESH_RETRIES + 1})...`);

          // Try to refresh the token
          // The refresh token is in httpOnly cookie and sent automatically
          await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/auth/refresh`,
            {},
            { withCredentials: true }
          );

          console.log('[API Client] Token refresh successful');
          refreshRetryCount = 0; // Reset on success

          // Refresh successful, process queued requests
          processQueue(null);
          isRefreshing = false;

          // Retry the original request with the new access token (now in cookie)
          return apiClient(originalRequest);
        } catch (refreshError) {
          const axiosError = refreshError as AxiosError<{ code?: string; message?: string }>;
          const errorCode = axiosError?.response?.data?.code;
          const httpStatus = axiosError?.response?.status;

          console.error(`[API Client] Token refresh attempt ${refreshRetryCount + 1} failed:`, {
            status: httpStatus,
            code: errorCode,
            message: axiosError?.response?.data?.message
          });

          // Check for explicit revocation codes - these should NOT be retried
          const isExplicitRevocation =
            errorCode === 'SESSION_REVOKED' ||
            errorCode === 'REFRESH_TOKEN_EXPIRED' ||
            errorCode === 'REFRESH_TOKEN_REVOKED' ||
            errorCode === 'REFRESH_TOKEN_INVALID';

          if (isExplicitRevocation) {
            console.log('[API Client] Explicit session revocation detected - not retrying');
            processQueue(axiosError, null);
            isRefreshing = false;
            refreshRetryCount = 0;

            // Record failure for auto-recovery mechanism
            recordAuthFailure('Session revoked: ' + errorCode);

            // Trigger logout for explicit revocations
            if (typeof window !== 'undefined') {
              console.log('[API Client] Triggering logout due to explicit revocation:', errorCode);
              window.dispatchEvent(new CustomEvent('auth:session-revoked', {
                detail: {
                  reason: errorCode,
                  message: axiosError?.response?.data?.message
                }
              }));
            }

            return Promise.reject(refreshError);
          }

          // For other errors (network issues, generic 401s), retry with backoff
          if (refreshRetryCount < MAX_REFRESH_RETRIES) {
            refreshRetryCount++;
            const retryDelay = REFRESH_RETRY_DELAY * refreshRetryCount;
            console.log(`[API Client] Retrying token refresh in ${retryDelay}ms...`);
            await delay(retryDelay);
            return attemptRefresh();
          }

          // Max retries exhausted
          console.warn('[API Client] Token refresh failed after max retries');
          processQueue(axiosError, null);
          isRefreshing = false;
          refreshRetryCount = 0;

          // Record failure for auto-recovery mechanism
          recordAuthFailure('Token refresh failed after max retries');

          // Check if on protected route - if so, clear caches and redirect to home
          // This prevents users from being stuck on a protected route with invalid session
          const isProtectedRoute = typeof window !== 'undefined' &&
            (window.location.pathname.startsWith('/shop') ||
             window.location.pathname.startsWith('/customer') ||
             window.location.pathname.startsWith('/admin'));

          if (isProtectedRoute) {
            console.warn('[API Client] On protected route with failed auth - clearing caches and redirecting to home');
            // Clear all session caches to prevent stale data on next visit
            try {
              sessionStorage.clear();
            } catch (e) {}
            // Redirect to home page
            window.location.href = '/';
            return Promise.reject(new Error('Session expired. Redirecting to login.'));
          }

          // Not on protected route - return recoverable error
          const enhancedError = new Error('Session refresh failed. Please try again or refresh the page.') as Error & {
            response?: unknown;
            status?: number;
            isTemporaryFailure?: boolean;
          };
          enhancedError.response = axiosError.response;
          enhancedError.status = httpStatus;
          enhancedError.isTemporaryFailure = true; // Flag to indicate this is recoverable

          return Promise.reject(enhancedError);
        }
      };

      return attemptRefresh();
    }

    // Check if session was revoked (can happen on any request)
    if (errorCode === 'SESSION_REVOKED') {
      console.log('[API Client] Session revoked - triggering logout');

      // Record failure for auto-recovery mechanism
      recordAuthFailure('Session revoked during request');

      // Trigger wallet disconnect event to prevent auto-login
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:session-revoked', {
          detail: {
            reason: 'session_revoked',
            message: errorMessage
          }
        }));
      }

      // Return a user-friendly error
      return Promise.reject(new Error('Your session has been revoked. Please login again.'));
    }

    // Extract user-friendly error message from backend response
    const friendlyMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';

    // Create an enhanced error with the extracted message
    const enhancedError = new Error(friendlyMessage) as Error & {
      response?: unknown;
      status?: number;
      code?: string;
    };
    enhancedError.response = error.response;
    enhancedError.status = error.response?.status;
    enhancedError.code = errorCode;

    return Promise.reject(enhancedError);
  }
);

export default apiClient;
