export interface BaseResponse<T> {
  items?: T[];
  data?: T;
  pagination?: {
    hasMore: boolean;
    limit: number;
    page: number;
    totalItems: number;
    totalPages: number;
  };
  success?: boolean;
  message?: string;
}