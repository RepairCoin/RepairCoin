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

export interface ExecutiveBriefing {
  generatedAt: string;
  briefing: string;
  data: Record<string, unknown>;
}

export async function getExecutiveBriefing(
  refresh = false
): Promise<ExecutiveBriefing | null> {
  const res = await apiClient.get<{ data?: ExecutiveBriefing }>(
    "/admin/ai/briefing",
    { params: refresh ? { refresh: "true" } : {} }
  );
  return res.data ?? null;
}

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

// Smart Command Bar (⌘K) — routes a query to navigation or a data-grounded answer.
export interface CommandBarResult {
  type: "navigate" | "answer";
  navigateTo: string | null;
  answer?: string;
  suggestions: string[];
  aiAvailable?: boolean;
}

export async function runCommandBar(query: string): Promise<CommandBarResult> {
  const res = await apiClient.post<{ data?: CommandBarResult }>(
    "/admin/ai/command",
    { query }
  );
  return (
    res.data ?? { type: "answer", navigateTo: null, suggestions: [], aiAvailable: false }
  );
}
