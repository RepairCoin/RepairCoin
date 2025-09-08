import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

export class ApiService {
  protected axiosInstance: AxiosInstance;
  protected baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
    
    // Create axios instance with default config
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Token will be added per request if needed
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => this.handleAxiosError(error)
    );
  }

  protected getAuthToken(type: 'admin' | 'shop' | 'customer' = 'customer'): string | null {
    if (typeof window === 'undefined') return null;
    
    const tokenKey = `${type}AuthToken`;
    return localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
  }

  protected getAuthHeaders(authType?: 'admin' | 'shop' | 'customer'): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (authType) {
      const token = this.getAuthToken(authType);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    
    return headers;
  }

  private handleAxiosError(error: AxiosError): Promise<never> {
    if (error.response) {
      // Server responded with error status
      const data = error.response.data as any;
      const errorMessage = data?.error || data?.message || `HTTP ${error.response.status}: ${error.response.statusText}`;
      
      console.error(`API Error:`, {
        url: error.config?.url,
        status: error.response.status,
        message: errorMessage,
      });
      
      // Return a rejected promise with formatted error
      return Promise.reject({
        success: false,
        error: errorMessage,
        status: error.response.status,
        data: data?.data,
      });
    } else if (error.request) {
      // Request was made but no response received
      console.error('Network Error:', error.message);
      return Promise.reject({
        success: false,
        error: 'Network error: Unable to reach server',
      });
    } else {
      // Something else happened
      console.error('Request Error:', error.message);
      return Promise.reject({
        success: false,
        error: error.message || 'An unexpected error occurred',
      });
    }
  }

  protected async request<T = any>(
    config: AxiosRequestConfig & {
      includeAuth?: boolean;
      authType?: 'admin' | 'shop' | 'customer';
    }
  ): Promise<ApiResponse<T>> {
    const { includeAuth = false, authType, ...axiosConfig } = config;
    
    try {
      // Add auth headers if needed
      if (includeAuth && authType) {
        axiosConfig.headers = {
          ...axiosConfig.headers,
          ...this.getAuthHeaders(authType),
        };
      }

      const response = await this.axiosInstance.request<T>(axiosConfig);
      
      // Handle different response formats from backend
      const data = response.data as any;
      
      if (typeof data === 'object' && data !== null) {
        if ('success' in data) {
          return data;
        }
        if ('data' in data) {
          return { success: true, data: data.data };
        }
      }
      
      return { success: true, data: response.data };
    } catch (error: any) {
      // Error is already formatted by the interceptor
      if (error?.success === false) {
        return error;
      }
      
      // Fallback for unexpected errors
      return {
        success: false,
        error: error?.message || 'An unexpected error occurred',
      };
    }
  }

  protected async get<T = any>(
    endpoint: string,
    options?: { 
      includeAuth?: boolean; 
      authType?: 'admin' | 'shop' | 'customer';
      params?: Record<string, any>;
    }
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'GET',
      url: endpoint,
      params: options?.params,
      includeAuth: options?.includeAuth,
      authType: options?.authType,
    });
  }

  protected async post<T = any>(
    endpoint: string,
    data?: any,
    options?: { 
      includeAuth?: boolean; 
      authType?: 'admin' | 'shop' | 'customer';
      params?: Record<string, any>;
    }
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'POST',
      url: endpoint,
      data,
      params: options?.params,
      includeAuth: options?.includeAuth,
      authType: options?.authType,
    });
  }

  protected async put<T = any>(
    endpoint: string,
    data?: any,
    options?: { 
      includeAuth?: boolean; 
      authType?: 'admin' | 'shop' | 'customer';
      params?: Record<string, any>;
    }
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      url: endpoint,
      data,
      params: options?.params,
      includeAuth: options?.includeAuth,
      authType: options?.authType,
    });
  }

  protected async delete<T = any>(
    endpoint: string,
    options?: { 
      includeAuth?: boolean; 
      authType?: 'admin' | 'shop' | 'customer';
      params?: Record<string, any>;
      data?: any;
    }
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      url: endpoint,
      data: options?.data,
      params: options?.params,
      includeAuth: options?.includeAuth,
      authType: options?.authType,
    });
  }

  protected async patch<T = any>(
    endpoint: string,
    data?: any,
    options?: { 
      includeAuth?: boolean; 
      authType?: 'admin' | 'shop' | 'customer';
      params?: Record<string, any>;
    }
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PATCH',
      url: endpoint,
      data,
      params: options?.params,
      includeAuth: options?.includeAuth,
      authType: options?.authType,
    });
  }

  protected buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, String(v)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    });
    
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  /**
   * Set a custom header for all requests
   */
  setDefaultHeader(key: string, value: string): void {
    this.axiosInstance.defaults.headers.common[key] = value;
  }

  /**
   * Remove a default header
   */
  removeDefaultHeader(key: string): void {
    delete this.axiosInstance.defaults.headers.common[key];
  }

  /**
   * Set the authorization token for all requests
   */
  setAuthToken(token: string): void {
    this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Clear the authorization token
   */
  clearAuthToken(): void {
    delete this.axiosInstance.defaults.headers.common['Authorization'];
  }

  /**
   * Get the axios instance for advanced usage
   */
  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }
}