import { BaseResponse } from "./base.interface";

export interface CustomerBalanceData {
  totalBalance: number;
  availableBalance?: number;
}

export interface CustomerBalanceResponse extends BaseResponse<CustomerBalanceData> {}
