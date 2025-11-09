import apiClient from './client';
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

/**
 * Check user type and registration status
 */
export const checkUser = async (address: string): Promise<{
  exists: boolean;
  type?: 'admin' | 'shop' | 'customer';
  user?: any;
}> => {
  try {
    const response = await apiClient.post<any>('/auth/check-user', { address });
    // apiClient already returns response.data
    return response;
  } catch (error: any) {
    // Handle 404 or other errors
    if (error?.response?.status === 404) {
      console.log('User not found');
    } else {
      console.error('Error checking user:', error);
    }
    return { exists: false };
  }
};

/**
 * Get or create user profile
 */
export const getProfile = async (data: ProfileData): Promise<User | null> => {
  try {
    const response = await apiClient.post<User>('/auth/profile', data);
    // apiClient already returns response.data
    return response || null;
  } catch (error) {
    console.error('Error getting profile:', error);
    return null;
  }
};

/**
 * Get current session info
 */
export const getSession = async (): Promise<{
  isValid: boolean;
  user?: User;
  expiresAt?: string;
}> => {
  try {
    const response = await apiClient.get<any>('/auth/session');
    // apiClient already returns response.data
    return response || { isValid: false };
  } catch (error) {
    console.error('Error getting session:', error);
    return { isValid: false };
  }
};

/**
 * Admin authentication - Cookie is set by backend automatically
 */
export const authenticateAdmin = async (address: string): Promise<AuthToken | null> => {
  try {
    const response = await apiClient.post<AuthToken>('/auth/admin', { address });
    // apiClient already returns response.data, so response is the unwrapped data
    // Backend sets httpOnly cookie automatically
    return response || null;
  } catch (error) {
    console.error('Error authenticating admin:', error);
    return null;
  }
};

/**
 * Customer authentication - Cookie is set by backend automatically
 */
export const authenticateCustomer = async (address: string): Promise<AuthToken | null> => {
  try {
    const response = await apiClient.post<AuthToken>('/auth/customer', { address });
    // apiClient already returns response.data, so response is the unwrapped data
    // Backend sets httpOnly cookie automatically
    return response || null;
  } catch (error) {
    console.error('Error authenticating customer:', error);
    return null;
  }
};

/**
 * Shop authentication - Cookie is set by backend automatically
 */
export const authenticateShop = async (address: string): Promise<AuthToken | null> => {
  try {
    const response = await apiClient.post<AuthToken>('/auth/shop', { address });
    // apiClient already returns response.data, so response is the unwrapped data
    // Backend sets httpOnly cookie automatically
    return response || null;
  } catch (error) {
    console.error('Error authenticating shop:', error);
    return null;
  }
};

/**
 * Check if user is authenticated
 * Note: This now relies on cookie presence which is checked server-side
 * For client-side, we'll verify by making an API call
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const response = await apiClient.get('/auth/session');
    // apiClient already returns response.data
    return response?.authenticated || false;
  } catch (error) {
    return false;
  }
};

/**
 * Logout user - Calls backend to clear httpOnly cookie
 */
export const logout = async (): Promise<void> => {
  try {
    await apiClient.post('/auth/logout');
    // Redirect to home page
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  } catch (error) {
    console.error('Logout error:', error);
    // Still redirect even if backend call fails
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }
};

/**
 * Refresh authentication token
 */
export const refreshToken = async (): Promise<boolean> => {
  try {
    const response = await apiClient.post('/auth/refresh');
    // apiClient already returns response.data
    return response?.success || false;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
};

// Named exports grouped as namespace for convenience
export const authApi = {
  checkUser,
  getProfile,
  getSession,
  authenticateAdmin,
  authenticateCustomer,
  authenticateShop,
  isAuthenticated,
  logout,
  refreshToken,
} as const;