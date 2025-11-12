import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

class ApiClient {
  private instance: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';
    
    console.log('[ApiClient] EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
    console.log('[ApiClient] Using baseURL:', this.baseURL);
    
    this.instance = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - Add auth token
    this.instance.interceptors.request.use(
      async (config) => {
        try {
          const token = await AsyncStorage.getItem('auth_token');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('[Axios Interceptor] Added token to request:', config.url);
            console.log('[Axios Interceptor] Token preview:', token.substring(0, 30) + '...');
          } else {
            console.log('[Axios Interceptor] No token found for request:', config.url);
          }
        } catch (error) {
          console.warn('[Axios Interceptor] Failed to get auth token:', error);
        }
        
        return config;
      },
      (error) => {
        console.error('[API Request Error]:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor - Handle responses and errors
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error) => {
        if (__DEV__) {
          console.error('[API Response Error]:', {
            status: error.response?.status,
            url: error.config?.url,
            data: error.response?.data,
            message: error.message,
          });
        }

        // Handle 401 Unauthorized - Clear token and redirect to login
        if (error.response?.status === 401) {
          try {
            await AsyncStorage.removeItem('auth_token');
            // You can add navigation logic here if needed
            console.log('Token cleared due to 401 error');
          } catch (storageError) {
            console.warn('Failed to clear auth token:', storageError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // GET request
  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.get<T>(url, config);
    return response.data;
  }

  // POST request
  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.post<T>(url, data, config);
    return response.data;
  }

  // PUT request
  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.put<T>(url, data, config);
    return response.data;
  }

  // PATCH request
  public async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.patch<T>(url, data, config);
    return response.data;
  }

  // DELETE request
  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.delete<T>(url, config);
    return response.data;
  }

  // Set auth token
  public async setAuthToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem('auth_token', token);
      this.instance.defaults.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      console.error('Failed to set auth token:', error);
    }
  }

  // Clear auth token
  public async clearAuthToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem('auth_token');
      delete this.instance.defaults.headers.Authorization;
    } catch (error) {
      console.error('Failed to clear auth token:', error);
    }
  }

  // Get current base URL
  public getBaseURL(): string {
    return this.baseURL;
  }

  // Update base URL (useful for switching environments)
  public setBaseURL(newBaseURL: string): void {
    this.baseURL = newBaseURL;
    this.instance.defaults.baseURL = newBaseURL;
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
export default apiClient;