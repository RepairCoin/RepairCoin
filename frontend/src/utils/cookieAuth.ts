/**
 * Cookie-based Authentication Utilities
 *
 * With httpOnly cookies, JavaScript cannot access tokens directly.
 * Instead, we rely on:
 * 1. Backend sets httpOnly cookie on login
 * 2. Browser automatically sends cookie with every request
 * 3. Components use API calls without manual token management
 */

import apiClient from '@/services/api/client';

/**
 * IMPORTANT: Do NOT use this to get tokens!
 * Tokens are in httpOnly cookies and cannot be accessed by JavaScript.
 * This is INTENTIONAL for security.
 *
 * @deprecated Use apiClient directly - cookies are sent automatically
 */
export const getAuthToken = (): null => {
  console.warn(
    '[DEPRECATED] getAuthToken() - Tokens are in httpOnly cookies and cannot be accessed. ' +
    'Use apiClient for requests - cookies are sent automatically.'
  );
  return null;
};

/**
 * Check if user is authenticated by making an API call
 * Since we can't read httpOnly cookies, we verify with the backend
 */
export const checkAuthentication = async (): Promise<boolean> => {
  try {
    const response = await apiClient.get('/auth/session');
    return response.data?.authenticated || false;
  } catch (error) {
    return false;
  }
};

/**
 * Helper to make authenticated API calls
 * Cookies are automatically included by axios (withCredentials: true)
 */
export const makeAuthenticatedRequest = async <T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data?: any
): Promise<T> => {
  // No need to manually add tokens - cookies are sent automatically
  const config = {
    method,
    url,
    ...(data && { data })
  };

  const response = await apiClient.request<T>(config);
  return response.data;
};

/**
 * Clean up legacy tokens from localStorage/sessionStorage
 * Call this on app initialization to remove old tokens
 */
export const cleanupLegacyTokens = (): void => {
  if (typeof window === 'undefined') return;

  const legacyKeys = [
    'token',
    'adminAuthToken',
    'shopAuthToken',
    'customerAuthToken',
    'repaircoin_admin_token',
    'repaircoin_shop_token',
    'repaircoin_customer_token'
  ];

  legacyKeys.forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });

  console.log('✅ Cleaned up legacy authentication tokens');
};

/**
 * Migration helper for components that were checking localStorage
 * Returns null and logs a warning
 */
export const getLegacyToken = (type: 'admin' | 'shop' | 'customer'): null => {
  console.warn(
    `[MIGRATION] Attempted to get ${type} token from localStorage. ` +
    `Tokens are now in httpOnly cookies. Update this component to use apiClient directly.`
  );
  return null;
};
