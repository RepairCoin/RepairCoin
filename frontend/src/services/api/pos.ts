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
  unitCostCents: number | null;
  warrantyDays: number | null;
}

export interface ActiveWarranty {
  source: "pos_sale" | "booking";
  reference: string;
  serviceName: string;
  completedAt: string;
  expiresAt: string;
  daysRemaining: number;
  warrantyDays: number;
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
  refundedCents: number;
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
  receiptEmail: string | null;
  receiptSentAt: string | null;
  completedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  items: PosSaleItem[];
  payments: PosSalePayment[];
  paidCents: number;
  balanceCents: number;
}

/** A history row: the sale without its lines, plus the line count a list needs to show. */
export type PosSaleListRow = Omit<PosSale, "items" | "payments" | "paidCents" | "balanceCents"> & {
  itemCount: number;
};

export interface PosSalesSummary {
  saleCount: number;
  netRevenueCents: number;
  taxCents: number;
  totalCents: number;
  costedRevenueCents: number;
  costCents: number;
  marginCents: number;
  marginBps: number | null;
  uncostedRevenueCents: number;
  tenders: Partial<Record<PosTenderMethod, number>>;
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

export interface PosSalesPage {
  sales: PosSaleListRow[];
  total: number;
}

/**
 * `from` and `to` are sent as full ISO timestamps resolved in the browser's timezone. No shop
 * timezone is recorded anywhere, so a bare calendar date would be read as UTC on the server and
 * cut an evening's takings onto the wrong day.
 */
export async function listSales(options: {
  status?: PosSaleStatus;
  locationId?: string | null;
  saleNumber?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<PosSalesPage> {
  const query = new URLSearchParams();
  if (options.status) query.set("status", options.status);
  if (options.locationId) query.set("locationId", options.locationId);
  if (options.saleNumber) query.set("saleNumber", String(options.saleNumber));
  if (options.from) query.set("from", options.from);
  if (options.to) query.set("to", options.to);
  if (options.limit) query.set("limit", String(options.limit));
  if (options.offset) query.set("offset", String(options.offset));
  const qs = query.toString();
  return unwrap(
    await apiClient.get(`/shops/pos/sales${qs ? `?${qs}` : ""}`),
    "Could not load sales"
  );
}

/** Start of the local day for a `YYYY-MM-DD` from a date input, as an ISO instant. */
export const localDayStart = (day: string): string =>
  new Date(`${day}T00:00:00`).toISOString();

/** Start of the day *after* a `YYYY-MM-DD`, so a range bounded with `<` includes that whole day. */
export const localDayEnd = (day: string): string => {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
};

export interface PosRefundResult {
  sale: PosSale;
  refundedCents: number;
  legs: { method: PosTenderMethod; amountCents: number }[];
  failures: string[];
}

/**
 * Refunds a completed sale. Omit `amountCents` to give the whole remaining balance back; the
 * server spreads it across the sale's tenders, card first.
 */
export async function refundSale(
  saleId: string,
  input: { amountCents?: number; reason?: string; note?: string; restock?: boolean } = {}
): Promise<PosRefundResult> {
  return unwrap(
    await apiClient.post(`/shops/pos/sales/${saleId}/refund`, input),
    "Could not refund the sale"
  );
}

/** Re-sends the emailed receipt. Omit the address to use the one already on the sale. */
export async function resendReceipt(saleId: string, email?: string): Promise<{ sentTo: string }> {
  return unwrap(
    await apiClient.post(`/shops/pos/sales/${saleId}/receipt`, email ? { email } : {}),
    "Could not send the receipt"
  );
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

/** Sets a line's quantity outright. Zero removes the line. */
export async function setItemQuantity(
  saleId: string,
  itemId: string,
  quantity: number
): Promise<PosSale> {
  return unwrap(
    await apiClient.patch(`/shops/pos/sales/${saleId}/items/${itemId}`, { quantity }),
    "Could not change the quantity"
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

export async function completeSale(saleId: string, receiptEmail?: string): Promise<PosSale> {
  return unwrap(
    await apiClient.post(`/shops/pos/sales/${saleId}/complete`, { receiptEmail }),
    "Could not complete the sale"
  );
}

export async function voidSale(saleId: string, reason?: string): Promise<void> {
  await apiClient.post(`/shops/pos/sales/${saleId}/void`, { reason });
}

export async function setSaleCustomer(saleId: string, customerAddress: string): Promise<PosSale> {
  return unwrap(
    await apiClient.put(`/shops/pos/sales/${saleId}/customer`, { customerAddress }),
    "Could not attach that customer"
  );
}

/** What this shop still covers for this customer, soonest to expire first. */
export async function getCustomerWarranties(customerAddress: string): Promise<ActiveWarranty[]> {
  return unwrap(
    await apiClient.get(
      `/shops/pos/warranties?customerAddress=${encodeURIComponent(customerAddress)}`
    ),
    "Could not load warranties"
  );
}

export async function clearSaleCustomer(saleId: string): Promise<PosSale> {
  return unwrap(
    await apiClient.delete(`/shops/pos/sales/${saleId}/customer`),
    "Could not remove the customer"
  );
}

export async function getPosSummary(options: {
  days?: number;
  locationId?: string | null;
} = {}): Promise<PosSalesSummary> {
  const params = new URLSearchParams();
  if (options.days) params.set("days", String(options.days));
  if (options.locationId) params.set("locationId", options.locationId);
  const query = params.toString();
  return unwrap(
    await apiClient.get(`/shops/pos/reports/summary${query ? `?${query}` : ""}`),
    "Could not load the register summary"
  );
}
