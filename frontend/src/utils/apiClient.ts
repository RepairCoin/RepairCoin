// frontend/src/utils/apiClient.ts
/**
 * API Client with automatic cookie-based authentication
 * Cookies are sent automatically with credentials: 'include'
 */

interface ApiConfig {
  baseURL: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

interface ApiError {
  success: false;
  error: string;
  code?: string;
  statusCode?: number;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

class ApiClient {
  private config: ApiConfig;
  private pendingRequests: Map<string, AbortController> = new Map();
  
  constructor(config: ApiConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
  }

  // Make an API request with automatic cookie-based auth
  async request<T = any>(
    endpoint: string,
    options: RequestInit & {
      role?: 'admin' | 'shop' | 'customer'; // Deprecated - kept for backward compatibility
      skipAuth?: boolean; // Deprecated - cookies sent automatically
      retry?: boolean;
    } = {}
  ): Promise<ApiResponse<T>> {
    const {
      role, // Deprecated
      skipAuth = false, // Deprecated
      retry = true,
      ...fetchOptions
    } = options;

    // Cancel any pending request to the same endpoint
    const requestKey = `${fetchOptions.method || 'GET'}-${endpoint}`;
    this.cancelRequest(requestKey);

    // Create abort controller for this request
    const abortController = new AbortController();
    this.pendingRequests.set(requestKey, abortController);

    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.config.timeout!);

    try {
      // Build headers
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...fetchOptions.headers
      };

      // Make the request with credentials to send cookies
      const response = await fetch(`${this.config.baseURL}${endpoint}`, {
        ...fetchOptions,
        headers,
        credentials: 'include', // Send cookies with request
        signal: abortController.signal
      });

      clearTimeout(timeoutId);
      this.pendingRequests.delete(requestKey);

      // Handle auth errors
      if (response.status === 401) {
        // Emit auth error event
        window.dispatchEvent(new CustomEvent('auth:unauthorized', {
          detail: { endpoint }
        }));

        // Redirect to home page (cookie expired or invalid)
        if (typeof window !== 'undefined' && window.location.pathname !== '/') {
          window.location.href = '/?session=expired';
        }

        return {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED'
        };
      }

      // Parse response
      const data = await response.json();

      // Handle API errors
      if (!response.ok || !data.success) {
        const error: ApiError = {
          success: false,
          error: data.error || `Request failed with status ${response.status}`,
          code: data.code || 'API_ERROR',
          statusCode: response.status
        };

        // Retry on certain errors
        if (retry && this.shouldRetry(response.status)) {
          return this.retryRequest(endpoint, options);
        }

        return error;
      }

      return data;
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      this.pendingRequests.delete(requestKey);

      // Handle network errors
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
          code: 'TIMEOUT'
        };
      }

      return {
        success: false,
        error: error.message || 'Network error',
        code: 'NETWORK_ERROR'
      };
    }
  }

  // Convenience methods
  async get<T = any>(endpoint: string, options?: Parameters<typeof this.request>[1]) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T = any>(endpoint: string, data?: any, options?: Parameters<typeof this.request>[1]) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put<T = any>(endpoint: string, data?: any, options?: Parameters<typeof this.request>[1]) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T = any>(endpoint: string, options?: Parameters<typeof this.request>[1]) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // Cancel a pending request
  cancelRequest(key: string) {
    const controller = this.pendingRequests.get(key);
    if (controller) {
      controller.abort();
      this.pendingRequests.delete(key);
    }
  }

  // Cancel all pending requests
  cancelAllRequests() {
    this.pendingRequests.forEach(controller => controller.abort());
    this.pendingRequests.clear();
  }

  // Determine if request should be retried
  private shouldRetry(statusCode: number): boolean {
    // Retry on server errors and rate limiting
    return statusCode >= 500 || statusCode === 429;
  }

  // Retry a failed request
  private async retryRequest<T = any>(
    endpoint: string,
    options: Parameters<typeof this.request>[1],
    attempt: number = 1
  ): Promise<ApiResponse<T>> {
    if (attempt >= this.config.retryAttempts!) {
      return {
        success: false,
        error: 'Max retry attempts reached',
        code: 'MAX_RETRIES'
      };
    }

    // Wait before retrying
    await new Promise(resolve => 
      setTimeout(resolve, this.config.retryDelay! * attempt)
    );

    return this.request<T>(endpoint, {
      ...options,
      retry: false // Prevent infinite recursion
    });
  }
}

// Create default API client instance
const apiClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
});

// Export for use in components
export default apiClient;

// Export class for creating custom instances
export { ApiClient };

// Helper function to handle API errors in components
export function handleApiError(error: ApiError | ApiResponse, defaultMessage?: string): string {
  if ('error' in error && error.error) {
    return error.error;
  }
  return defaultMessage || 'An unexpected error occurred';
}