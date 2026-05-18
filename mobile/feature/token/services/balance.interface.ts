import { BaseResponse } from "@/shared/interfaces/base.interface";

export interface CustomerBalanceData {
  totalBalance: number;
  availableBalance?: number;
}

export interface CustomerBalanceResponse extends BaseResponse<CustomerBalanceData> {}
