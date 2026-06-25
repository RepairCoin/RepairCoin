// frontend/src/services/api/fraud.ts
//
// Trust & Safety (Fraud & Abuse Detection) admin API client.
// See docs/FRAUD_DETECTION_SPEC.md.

import apiClient from "./client";

export type FraudStatus = "open" | "investigating" | "confirmed" | "dismissed";
export type FraudSubject = "shop" | "customer" | "pair";

export interface FraudFinding {
  id: string;
  rule_key: string;
  severity: number;
  status: FraudStatus;
  subject_type: FraudSubject;
  shop_id: string | null;
  customer_address: string | null;
  window_start: string | null;
  window_end: string | null;
  metrics: Record<string, unknown>;
  explanation: string | null;
  recommended_action: string | null;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_note: string | null;
}

export interface FraudSummary {
  open: number;
  investigating: number;
  confirmed: number;
  dismissed: number;
  open_high_severity: number;
}

interface ListParams {
  status?: FraudStatus;
  minSeverity?: number;
  subjectType?: FraudSubject;
  ruleKey?: string;
  limit?: number;
}

export async function listFraudFindings(
  params: ListParams = {}
): Promise<FraudFinding[]> {
  const res = await apiClient.get<{ data?: FraudFinding[] }>(
    "/admin/fraud/findings",
    { params }
  );
  return res.data ?? [];
}

export async function getFraudFinding(id: string): Promise<FraudFinding | null> {
  const res = await apiClient.get<{ data?: FraudFinding }>(
    `/admin/fraud/findings/${id}`
  );
  return res.data ?? null;
}

export async function updateFraudFindingStatus(
  id: string,
  status: FraudStatus,
  note?: string
): Promise<FraudFinding | null> {
  const res = await apiClient.post<{ data?: FraudFinding }>(
    `/admin/fraud/findings/${id}/status`,
    { status, note }
  );
  return res.data ?? null;
}

export interface FraudScanResult {
  scanned: number;
  upserted: number;
  byRule: Record<string, number>;
}

/** Trigger the detection scan on demand (same engine as the nightly run). */
export async function runFraudScan(): Promise<FraudScanResult | null> {
  const res = await apiClient.post<{ data?: FraudScanResult }>(
    "/admin/fraud/scan"
  );
  return res.data ?? null;
}

export async function getFraudSummary(): Promise<FraudSummary | null> {
  const res = await apiClient.get<{ data?: FraudSummary }>(
    "/admin/fraud/summary"
  );
  return res.data ?? null;
}

/**
 * Phase 3 — targeted enforcement reuses the existing, audited admin suspend
 * endpoints (NOT the platform-wide emergency freeze). Suspends the specific
 * shop or customer behind a confirmed finding.
 */
export async function suspendShopForFraud(
  shopId: string,
  reason: string
): Promise<void> {
  await apiClient.post(`/admin/shops/${shopId}/suspend`, { reason });
}

export async function suspendCustomerForFraud(
  address: string,
  reason: string
): Promise<void> {
  await apiClient.post(`/admin/customers/${address}/suspend`, { reason });
}
