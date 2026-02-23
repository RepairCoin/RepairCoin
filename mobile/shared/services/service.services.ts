import { buildQueryString } from "@/shared/utilities/buildQueryString";
import {
  CreateServiceRequest,
  ServiceResponse,
  ServiceData,
  UpdateServiceData,
  ServiceFilters,
  ServiceDetailResponse,
} from "../interfaces/service.interface";
import {
  ServiceReviewsResponse,
  ReviewFilters,
} from "../interfaces/review.interface";
import { apiClient } from "@/shared/utilities/axios";

class ServiceApi {
  async getAll(filters?: ServiceFilters): Promise<ServiceResponse> {
    try {
      const queryString = filters ? buildQueryString({...filters}) : "";
      return await apiClient.get<ServiceResponse>(`/services${queryString}`);
    } catch (error: any) {
      console.error("Failed to get all services:", error.message);
      throw error;
    }
  }

  async getShopServices(
    shopId: string,
    options?: { page?: number; limit?: number }
  ): Promise<ServiceResponse> {
    try {
      const queryString = options ? buildQueryString(options) : "";
      return await apiClient.get<ServiceResponse>(
        `/services/shop/${shopId}${queryString}`
      );
    } catch (error: any) {
      console.error("Failed to get shop services:", error.message);
      throw error;
    }
  }

  async getTrendingServices(options?: { limit?: number; days?: number }): Promise<any> {
    try {
      const queryString = options ? buildQueryString(options) : "";
      return await apiClient.get<any>(`/services/discovery/trending${queryString}`);
    } catch (error: any) {
      console.error("Failed to get trending services:", error.message);
      throw error;
    }
  }

  async getRecentlyViewed(options?: { limit?: number }): Promise<any> {
    try {
      const queryString = options ? buildQueryString(options) : "";
      return await apiClient.get<any>(`/services/discovery/recently-viewed${queryString}`);
    } catch (error: any) {
      console.error("Failed to get recently viewed services:", error.message);
      throw error;
    }
  }

  async trackRecentlyViewed(serviceId: string): Promise<any> {
    try {
      return await apiClient.post(`/services/discovery/recently-viewed`, { serviceId });
    } catch (error: any) {
      console.error("Failed to track recently viewed:", error.message);
      throw error;
    }
  }

  async getSimilarServices(serviceId: string, options?: { limit?: number }): Promise<any> {
    try {
      const queryString = options ? buildQueryString(options) : "";
      return await apiClient.get<any>(`/services/discovery/similar/${serviceId}${queryString}`);
    } catch (error: any) {
      console.error("Failed to get similar services:", error.message);
      throw error;
    }
  }

  async getService(serviceId: string): Promise<ServiceDetailResponse> {
    try {
      return await apiClient.get<ServiceDetailResponse>(`/services/${serviceId}`);
    } catch (error: any) {
      console.error("Failed to get service detail:", error.message);
      throw error;
    }
  }

  async create(
    serviceData: CreateServiceRequest
  ): Promise<{ success: boolean; data?: ServiceData; message?: string }> {
    try {
      const requestData = {
        ...serviceData,
        tags: serviceData.tags ? JSON.stringify(serviceData.tags) : undefined,
      };
      return await apiClient.post(`/services`, requestData);
    } catch (error: any) {
      console.error("Failed to create service:", error.message);
      throw error;
    }
  }

  async update(
    serviceId: string,
    updates: UpdateServiceData
  ): Promise<{ success: boolean; data?: ServiceData; message?: string }> {
    try {
      const requestData = {
        ...updates,
        tags: updates.tags ? JSON.stringify(updates.tags) : undefined,
      };
      return await apiClient.put(`/services/${serviceId}`, requestData);
    } catch (error: any) {
      console.error("Failed to update service:", error.message);
      throw error;
    }
  }

  async delete(
    serviceId: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiClient.delete(`/services/${serviceId}`);
    } catch (error: any) {
      console.error("Failed to delete service:", error.message);
      throw error;
    }
  }

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

  async getServiceReviews(
    serviceId: string,
    filters?: ReviewFilters
  ): Promise<ServiceReviewsResponse> {
    try {
      const queryString = filters ? buildQueryString(filters) : "";
      return await apiClient.get(`/services/${serviceId}/reviews${queryString}`);
    } catch (error: any) {
      console.error("Failed to get service reviews:", error.message);
      throw error;
    }
  }
}

export const serviceApi = new ServiceApi();
