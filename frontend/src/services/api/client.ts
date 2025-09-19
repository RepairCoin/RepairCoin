import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

console.log('🔍 FRONTEND API CONFIGURATION:');
console.log(`- process.env.NEXT_PUBLIC_API_URL: ${process.env.NEXT_PUBLIC_API_URL}`);
console.log(`- Default if not set: http://localhost:4000/api`);
console.log(`- Actually using: ${API_URL}`);
console.log('');

const apiClient = axios.create({
  baseURL: API_URL,
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
  console.log(`📡 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  
  // Check for specific auth type tokens first (legacy format)
  const adminTokenLegacy = localStorage.getItem("adminAuthToken");
  const shopTokenLegacy = localStorage.getItem("shopAuthToken");
  const customerTokenLegacy = localStorage.getItem("customerAuthToken");
  const genericToken = localStorage.getItem("token");
  
  // Check for new authManager format
  const adminTokenNew = getTokenFromAuthManager('admin');
  const shopTokenNew = getTokenFromAuthManager('shop');
  const customerTokenNew = getTokenFromAuthManager('customer');
  
  // Debug token availability
  console.log('🔐 Available tokens:', {
    adminToken: (adminTokenLegacy || adminTokenNew) ? 'Present' : 'Missing',
    shopToken: (shopTokenLegacy || shopTokenNew) ? 'Present' : 'Missing', 
    customerToken: (customerTokenLegacy || customerTokenNew) ? 'Present' : 'Missing',
    genericToken: genericToken ? 'Present' : 'Missing'
  });
  
  // Use the most specific token available (prefer new format over legacy)
  const token = adminTokenNew || adminTokenLegacy || 
                shopTokenNew || shopTokenLegacy || 
                customerTokenNew || customerTokenLegacy || 
                genericToken;
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('✅ Added auth header to request');
  } else {
    console.log('⚠️ No auth token available for request');
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