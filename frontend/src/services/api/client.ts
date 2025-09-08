import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for auth tokens
apiClient.interceptors.request.use((config) => {
  // Check for specific auth type tokens first
  const adminToken = localStorage.getItem("adminAuthToken");
  const shopToken = localStorage.getItem("shopAuthToken");
  const customerToken = localStorage.getItem("customerAuthToken");
  const genericToken = localStorage.getItem("token");
  
  // Use the most specific token available
  const token = adminToken || shopToken || customerToken || genericToken;
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear tokens on unauthorized
      localStorage.removeItem("adminAuthToken");
      localStorage.removeItem("shopAuthToken");
      localStorage.removeItem("customerAuthToken");
      localStorage.removeItem("token");
    }
    return Promise.reject(error);
  }
);

export default apiClient;