// frontend/src/services/api/platformCopilot.ts
//
// Platform Health Copilot (Admin AI #2) API client.
// POST /api/admin/ai/platform-copilot — admin "ask the platform" assistant.

import apiClient from "./client";
import type { InsightsMessage, InsightsToolCall } from "./aiInsights";

export interface PlatformCopilotResponse {
  reply: string;
  model: string;
  cached: boolean;
  latencyMs: number;
  toolCalls: InsightsToolCall[];
}

export const PLATFORM_COPILOT_LIMITS = {
  maxMessages: 30,
  maxContentChars: 4000,
} as const;

export async function askPlatformCopilot(
  sessionId: string,
  messages: InsightsMessage[]
): Promise<PlatformCopilotResponse> {
  const res = await apiClient.post<{ data?: PlatformCopilotResponse }>(
    "/admin/ai/platform-copilot",
    { sessionId, messages }
  );
  return (
    res.data ?? { reply: "", model: "", cached: false, latencyMs: 0, toolCalls: [] }
  );
}
