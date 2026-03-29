import axios from "axios";
import apiClient from "@/shared/utilities/axios";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";

class AuthApi {
  async getToken(address: string) {
    try {
      return await apiClient.post("/auth/token", { address });
    } catch (error) {
      console.error("Failed to get token:", error);
      throw error;
    }
  }

  async checkUserExists(address: string) {
    try {
      return await apiClient.post("/auth/check-user", { address });
    } catch (error) {
      console.error("Failed to check user exists:", error);
      throw error;
    }
  }

  async getRefreshToken(refreshToken: string) {
    try {
      // Use raw axios to bypass interceptors — the access token is expired,
      // so sending it via the interceptor would cause a 401 loop
      const response = await axios.post(
        `${BASE_URL}/auth/refresh`,
        { refreshToken },
        { headers: { "Content-Type": "application/json" }, timeout: 10000 }
      );
      return response.data;
    } catch (error) {
      console.error("Failed to refresh token:", error);
      throw error;
    }
  }
}

export const authApi = new AuthApi();
