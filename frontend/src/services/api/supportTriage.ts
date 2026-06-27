// frontend/src/services/api/supportTriage.ts
//
// Support Ticket Triage (Admin AI #4) — AI category/priority/summary/reply.

import apiClient from "./client";

export interface SupportTriage {
  ticketId: string;
  suggestedCategory: string;
  suggestedPriority: string;
  summary: string;
  suggestedReply: string;
  generatedAt: string;
}

export async function getSupportTriage(
  ticketId: string,
  refresh = false
): Promise<SupportTriage | null> {
  const res = await apiClient.get<{ data?: SupportTriage }>(
    `/admin/support/tickets/${ticketId}/ai-triage`,
    { params: refresh ? { refresh: "true" } : {} }
  );
  return res.data ?? null;
}
