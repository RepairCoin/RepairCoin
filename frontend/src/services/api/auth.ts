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

// Helper function to store token
const storeToken = (token: string, type: 'admin' | 'shop' | 'customer' = 'customer') => {
  const tokenKey = `${type}AuthToken`;
  localStorage.setItem(tokenKey, token);
  localStorage.setItem('token', token); // Also store as generic token for apiClient
};

// Helper function to clear token
const clearToken = (type?: 'admin' | 'shop' | 'customer') => {
  if (type) {
    const tokenKey = `${type}AuthToken`;
    localStorage.removeItem(tokenKey);
  } else {
    localStorage.removeItem('adminAuthToken');
    localStorage.removeItem('shopAuthToken');
    localStorage.removeItem('customerAuthToken');
  }
  localStorage.removeItem('token');
};

/**
 * Generate a generic auth token
 */
export const generateToken = async (address: string, signature?: string): Promise<AuthToken | null> => {
  try {
    const response = await apiClient.post<AuthToken>('/auth/token', { address, signature });
    if (response.data) {
      storeToken(response.data.token, 'customer');
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('Error generating token:', error);
    return null;
  }
};

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
    return response.data;
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
    return response.data || null;
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
    return response.data || { isValid: false };
  } catch (error) {
    console.error('Error getting session:', error);
    return { isValid: false };
  }
};

/**
 * Admin authentication
 */
export const authenticateAdmin = async (address: string): Promise<AuthToken | null> => {
  try {
    const response = await apiClient.post<AuthToken>('/auth/admin', { address });
    if (response.data) {
      storeToken(response.data.token, 'admin');
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('Error authenticating admin:', error);
    return null;
  }
};

/**
 * Customer authentication
 */
export const authenticateCustomer = async (address: string): Promise<AuthToken | null> => {
  try {
    const response = await apiClient.post<AuthToken>('/auth/customer', { address });
    if (response.data) {
      storeToken(response.data.token, 'customer');
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('Error authenticating customer:', error);
    return null;
  }
};

/**
 * Shop authentication
 */
export const authenticateShop = async (address: string): Promise<AuthToken | null> => {
  try {
    const response = await apiClient.post<AuthToken>('/auth/shop', { address });
    if (response.data) {
      storeToken(response.data.token, 'shop');
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('Error authenticating shop:', error);
    return null;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (type: 'admin' | 'shop' | 'customer' = 'customer'): boolean => {
  if (typeof window === 'undefined') return false;
  
  const tokenKey = `${type}AuthToken`;
  const token = localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
  return !!token;
};

/**
 * Logout user
 */
export const logout = (type?: 'admin' | 'shop' | 'customer'): void => {
  clearToken(type);
};

// Named exports grouped as namespace for convenience
export const authApi = {
  generateToken,
  checkUser,
  getProfile,
  getSession,
  authenticateAdmin,
  authenticateCustomer,
  authenticateShop,
  isAuthenticated,
  logout,
} as const;