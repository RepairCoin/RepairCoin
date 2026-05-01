import apiClient from "@/shared/utilities/axios";

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
      return await apiClient.post("/auth/refresh", { refreshToken });
    } catch (error) {
      console.error("Failed to refresh token:", error);
      throw error;
    }
  }
}

export const authApi = new AuthApi();
