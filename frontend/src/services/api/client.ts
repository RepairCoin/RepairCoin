import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Send cookies with requests
});

// Request interceptor - cookies are automatically sent with withCredentials: true
// No need to manually add Authorization header anymore
apiClient.interceptors.request.use((config) => {
  // Cookies are automatically sent by the browser
  // No manual token management needed
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