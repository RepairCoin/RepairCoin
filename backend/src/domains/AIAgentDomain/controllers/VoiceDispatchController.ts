// backend/src/domains/AIAgentDomain/controllers/VoiceDispatchController.ts
//
// POST /api/ai/dispatch — cross-domain voice router (Phase 3).
//
// Request body: { transcript: string, sessionId: string,
//                 source?: 'voice' | 'inline_mic' }
// Response:     { success: true, data: { domain, transcript,
//                                         sessionId, routerSkipped: false } }
//             | { success: false, error: string }
//
// Flow:
//   1. Validate (auth, transcript shape, sessionId shape).
//   2. SpendCapEnforcer.canSpend(shopId) — 429 if budget exhausted.
//      Router cost is tiny (~$0.0002 per call) but it still rolls up
//      against the per-shop monthly cap so cost monitoring is unified.
//   3. VoiceRouter.classifyDomain(transcript) — Haiku 4-way.
//   4. Always write the audit row (success OR failure).
//   5. recordSpend on success.
//   6. Return the domain decision; frontend opens the matching panel.
//
// Note: this endpoint does NOT internally call the Insights / Marketing /
// Help handlers. It returns the domain decision and lets the frontend
// open the matching existing panel (preserving each panel's per-domain
// UX). See scope.md §4.3 and implementation.md §1 Q1.

import { Request, Response } from "express";
import { logger } from "../../../utils/logger";
import { SpendCapEnforcer } from "../services/SpendCapEnforcer";
import { VoiceRouter, voiceRouter } from "../services/voice/VoiceRouter";
import {
  VoiceDispatchAuditLogger,
  voiceDispatchAuditLogger,
  DispatchTranscriptSource,
} from "../services/VoiceDispatchAuditLogger";

const MAX_TRANSCRIPT_CHARS = 2000;
const MAX_SESSION_ID_CHARS = 255;

export interface VoiceDispatchDeps {
  router?: VoiceRouter;
  spendCap?: SpendCapEnforcer;
  auditLogger?: VoiceDispatchAuditLogger;
}

export interface VoiceDispatchResponseData {
  domain: "insights" | "marketing" | "help" | "out_of_scope";
  transcript: string;
  sessionId: string;
  /** Reserved for Phase 5.5 — always false in the global-voice path. */
  routerSkipped: false;
}

interface ParsedRequest {
  transcript: string;
  sessionId: string;
  source: DispatchTranscriptSource;
}

export function createVoiceDispatchController(deps: VoiceDispatchDeps = {}) {
  const router = deps.router ?? voiceRouter;
  const spendCap = deps.spendCap ?? new SpendCapEnforcer();
  const auditLogger = deps.auditLogger ?? voiceDispatchAuditLogger;

  return async (req: Request, res: Response): Promise<void> => {
    const shopId = (req as any).user?.shopId;
    if (!shopId) {
      res.status(401).json({ success: false, error: "Shop ID required" });
      return;
    }

    const parsed = parseRequest(req.body);
    if (parsed.ok === false) {
      res.status(400).json({ success: false, error: parsed.error });
      return;
    }
    const { transcript, sessionId, source } = parsed.value;

    // 1. Spend-cap pre-flight (same monthly budget as the other AI surfaces).
    const spendCheck = await spendCap.canSpend(shopId);
    if (!spendCheck.allowed) {
      res.status(429).json({
        success: false,
        error:
          "AI budget for this month is exhausted. Try again next month or contact RepairCoin support.",
        details: {
          currentSpendUsd: spendCheck.currentSpendUsd,
          monthlyBudgetUsd: spendCheck.monthlyBudgetUsd,
          blockReason: spendCheck.blockReason,
        },
      });
      return;
    }

    // 2. Router call. On error, the catch path still writes the audit
    // row with router_decision='error' and the client sees a 503.
    let classification: Awaited<ReturnType<VoiceRouter["classifyDomain"]>> | null = null;
    let errorMessage: string | null = null;
    try {
      classification = await router.classifyDomain(transcript);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      logger.error("VoiceDispatchController: router call failed", {
        shopId,
        sessionId,
        transcriptLen: transcript.length,
        error: errorMessage,
      });
    }

    // 3. Audit row (always — success or failure).
    await auditLogger.log({
      shopId,
      sessionId,
      transcript,
      transcriptSource: source,
      routerDecision: classification?.domain ?? "error",
      routerInputTokens: classification?.inputTokens ?? 0,
      routerOutputTokens: classification?.outputTokens ?? 0,
      routerCostUsd: classification?.costUsd ?? 0,
      latencyMs: classification?.latencyMs ?? 0,
      errorMessage:
        classification?.parseFailed && classification
          ? `Unparseable router response: ${classification.rawText.slice(0, 200)}`
          : errorMessage,
    });

    if (classification === null) {
      res.status(503).json({
        success: false,
        error:
          "Voice routing is temporarily unavailable. Please try opening the Insights, Marketing, or Help panel manually.",
      });
      return;
    }

    // 4. Spend recorded post-success.
    await spendCap.recordSpend(shopId, classification.costUsd);

    const data: VoiceDispatchResponseData = {
      domain: classification.domain,
      transcript,
      sessionId,
      routerSkipped: false,
    };
    res.json({ success: true, data });
  };
}

function parseRequest(
  body: unknown
):
  | { ok: true; value: ParsedRequest }
  | { ok: false; error: string } {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Request body must include transcript and sessionId" };
  }
  const b = body as Record<string, unknown>;

  const transcript = typeof b.transcript === "string" ? b.transcript.trim() : "";
  if (transcript.length === 0) {
    return { ok: false, error: "transcript is required" };
  }
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return {
      ok: false,
      error: `transcript exceeds ${MAX_TRANSCRIPT_CHARS} characters`,
    };
  }

  const sessionId = typeof b.sessionId === "string" ? b.sessionId.trim() : "";
  if (sessionId.length === 0) {
    return { ok: false, error: "sessionId is required" };
  }
  if (sessionId.length > MAX_SESSION_ID_CHARS) {
    return { ok: false, error: "sessionId exceeds 255 characters" };
  }

  const rawSource = typeof b.source === "string" ? b.source : "voice";
  const source: DispatchTranscriptSource =
    rawSource === "inline_mic" ? "inline_mic" : "voice";

  return { ok: true, value: { transcript, sessionId, source } };
}

export const dispatchVoice = createVoiceDispatchController();
