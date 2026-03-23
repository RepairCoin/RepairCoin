import { apiClient } from "@/shared/utilities/axios";

export interface ServiceGroupLink {
  id: number;
  serviceId: string;
  groupId: string;
  tokenRewardPercentage: number;
  bonusMultiplier: number;
  active: boolean;
  groupName?: string;
  customTokenName?: string;
  customTokenSymbol?: string;
  icon?: string;
}

class ServiceGroupApi {
  async getServiceGroups(serviceId: string): Promise<ServiceGroupLink[]> {
    try {
      const response = await apiClient.get(`/services/${serviceId}/groups`);
      return response.data || [];
    } catch (error: any) {
      console.error("Failed to get service groups:", error.message);
      throw error;
    }
  }

  async linkServiceToGroup(
    serviceId: string,
    groupId: string,
    tokenRewardPercentage: number = 100,
    bonusMultiplier: number = 1.0
  ): Promise<ServiceGroupLink> {
    try {
      const response = await apiClient.post(
        `/services/${serviceId}/groups/${groupId}`,
        { tokenRewardPercentage, bonusMultiplier }
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to link service to group:", error.message);
      throw error;
    }
  }

  async unlinkServiceFromGroup(
    serviceId: string,
    groupId: string
  ): Promise<void> {
    try {
      await apiClient.delete(`/services/${serviceId}/groups/${groupId}`);
    } catch (error: any) {
      console.error("Failed to unlink service from group:", error.message);
      throw error;
    }
  }

  async updateServiceGroupRewards(
    serviceId: string,
    groupId: string,
    tokenRewardPercentage?: number,
    bonusMultiplier?: number
  ): Promise<ServiceGroupLink> {
    try {
      const response = await apiClient.put(
        `/services/${serviceId}/groups/${groupId}/rewards`,
        { tokenRewardPercentage, bonusMultiplier }
      );
      return response.data || response;
    } catch (error: any) {
      console.error("Failed to update service group rewards:", error.message);
      throw error;
    }
  }
}

export const serviceGroupApi = new ServiceGroupApi();
