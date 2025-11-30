import { ServiceCategory } from "@/constants/service-categories";
import { BaseResponse } from "./base.interface";

export interface ServiceData {
  active: boolean;
  category: ServiceCategory;
  createdAt: string;
  description: string;
  durationMinutes: number;
  imageUrl: string;
  priceUsd: number;
  serviceId: string;
  serviceName: string;
  shopId: string;
  tags: string[];
  updatedAt: string;
}

export interface CreateServiceRequest {
  serviceName: string;
  description?: string;
  category?: string;
  priceUsd: number;
  durationMinutes?: number;
  imageUrl?: string;
  tags?: string[];
  active?: boolean;
}

export interface UpdateServiceData {
  serviceName?: string;
  description?: string;
  priceUsd?: number;
  durationMinutes?: number;
  category?: ServiceCategory;
  imageUrl?: string;
  tags?: string[];
  active?: boolean;
}

export interface ServiceResponse extends BaseResponse<ServiceData[]> {}