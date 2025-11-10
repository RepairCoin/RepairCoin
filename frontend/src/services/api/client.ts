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

// Response interceptor - return response.data directly for cleaner code
apiClient.interceptors.response.use(
  (response) => response.data, // Return just the data, not the full axios response
  (error) => {
    if (error.response?.status === 401) {
      // On 401 Unauthorized, redirect to home page
      // Cookie will be cleared by backend or expired
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.href = '/?session=expired';
      }
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