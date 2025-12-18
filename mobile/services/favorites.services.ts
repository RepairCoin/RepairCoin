import { buildQueryString } from "@/utilities/buildQueryString";
import {
  ServiceData,
} from "../interfaces/service.interface";
import { apiClient } from "@/utilities/axios";

class FavoriteApi {
  async getFavorites(options?: {
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; data: ServiceData[]; pagination?: any }> {
    try {
      const queryString = options ? buildQueryString(options) : "";
      return await apiClient.get(`/services/favorites${queryString}`);
    } catch (error: any) {
      console.error("Failed to get favorites:", error.message);
      throw error;
    }
  }

  async addFavorite(
    serviceId: string
  ): Promise<{ success: boolean; data?: any }> {
    try {
      return await apiClient.post(`/services/favorites`, { serviceId });
    } catch (error: any) {
      console.error("Failed to add favorite:", error.message);
      throw error;
    }
  }

  async removeFavorite(
    serviceId: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.delete(`/services/favorites/${serviceId}`);
    } catch (error: any) {
      console.error("Failed to remove favorite:", error.message);
      throw error;
    }
  }

  async checkFavorite(
    serviceId: string
  ): Promise<{ success: boolean; data: { isFavorited: boolean } }> {
    try {
      return await apiClient.get(`/services/favorites/check/${serviceId}`);
    } catch (error: any) {
      console.error("Failed to check favorite:", error.message);
      throw error;
    }
  }
}

export const favoriteApi = new FavoriteApi();
