import apiClient from "./client";

export interface TerminalReader {
  id: string;
  stripeReaderId: string;
  label: string | null;
  deviceType: string | null;
  serialNumber: string | null;
  status: string | null;
  lastSeenAt: string | null;
  isDefault: boolean;
  shopLocationId: string | null;
  locationName: string | null;
}

export interface TestPaymentStatus {
  status: string;
  amount: number;
}

export interface TerminalReadiness {
  terminalReady: boolean;
  cardPaymentsCapability: string;
  accountId: string | null;
}

export async function getTerminalReadiness(): Promise<TerminalReadiness | null> {
  const res = await apiClient.get<{ data?: TerminalReadiness }>("/shops/terminal/readiness");
  return res.data ?? null;
}

export async function listReaders(): Promise<TerminalReader[]> {
  const res = await apiClient.get<{ data?: { readers: TerminalReader[] } }>(
    "/shops/terminal/readers"
  );
  return res.data?.readers ?? [];
}

export async function registerReader(input: {
  registrationCode: string;
  label?: string;
  locationId?: string;
}): Promise<TerminalReader> {
  const res = await apiClient.post<{ data?: { reader: TerminalReader }; error?: string }>(
    "/shops/terminal/readers",
    input
  );
  if (!res.data?.reader) throw new Error(res.error || "Could not pair that reader");
  return res.data.reader;
}

export async function setDefaultReader(id: string): Promise<void> {
  await apiClient.post(`/shops/terminal/readers/${id}/default`);
}

export async function removeReader(id: string): Promise<void> {
  await apiClient.delete(`/shops/terminal/readers/${id}`);
}

export async function startTestPayment(id: string): Promise<{ paymentIntentId: string }> {
  const res = await apiClient.post<{ data?: { paymentIntentId: string }; error?: string }>(
    `/shops/terminal/readers/${id}/test-payment`
  );
  if (!res.data?.paymentIntentId) throw new Error(res.error || "Could not start a test payment");
  return res.data;
}

export async function getTestPaymentStatus(
  paymentIntentId: string
): Promise<TestPaymentStatus | null> {
  const res = await apiClient.get<{ data?: TestPaymentStatus }>(
    `/shops/terminal/test-payment/${paymentIntentId}`
  );
  return res.data ?? null;
}

export async function cancelTestPayment(paymentIntentId: string): Promise<void> {
  await apiClient.post("/shops/terminal/test-payment/cancel", { paymentIntentId });
}
