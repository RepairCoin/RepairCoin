import { BaseResponse } from "./base.interface";

export interface PurchaseHistoryData {
  amount: number,
  completedAt: string,
  createdAt: string,
  id: number,
  paymentMethod: string,
  paymentReference: string,
  pricePerRcn: null,
  shopId: string,
  status: string,
  totalCost: number
}

export interface PurchaseHistory {
  purchases: PurchaseHistoryData[];
  total: number;
  totalPages: number;
}

export interface PurchaseHistoryResponse extends BaseResponse<PurchaseHistory> {}
