import apiClient from "./client";

export type PosSaleStatus = "open" | "completed" | "voided" | "refunded" | "partially_refunded";
export type PosTenderMethod = "card" | "cash" | "gift_card" | "rcn" | "other";
export type PosPaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled"
  | "refunded";

export interface PosSaleItem {
  id: string;
  lineNumber: number;
  kind: "service" | "product" | "custom";
  serviceId: string | null;
  inventoryItemId: string | null;
  name: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  taxable: boolean;
  taxRateBps: number;
  taxCents: number;
  totalCents: number;
}

export interface PosSalePayment {
  id: string;
  method: PosTenderMethod;
  amountCents: number;
  tenderedCents: number | null;
  changeCents: number | null;
  status: PosPaymentStatus;
  stripePaymentIntentId: string | null;
  applicationFeeCents: number;
  failureReason: string | null;
}

export interface PosSale {
  id: string;
  shopId: string;
  locationId: string | null;
  customerAddress: string | null;
  saleNumber: number | null;
  status: PosSaleStatus;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  items: PosSaleItem[];
  payments: PosSalePayment[];
  paidCents: number;
  balanceCents: number;
}

const unwrap = <T,>(res: { data?: T; error?: string }, fallback: string): T => {
  if (!res?.data) throw new Error(res?.error || fallback);
  return res.data;
};

export const formatCents = (cents: number): string =>
  `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export async function createSale(input: {
  locationId?: string;
  customerAddress?: string;
  note?: string;
}): Promise<PosSale> {
  return unwrap(await apiClient.post("/shops/pos/sales", input), "Could not start a sale");
}

export async function getSale(saleId: string): Promise<PosSale> {
  return unwrap(await apiClient.get(`/shops/pos/sales/${saleId}`), "Could not load the sale");
}

export async function addItem(
  saleId: string,
  input: {
    kind: "service" | "product" | "custom";
    serviceId?: string;
    inventoryItemId?: string;
    name?: string;
    quantity?: number;
    unitPriceCents?: number;
    discountCents?: number;
    taxable?: boolean;
  }
): Promise<PosSale> {
  return unwrap(
    await apiClient.post(`/shops/pos/sales/${saleId}/items`, input),
    "Could not add that line"
  );
}

export async function removeItem(saleId: string, itemId: string): Promise<PosSale> {
  return unwrap(
    await apiClient.delete(`/shops/pos/sales/${saleId}/items/${itemId}`),
    "Could not remove that line"
  );
}

export async function takeCash(
  saleId: string,
  amountCents: number,
  tenderedCents?: number
): Promise<PosSale> {
  return unwrap(
    await apiClient.post(`/shops/pos/sales/${saleId}/payments`, {
      method: "cash",
      amountCents,
      tenderedCents,
    }),
    "Could not record the cash payment"
  );
}

export async function startCardPayment(
  saleId: string,
  readerId: string,
  amountCents?: number
): Promise<{ sale: PosSale; salePaymentId: string; paymentIntentId: string }> {
  return unwrap(
    await apiClient.post(`/shops/pos/sales/${saleId}/payments`, {
      method: "card",
      readerId,
      amountCents,
    }),
    "Could not start the card payment"
  );
}

export async function syncCardPayment(saleId: string, paymentId: string): Promise<PosSale> {
  return unwrap(
    await apiClient.post(`/shops/pos/sales/${saleId}/payments/${paymentId}/sync`),
    "Could not read the payment status"
  );
}

export async function cancelCardPayment(saleId: string, paymentId: string): Promise<PosSale> {
  return unwrap(
    await apiClient.post(`/shops/pos/sales/${saleId}/payments/${paymentId}/cancel`),
    "Could not cancel the payment"
  );
}

export async function completeSale(saleId: string): Promise<PosSale> {
  return unwrap(
    await apiClient.post(`/shops/pos/sales/${saleId}/complete`),
    "Could not complete the sale"
  );
}

export async function voidSale(saleId: string, reason?: string): Promise<void> {
  await apiClient.post(`/shops/pos/sales/${saleId}/void`, { reason });
}
