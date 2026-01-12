// Shop filters
export type StatusFilter = "all" | "pending" | "completed" | "failed";

// Customer filters
export type TransactionFilter = "all" | "earned" | "redeemed" | "gifts";

// Common filters
export type DateFilter = "all" | "today" | "week" | "month";
export type CustomerTransactionProps = {
  variant: "customer";
  type: string;
  amount: number;
  shopName?: string;
  description: string;
  createdAt: string;
};
export type ShopTransactionProps = {
  variant: "shop";
  amount: number;
  createdAt: string;
  paymentMethod: string;
  totalCost: number;
  status: string;
  completedAt?: string;
};
export type Props = CustomerTransactionProps | ShopTransactionProps;