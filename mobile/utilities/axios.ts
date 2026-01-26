import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { jwtDecode } from 'jwt-decode';
import { authApi } from '@/shared/services/auth.services';
import { useAuthStore } from '@/shared/store/auth.store';

interface DecodedToken {
  exp: number;
  iat: number;
  address: string;
  role: string;
  shopId?: string;
}

class ApiClient {
  private instance: AxiosInstance;
  private baseURL: string;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

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

  // Check if token is expired or about to expire (within 5 minutes)
  private isTokenExpired(token: string): boolean {
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const currentTime = Date.now() / 1000;
      const expiresIn = decoded.exp - currentTime;
      
      // Consider token expired if it expires in less than 5 minutes
      if (expiresIn < 300) {
        console.log('[ApiClient] Token expired or expiring soon:', {
          expiresIn,
          expired: expiresIn <= 0
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[ApiClient] Failed to decode token:', error);
      return true; // Treat invalid tokens as expired
    }
  }

  // Subscribe to token refresh
  private subscribeTokenRefresh(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  // Notify all subscribers with new token
  private onTokenRefreshed(token: string) {
    this.refreshSubscribers.forEach(callback => callback(token));
    this.refreshSubscribers = [];
  }

  // Refresh the access token
  private async refreshToken(): Promise<string | null> {
    try {
      console.log('[ApiClient] Attempting to refresh token...');

      // Get stored refresh token from Zustand store
      const { refreshToken, setAccessToken, setRefreshToken } = useAuthStore.getState();
      if (!refreshToken) {
        console.log('[ApiClient] No refresh token found');
        return null;
      }

      // Call refresh endpoint
      const response = await authApi.getRefreshToken(refreshToken);

      if (response.data.success) {
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        // Store new tokens in Zustand store
        setAccessToken(accessToken);
        if (newRefreshToken) {
          setRefreshToken(newRefreshToken);
        }

        console.log('[ApiClient] Token refreshed successfully');
        return accessToken;
      }

      console.log('[ApiClient] Token refresh failed:', response.data);
      return null;
    } catch (error: any) {
      console.error('[ApiClient] Token refresh error:', error.message);

      // If refresh fails with 401, clear tokens and redirect to login
      if (error.response?.status === 401) {
        await this.clearAuthToken();
      }

      return null;
    }
  }

  private setupInterceptors() {
    // Request interceptor - Add auth token and check expiry
    this.instance.interceptors.request.use(
      async (config) => {
        try {
          // Get token from Zustand store
          let token = useAuthStore.getState().accessToken;

          if (token) {
            // Check if token is expired
            if (this.isTokenExpired(token)) {
              console.log('[ApiClient] Token expired, attempting refresh...');

              // If not already refreshing, start refresh
              if (!this.isRefreshing) {
                this.isRefreshing = true;

                const newToken = await this.refreshToken();

                if (newToken) {
                  token = newToken;
                  this.onTokenRefreshed(newToken);
                } else {
                  // Refresh failed, clear token
                  await this.clearAuthToken();
                  this.onTokenRefreshed('');
                }

                this.isRefreshing = false;
              } else {
                // Wait for refresh to complete
                console.log('[ApiClient] Waiting for token refresh...');
                token = await new Promise<string>((resolve) => {
                  this.subscribeTokenRefresh((newToken: string) => {
                    resolve(newToken);
                  });
                });
              }
            }

            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
              console.log('[Axios Interceptor] Added token to request:', config.url);
            }
          } else {
            console.log('[Axios Interceptor] No token found for request:', config.url);
          }
        } catch (error) {
          console.warn('[Axios Interceptor] Failed to process auth token:', error);
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
        const originalRequest = error.config;
        
        if (__DEV__) {
          console.error('[API Response Error]:', {
            status: error.response?.status,
            url: error.config?.url,
            data: error.response?.data,
            message: error.message,
          });
        }

        // Handle 401 Unauthorized - Try to refresh token once
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          console.log('[ApiClient] Got 401, attempting to refresh token...');
          
          if (!this.isRefreshing) {
            this.isRefreshing = true;
            
            const newToken = await this.refreshToken();
            
            if (newToken) {
              this.onTokenRefreshed(newToken);
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              this.isRefreshing = false;
              return this.instance(originalRequest);
            } else {
              // Refresh failed, clear tokens
              await this.clearAuthToken();
              this.onTokenRefreshed('');
              this.isRefreshing = false;
            }
          } else {
            // Wait for ongoing refresh
            return new Promise((resolve, reject) => {
              this.subscribeTokenRefresh((token: string) => {
                if (token) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                  resolve(this.instance(originalRequest));
                } else {
                  reject(error);
                }
              });
            });
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

  // Set auth tokens
  public setAuthToken(accessToken: string): void {
    try {
      this.instance.defaults.headers.Authorization = `Bearer ${accessToken}`;
      console.log('[ApiClient] Auth token set');
    } catch (error) {
      console.error('Failed to set auth token:', error);
    }
  }

  // Clear auth tokens
  public async clearAuthToken(): Promise<void> {
    try {
      delete this.instance.defaults.headers.Authorization;
      console.log('[ApiClient] Auth tokens cleared');
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