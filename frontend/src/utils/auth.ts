// frontend/src/utils/auth.ts

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
  private readonly TOKEN_PREFIX = 'repaircoin_';
  private readonly TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes buffer

  // Store tokens in memory for the session
  private tokens: Map<string, TokenInfo> = new Map();

  // Get stored token
  getToken(role: 'admin' | 'shop' | 'customer'): string | null {
    const key = `${this.TOKEN_PREFIX}${role}_token`;
    const legacyKey = `${role}AuthToken`;
    
    // Check memory first
    const memoryToken = this.tokens.get(role);
    if (memoryToken && this.isTokenValid(memoryToken)) {
      return memoryToken.token;
    }

    // Check localStorage with new key
    const storedData = localStorage.getItem(key);
    if (storedData) {
      try {
        const tokenInfo: TokenInfo = JSON.parse(storedData);
        if (this.isTokenValid(tokenInfo)) {
          // Store in memory for faster access
          this.tokens.set(role, tokenInfo);
          return tokenInfo.token;
        } else {
          // Token expired, clean up
          this.clearToken(role);
        }
      } catch (error) {
        console.error('Error parsing stored token:', error);
        this.clearToken(role);
      }
    }

    // Check for legacy tokens (backward compatibility)
    const legacyToken = localStorage.getItem(legacyKey) || sessionStorage.getItem(legacyKey);
    if (legacyToken) {
      // Legacy tokens are stored as plain strings
      try {
        // Verify it's a valid JWT token (has 3 parts)
        if (legacyToken.split('.').length === 3) {
          return legacyToken;
        }
      } catch (error) {
        console.error('Invalid legacy token format:', error);
      }
    }

    return null;
  }

  // Store token with expiry
  setToken(role: 'admin' | 'shop' | 'customer', token: string, expiryHours: number = 24): void {
    const key = `${this.TOKEN_PREFIX}${role}_token`;
    const expiresAt = Date.now() + (expiryHours * 60 * 60 * 1000);
    
    const tokenInfo: TokenInfo = {
      token,
      expiresAt,
      role
    };

    // Store in memory
    this.tokens.set(role, tokenInfo);
    
    // Store in localStorage
    localStorage.setItem(key, JSON.stringify(tokenInfo));
    
    // Also store in sessionStorage for current session
    sessionStorage.setItem(key, JSON.stringify(tokenInfo));
  }

  // Clear specific token
  clearToken(role: 'admin' | 'shop' | 'customer'): void {
    const key = `${this.TOKEN_PREFIX}${role}_token`;
    const legacyKey = `${role}AuthToken`;
    
    // Clear from memory
    this.tokens.delete(role);
    
    // Clear from storage (both new and legacy keys)
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
    localStorage.removeItem(legacyKey);
    sessionStorage.removeItem(legacyKey);
  }

  // Clear all tokens
  clearAllTokens(): void {
    const roles: Array<'admin' | 'shop' | 'customer'> = ['admin', 'shop', 'customer'];
    roles.forEach(role => this.clearToken(role));
  }

  // Check if token is still valid
  private isTokenValid(tokenInfo: TokenInfo): boolean {
    return Date.now() < (tokenInfo.expiresAt - this.TOKEN_EXPIRY_BUFFER);
  }

  // Get auth headers for API requests
  getAuthHeaders(role: 'admin' | 'shop' | 'customer'): Record<string, string> {
    const token = this.getToken(role);
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
    }
    return {
      'Content-Type': 'application/json'
    };
  }

  // Check if user is authenticated for a specific role
  isAuthenticated(role: 'admin' | 'shop' | 'customer'): boolean {
    return !!this.getToken(role);
  }

  // Get current user info from token (if JWT)
  getUserInfo(role: 'admin' | 'shop' | 'customer'): any | null {
    const token = this.getToken(role);
    if (!token) return null;

    try {
      // Decode JWT payload (base64)
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }
}

// Export singleton instance
export const authManager = new AuthManager();

// Helper functions for backward compatibility
export const getAdminToken = () => authManager.getToken('admin');
export const getShopToken = () => authManager.getToken('shop');
export const getCustomerToken = () => authManager.getToken('customer');

export const setAdminToken = (token: string) => authManager.setToken('admin', token);
export const setShopToken = (token: string) => authManager.setToken('shop', token);
export const setCustomerToken = (token: string) => authManager.setToken('customer', token);

export const clearAuthTokens = () => authManager.clearAllTokens();