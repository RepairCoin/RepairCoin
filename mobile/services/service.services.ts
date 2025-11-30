import { buildQueryString } from "@/utilities/helper/buildQueryString";
import {
  CreateServiceRequest,
  ServiceResponse,
  ServiceData,
  UpdateServiceData,
} from "../interfaces/service.interface";
import { apiClient } from "@/utilities/axios";

class ServiceApi {
  async getServices(
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
}

export const serviceApi = new ServiceApi();
