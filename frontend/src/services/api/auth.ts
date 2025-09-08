import { ApiService } from './base';
import { AuthToken, User } from '@/constants/types';

export interface LoginCredentials {
  address: string;
  signature?: string;
  message?: string;
}

export interface ProfileData {
  address: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

class AuthApiService extends ApiService {
  /**
   * Generate a generic auth token
   */
  async generateToken(address: string, signature?: string): Promise<AuthToken | null> {
    const response = await this.post<AuthToken>('/auth/token', {
      address,
      signature,
    });

    if (response.success && response.data) {
      this.storeToken(response.data.token, 'customer');
      return response.data;
    }
    return null;
  }

  /**
   * Check user type and registration status
   */
  async checkUser(address: string): Promise<{
    exists: boolean;
    role?: 'admin' | 'shop' | 'customer';
    isActive?: boolean;
    data?: any;
  }> {
    const response = await this.post<any>('/auth/check-user', { address });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return { exists: false };
  }

  /**
   * Get or create user profile
   */
  async getProfile(data: ProfileData): Promise<User | null> {
    const response = await this.post<User>('/auth/profile', data);
    
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  /**
   * Get current session info
   */
  async getSession(): Promise<{
    isValid: boolean;
    user?: User;
    expiresAt?: string;
  }> {
    const response = await this.get<any>('/auth/session', {
      includeAuth: true,
    });

    if (response.success && response.data) {
      return response.data;
    }

    return { isValid: false };
  }

  /**
   * Admin authentication
   */
  async authenticateAdmin(address: string): Promise<AuthToken | null> {
    const response = await this.post<AuthToken>('/auth/admin', { address });

    if (response.success && response.data) {
      this.storeToken(response.data.token, 'admin');
      return response.data;
    }
    return null;
  }

  /**
   * Customer authentication
   */
  async authenticateCustomer(address: string): Promise<AuthToken | null> {
    const response = await this.post<AuthToken>('/auth/customer', { address });

    if (response.success && response.data) {
      this.storeToken(response.data.token, 'customer');
      return response.data;
    }
    return null;
  }

  /**
   * Shop authentication
   */
  async authenticateShop(address: string): Promise<AuthToken | null> {
    const response = await this.post<AuthToken>('/auth/shop', { address });

    if (response.success && response.data) {
      this.storeToken(response.data.token, 'shop');
      return response.data;
    }
    return null;
  }

  /**
   * Store authentication token
   */
  private storeToken(token: string, type: 'admin' | 'shop' | 'customer'): void {
    if (typeof window === 'undefined') return;
    
    const tokenKey = `${type}AuthToken`;
    localStorage.setItem(tokenKey, token);
    sessionStorage.setItem(tokenKey, token);
  }

  /**
   * Clear authentication tokens
   */
  clearTokens(type?: 'admin' | 'shop' | 'customer'): void {
    if (typeof window === 'undefined') return;

    if (type) {
      const tokenKey = `${type}AuthToken`;
      localStorage.removeItem(tokenKey);
      sessionStorage.removeItem(tokenKey);
    } else {
      // Clear all tokens
      ['admin', 'shop', 'customer'].forEach(t => {
        const tokenKey = `${t}AuthToken`;
        localStorage.removeItem(tokenKey);
        sessionStorage.removeItem(tokenKey);
      });
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(type: 'admin' | 'shop' | 'customer' = 'customer'): boolean {
    return !!this.getAuthToken(type);
  }

  /**
   * Logout user
   */
  logout(type?: 'admin' | 'shop' | 'customer'): void {
    this.clearTokens(type);
  }
}

export const authApi = new AuthApiService();