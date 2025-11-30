import apiClient from "@/utilities/axios";
import { CreateShopRequest } from "../interfaces/shop.interface";

class ShopApi {
  async register(registrationData: CreateShopRequest) {
    try {
      return await apiClient.post("/shops/register", registrationData);
    } catch (error) {
      console.error("Failed to register shop:", error);
      throw error;
    }
  }
}

export const shopApi = new ShopApi();
