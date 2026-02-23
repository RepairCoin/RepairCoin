import { TransactionFilter } from "../types";

export const TRANSACTION_FILTERS: { id: TransactionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "earned", label: "Earned" },
  { id: "redeemed", label: "Redeemed" },
  { id: "gifts", label: "Gifts" },
];
