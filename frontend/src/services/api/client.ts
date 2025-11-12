import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Send cookies with requests
});

// Request interceptor - Add Authorization header from cookie as backup
// Cookies are sent via withCredentials, but some browsers/scenarios block cross-origin cookies
apiClient.interceptors.request.use((config) => {
  // Extract token from cookie and add as Authorization header for backup
  // This ensures protected routes work even if cookies are blocked
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    const authCookie = cookies.find(cookie => cookie.trim().startsWith('auth_token='));

    if (authCookie) {
      const token = authCookie.split('=')[1];
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }

  return config;
});

// Track if we're currently refreshing to avoid multiple simultaneous refresh requests
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Response interceptor - Handle token refresh on 401 errors
apiClient.interceptors.response.use(
  (response) => response.data, // Return just the data, not the full axios response
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry certain endpoints - they're expected to fail when not authenticated
      if (originalRequest.url?.includes('/auth/refresh') ||
          originalRequest.url?.includes('/auth/session') ||
          originalRequest.url?.includes('/auth/check-user')) {
        // These endpoints failing is normal when not authenticated
        // Don't trigger logout/refresh for these
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh the token
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        // Refresh successful, process queued requests
        processQueue(null);
        isRefreshing = false;

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear queue and trigger logout
        processQueue(refreshError, null);
        isRefreshing = false;

        if (typeof window !== 'undefined') {
          // Trigger wallet disconnect event to prevent auto-login after revocation
          // AuthProvider will handle the wallet disconnect and redirect
          window.dispatchEvent(new CustomEvent('auth:session-revoked'));
        }

        return Promise.reject(refreshError);
      }
    }

    // Check if session was revoked
    if (error.response?.data?.code === 'SESSION_REVOKED') {
      console.log('[API Client] Session revoked - triggering logout');

      // Trigger wallet disconnect event to prevent auto-login
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:session-revoked'));
      }

      // Don't redirect here - let the event handler in AuthProvider handle it
      return Promise.reject(new Error('Your session has been revoked. Please login again.'));
    }

    // Extract user-friendly error message from backend response
    const errorMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';

    // Create a new error with the extracted message
    const enhancedError = new Error(errorMessage);
    (enhancedError as any).response = error.response;
    (enhancedError as any).status = error.response?.status;

    return Promise.reject(enhancedError);
  }
);

export default apiClient;