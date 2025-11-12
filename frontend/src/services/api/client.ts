import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Helper function to get token from authManager format
function getTokenFromAuthManager(role: string): string | null {
  const key = `repaircoin_${role}_token`;
  const storedData = localStorage.getItem(key);
  if (storedData) {
    try {
      const tokenInfo = JSON.parse(storedData);
      return tokenInfo.token || null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

// Request interceptor for auth tokens
apiClient.interceptors.request.use((config) => {
  // Check for specific auth type tokens first (legacy format)
  const adminTokenLegacy = localStorage.getItem("adminAuthToken");
  const shopTokenLegacy = localStorage.getItem("shopAuthToken");
  const customerTokenLegacy = localStorage.getItem("customerAuthToken");
  const genericToken = localStorage.getItem("token");
  
  // Check for new authManager format
  const adminTokenNew = getTokenFromAuthManager('admin');
  const shopTokenNew = getTokenFromAuthManager('shop');
  const customerTokenNew = getTokenFromAuthManager('customer');
  
  // Use the most specific token available (prefer new format over legacy)
  const token = adminTokenNew || adminTokenLegacy || 
                shopTokenNew || shopTokenLegacy || 
                customerTokenNew || customerTokenLegacy || 
                genericToken;
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    // Only log when no token is available for protected endpoints
    if (config.url && !config.url.includes('/auth/')) {
      console.warn('⚠️ No auth token available for protected endpoint:', config.url);
    }
  }
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear tokens on unauthorized (both legacy and new formats)
      localStorage.removeItem("adminAuthToken");
      localStorage.removeItem("shopAuthToken");
      localStorage.removeItem("customerAuthToken");
      localStorage.removeItem("token");

      // Clear new authManager format tokens
      localStorage.removeItem("repaircoin_admin_token");
      localStorage.removeItem("repaircoin_shop_token");
      localStorage.removeItem("repaircoin_customer_token");
    }
    return Promise.reject(error);
  }
);

export default apiClient;