import { Platform } from "react-native";
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

  async checkUserExists(address: string, email?: string) {
    try {
      return await apiClient.post("/auth/check-user", { address, ...(email ? { email } : {}) });
    } catch (error) {
      console.error("Failed to check user exists:", error);
      throw error;
    }
  }

  async getDemoStatus(): Promise<{ android: boolean; ios: boolean }> {
    try {
      return await apiClient.get(`/auth/demo/status`);
    } catch {
      return { android: false, ios: false };
    }
  }

  async loginDemo() {
    try {
      return await apiClient.post("/auth/demo", { platform: Platform.OS });
    } catch (error) {
      console.error("Failed to login demo:", error);
      throw error;
    }
  }

  async loginDemoShop() {
    try {
      return await apiClient.post("/auth/demo/shop", { platform: Platform.OS });
    } catch (error) {
      console.error("Failed to login demo shop:", error);
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
