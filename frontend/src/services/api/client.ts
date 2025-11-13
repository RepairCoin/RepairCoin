import axios, { AxiosError } from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Send cookies with requests
});

// Request interceptor
// NOTE: We do NOT try to read httpOnly cookies here - that's impossible and by design!
// The auth_token cookie is httpOnly and automatically sent by the browser with withCredentials: true
// If you need to debug, check the Network tab in DevTools to see if cookies are being sent
apiClient.interceptors.request.use((config) => {
  // Cookies are automatically sent via withCredentials: true
  // No need to manually add Authorization header - the backend reads from cookies

  // Optional: Add request ID for tracking
  if (typeof window !== 'undefined') {
    config.headers['X-Request-ID'] = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  return config;
});

// Track if we're currently refreshing to avoid multiple simultaneous refresh requests
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
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
        // Refresh failed, clear queue
        const axiosError = refreshError as AxiosError<{ code?: string; message?: string }>;
        processQueue(axiosError, null);
        isRefreshing = false;

        // Only trigger session-revoked if we had a session before
        // Check if the error is SESSION_REVOKED or if there was actually a refresh token
        const isSessionRevoked = axiosError?.response?.data?.code === 'SESSION_REVOKED';
        const hadSession = axiosError?.response?.status === 401 &&
                          axiosError?.response?.data?.message?.includes('revoked');

        if (typeof window !== 'undefined' && (isSessionRevoked || hadSession)) {
          // Trigger wallet disconnect event only if session was actually revoked
          // Don't trigger for "no session exists yet" scenarios (like incognito mode)
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
    const enhancedError = new Error(errorMessage) as Error & {
      response?: unknown;
      status?: number
    };
    enhancedError.response = error.response;
    enhancedError.status = error.response?.status;

    return Promise.reject(enhancedError);
  }
);

export default apiClient;