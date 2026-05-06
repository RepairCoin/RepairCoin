import apiClient from "@/shared/utilities/axios";
import {
  RewardRequest,
  RewardResponse,
} from "@/shared/interfaces/shop.interface";

class RewardApi {
  async issueReward(
    shopId: string,
    request: RewardRequest,
  ): Promise<RewardResponse> {
    try {
      return await apiClient.post(`/shops/${shopId}/issue-reward`, request);
    } catch (error: any) {
      console.error("Failed to issue reward:", error.message);
      throw error;
    }
  }

  async getRecentRewards(shopId: string, limit: number = 5): Promise<any> {
    try {
      return await apiClient.get(
        `/shops/${shopId}/transactions?type=reward&limit=${limit}`,
      );
    } catch (error: any) {
      console.error("Failed to get recent rewards:", error.message);
      throw error;
    }
  }
}

export const rewardApi = new RewardApi();
