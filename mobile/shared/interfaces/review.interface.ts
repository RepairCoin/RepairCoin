import { BaseResponse } from "./base.interface";

export interface ReviewData {
  reviewId: string;
  orderId: string;
  serviceId: string;
  customerId: string;
  customerName: string | null;
  customerAddress: string;
  rating: number;
  comment: string | null;
  images: string[] | null;
  shopResponse: string | null;
  shopResponseAt: string | null;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
  // Service info
  serviceName?: string;
  // Shop info
  shopName?: string;
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface ServiceReviewsResponse extends BaseResponse<ReviewData[]> {
  stats?: ReviewStats;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ReviewFilters {
  page?: number;
  limit?: number;
  rating?: number;
  [key: string]: string | number | boolean | undefined;
}
