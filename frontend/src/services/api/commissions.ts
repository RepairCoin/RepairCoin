import apiClient from './client';

export interface CommissionSettings {
  enabled: boolean;
  defaultPercent: number;
}

export const getCommissionSettings = async (): Promise<CommissionSettings> => {
  const res = await apiClient.get<{ success: boolean; data: CommissionSettings }>(
    '/shops/commissions/settings'
  );
  return res.data;
};

export const updateCommissionSettings = async (input: {
  enabled?: boolean;
  defaultPercent?: number;
}): Promise<CommissionSettings> => {
  const res = await apiClient.put<{ success: boolean; data: CommissionSettings }>(
    '/shops/commissions/settings',
    input
  );
  return res.data;
};

export type CommissionStatus = 'accrued' | 'paid' | 'voided';

export interface CommissionRow {
  id: string;
  orderId: string;
  memberId: string;
  memberName: string;
  baseAmount: number;
  ratePercent: number;
  amount: number;
  status: CommissionStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface CommissionMemberSummary {
  memberId: string;
  memberName: string;
  accruedAmount: number;
  paidAmount: number;
  totalAmount: number;
  count: number;
}

export interface CommissionReport {
  summary: CommissionMemberSummary[];
  rows: CommissionRow[];
}

export interface CommissionQuery {
  from?: string;
  to?: string;
  memberId?: string;
  status?: CommissionStatus;
}

const buildQuery = (params: Record<string, string | undefined>): string => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.append(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export const getCommissions = async (query: CommissionQuery = {}): Promise<CommissionReport> => {
  const res = await apiClient.get<{ success: boolean; data: CommissionReport }>(
    `/shops/commissions${buildQuery({
      from: query.from,
      to: query.to,
      memberId: query.memberId,
      status: query.status,
    })}`
  );
  return res.data;
};

export const markCommissionsPaid = async (input: {
  from?: string;
  to?: string;
  memberId?: string;
  payoutNote?: string;
}): Promise<{ count: number; totalPaid: number }> => {
  const res = await apiClient.post<{ success: boolean; data: { count: number; totalPaid: number } }>(
    '/shops/commissions/mark-paid',
    input
  );
  return res.data;
};

export interface MyCommissionRow {
  id: string;
  orderId: string;
  baseAmount: number;
  ratePercent: number;
  amount: number;
  status: CommissionStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface MyCommissions {
  commissionsEnabled: boolean;
  summary: { accrued: number; paid: number; total: number; count: number };
  rows: MyCommissionRow[];
}

// A team member's own commission — readable by any shop user (staff included), scoped to
// themselves. Backs the staff self-view; the shop-wide report stays behind shop:manage.
export const getMyCommissions = async (
  query: { from?: string; to?: string } = {}
): Promise<MyCommissions> => {
  const res = await apiClient.get<{ success: boolean; data: MyCommissions }>(
    `/shops/team/my-commissions${buildQuery({ from: query.from, to: query.to })}`
  );
  return res.data;
};
