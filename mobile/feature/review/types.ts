export interface ReviewParams {
  orderId: string;
  serviceId?: string;
  serviceName?: string;
  shopName?: string;
}

export interface SubmitReviewData {
  orderId: string;
  rating: number;
  comment: string;
}

export type RatingLevel = 0 | 1 | 2 | 3 | 4 | 5;
