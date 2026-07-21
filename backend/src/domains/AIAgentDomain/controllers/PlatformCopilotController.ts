// backend/src/domains/AIAgentDomain/controllers/PlatformCopilotController.ts
//
// POST /api/admin/ai/platform-copilot — multi-turn "ask the platform" assistant
// for ADMINS (Admin AI #2). Platform-wide analog of the shop Insights chat:
// reuses the same agent loop + dispatcher, but with platform-scoped tools and
// no per-shop spend cap (admin-only, low volume). Auth is applied by the parent
// admin router. See docs/ADMIN_AI_RECOMMENDATIONS.html.

import { Request, Response } from "express";
import { Pool } from "pg";
import { logger } from "../../../utils/logger";
import { getSharedPool } from "../../../utils/database-pool";
import { AnthropicClient } from "../services/AnthropicClient";
import { buildDateContextBlock } from "../services/dateContext";
import { dispatchTool } from "../services/insights/dispatcher";
import {
  getPlatformTools,
  getPlatformToolByName,
} from "../services/platform/platformTools";
import { parseInsightsRequest } from "./InsightsController";
import {
  ChatMessage,
  ChatMessageContentBlock,
  ClaudeResponse,
} from "../types";
import { smartModel } from "../../../config/aiModels";

const MODEL = smartModel();
const MAX_TOKENS = 1024;
const MAX_TOOL_ITERATIONS = 5;
const PLATFORM_SCOPE = "__platform__"; // tools ignore shopId; this is a sentinel

const SYSTEM_PROMPT =
  "You are RepairCoin's Platform Health Copilot, for platform ADMINS (not shop " +
  "owners or customers). You answer questions about the WHOLE platform: shops, " +
  "customers, the RCN/RCG token economy, and subscription health. " +
  "RULES: (1) Always call a tool to get numbers — never invent or estimate them. " +
  "(2) Keep replies short: lead with the headline; the data card shows the numbers. " +
  "(3) If a question is outside platform health, say you can only answer platform " +
  "health questions (shops, customers, token economy, subscriptions). " +
  "(4) Format for a narrow side panel: short bulleted lists, avoid wide markdown tables.";

export interface ToolCallSummary {
  tool: string;
  display?: unknown;
  error?: string;
}

export interface CopilotLoopResult {
  reply: string;
  model: string;
  cached: boolean;
  latencyMs: number;
  toolCalls: ToolCallSummary[];
}

let defaultAnthropic: AnthropicClient | null = null;

function sharedAnthropic(injected?: AnthropicClient): AnthropicClient {
  return injected || (defaultAnthropic ??= new AnthropicClient());
}

/**
 * Runs the platform-copilot agent loop (data-grounded, tool-calling) and returns
 * the assembled reply + tool calls. Shared by the copilot chat endpoint and the
 * Smart Command Bar. Throws if the AI service is unavailable.
 */
export async function runPlatformCopilotLoop(
  anthropic: AnthropicClient,
  pool: Pool,
  messages: ChatMessage[]
): Promise<CopilotLoopResult | null> {
  const tools = getPlatformTools();
  const loopMessages: ChatMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const toolCalls: ToolCallSummary[] = [];
  const responseTexts: string[] = [];
  let last: ClaudeResponse | null = null;

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const response = await anthropic.complete({
      systemPrompt: [
        { text: SYSTEM_PROMPT, cache: true },
        { text: buildDateContextBlock(), cache: false },
      ],
      messages: loopMessages,
      model: MODEL,
      maxTokens: MAX_TOKENS,
      tools,
      toolChoice: { type: "auto" },
    });
    last = response;
    if (response.text && response.text.trim().length > 0) {
      responseTexts.push(response.text);
    }
    if (response.toolUses.length === 0) break;

    const assistantBlocks: ChatMessageContentBlock[] = [];
    if (response.text) {
      assistantBlocks.push({ type: "text", text: response.text });
    }
    for (const tu of response.toolUses) {
      assistantBlocks.push({
        type: "tool_use",
        id: tu.toolUseId,
        name: tu.toolName,
        input: tu.input,
      });
    }
    loopMessages.push({ role: "assistant", content: assistantBlocks });

    const resultBlocks: ChatMessageContentBlock[] = [];
    for (const tu of response.toolUses) {
      const tool = getPlatformToolByName(tu.toolName);
      if (!tool) {
        toolCalls.push({
          tool: tu.toolName,
          error: `Unknown tool '${tu.toolName}'`,
        });
        resultBlocks.push({
          type: "tool_result",
          tool_use_id: tu.toolUseId,
          content: JSON.stringify({ error: `Unknown tool '${tu.toolName}'` }),
          is_error: true,
        });
        continue;
      }
      const dr = await dispatchTool(tool, tu.input, {
        shopId: PLATFORM_SCOPE,
        pool,
      });
      toolCalls.push({
        tool: dr.tool,
        display: dr.ok ? dr.result?.display : undefined,
        ...(dr.ok ? {} : { error: dr.error }),
      });
      resultBlocks.push({
        type: "tool_result",
        tool_use_id: tu.toolUseId,
        content: dr.ok
          ? JSON.stringify(dr.result?.data ?? {})
          : JSON.stringify({ error: dr.error }),
        is_error: !dr.ok,
      });
    }
    loopMessages.push({ role: "user", content: resultBlocks });
  }

  if (!last) return null;

  return {
    reply: responseTexts.join("\n\n") || last.text || "",
    model: last.model,
    cached: last.usage.cacheReadInputTokens > 0,
    latencyMs: last.latencyMs,
    toolCalls,
  };
}

export function makePlatformCopilotController(
  deps: { anthropic?: AnthropicClient; pool?: Pool } = {}
) {
  const pool = deps.pool || getSharedPool();

  return {
    async ask(req: Request, res: Response): Promise<Response> {
      const parsed = parseInsightsRequest(req.body);
      if (!parsed.ok || !parsed.value) {
        return res.status(400).json({ success: false, error: parsed.error });
      }
      const { messages } = parsed.value;
      const anthropic = sharedAnthropic(deps.anthropic);

      let result: CopilotLoopResult | null;
      try {
        result = await runPlatformCopilotLoop(
          anthropic,
          pool,
          messages.map((m) => ({ role: m.role, content: m.content }))
        );
      } catch (err) {
        logger.error("PlatformCopilot: Claude call failed", err);
        return res
          .status(503)
          .json({ success: false, error: "AI service temporarily unavailable" });
      }

      if (!result) {
        return res
          .status(503)
          .json({ success: false, error: "AI service temporarily unavailable" });
      }

      return res.json({ success: true, data: result });
    },
  };
}
