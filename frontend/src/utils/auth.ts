// frontend/src/utils/auth.ts
/**
 * DEPRECATED: This file is kept for backward compatibility only.
 * Authentication now uses httpOnly cookies managed by the backend.
 * Token management is no longer needed on the client side.
 */

interface AuthTokens {
  adminToken?: string;
  shopToken?: string;
  customerToken?: string;
}

interface TokenInfo {
  token: string;
  expiresAt: number;
  role: 'admin' | 'shop' | 'customer';
}

class AuthManager {
  /**
   * DEPRECATED: Tokens are now stored in httpOnly cookies by the backend
   */
  getToken(role: 'admin' | 'shop' | 'customer'): string | null {
    console.warn('[DEPRECATED] getToken() - Tokens are now managed via httpOnly cookies');
    return null;
  }

  /**
   * DEPRECATED: Tokens are now automatically set in httpOnly cookies by backend
   */
  setToken(role: 'admin' | 'shop' | 'customer', token: string, expiryHours: number = 24): void {
    console.warn('[DEPRECATED] setToken() - Tokens are now managed via httpOnly cookies');
    // No-op: Cookies are set by backend
  }

  /**
   * DEPRECATED: Use authApi.logout() instead
   */
  clearToken(role: 'admin' | 'shop' | 'customer'): void {
    console.warn('[DEPRECATED] clearToken() - Use authApi.logout() instead');
    // Clean up any legacy localStorage tokens if they exist
    if (typeof window !== 'undefined') {
      const legacyKeys = [
        `repaircoin_${role}_token`,
        `${role}AuthToken`,
        'token'
      ];
      legacyKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
    }
  }

  /**
   * DEPRECATED: Use authApi.logout() instead
   */
  clearAllTokens(): void {
    console.warn('[DEPRECATED] clearAllTokens() - Use authApi.logout() instead');
    // Clean up all legacy tokens
    if (typeof window !== 'undefined') {
      const roles: Array<'admin' | 'shop' | 'customer'> = ['admin', 'shop', 'customer'];
      roles.forEach(role => this.clearToken(role));
    }
  }

  /**
   * DEPRECATED: Tokens are managed via httpOnly cookies, no headers needed
   */
  getAuthHeaders(role: 'admin' | 'shop' | 'customer'): Record<string, string> {
    console.warn('[DEPRECATED] getAuthHeaders() - Cookies are automatically sent with requests');
    return {
      'Content-Type': 'application/json'
    };
  }

  /**
   * DEPRECATED: Use authApi.isAuthenticated() instead
   */
  isAuthenticated(role: 'admin' | 'shop' | 'customer'): boolean {
    console.warn('[DEPRECATED] isAuthenticated() - Use authApi.isAuthenticated() instead');
    return false;
  }

  /**
   * DEPRECATED: User info should be fetched from authStore or API
   */
  getUserInfo(role: 'admin' | 'shop' | 'customer'): any | null {
    console.warn('[DEPRECATED] getUserInfo() - Use authStore.userProfile instead');
    return null;
  }
}

// Export singleton instance (for backward compatibility)
export const authManager = new AuthManager();

// Helper functions (deprecated but kept for backward compatibility)
export const getAdminToken = () => {
  console.warn('[DEPRECATED] getAdminToken() - Tokens managed via httpOnly cookies');
  return null;
};

export const getShopToken = () => {
  console.warn('[DEPRECATED] getShopToken() - Tokens managed via httpOnly cookies');
  return null;
};

export const getCustomerToken = () => {
  console.warn('[DEPRECATED] getCustomerToken() - Tokens managed via httpOnly cookies');
  return null;
};

export const setAdminToken = (token: string) => {
  console.warn('[DEPRECATED] setAdminToken() - Tokens managed via httpOnly cookies');
  // No-op
};

export const setShopToken = (token: string) => {
  console.warn('[DEPRECATED] setShopToken() - Tokens managed via httpOnly cookies');
  // No-op
};

export const setCustomerToken = (token: string) => {
  console.warn('[DEPRECATED] setCustomerToken() - Tokens managed via httpOnly cookies');
  // No-op
};

export const clearAuthTokens = () => {
  console.warn('[DEPRECATED] clearAuthTokens() - Use authApi.logout() instead');
  // Clean up legacy tokens
  authManager.clearAllTokens();
};