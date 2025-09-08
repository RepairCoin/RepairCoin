// Export all API services
export { authApi } from './auth';
export { adminApi } from './admin';
export { customerApi } from './customer';
export { shopApi } from './shop';
export { tokenApi } from './token';
export { referralApi } from './referral';

// Export base classes and types
export { ApiService, type ApiResponse, type PaginatedResponse, type ApiError } from './base';

// Export all types
export * from '@/constants/types';

// Re-export commonly used types with clearer names
export type {
  Customer as CustomerType,
  Shop as ShopType,
  Transaction as TransactionType,
  BalanceData as BalanceDataType,
  ReferralData as ReferralDataType,
} from '@/constants/types';