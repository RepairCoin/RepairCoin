// backend/src/domains/AIAgentDomain/controllers/VoiceTranscribeController.ts
//
// POST /api/ai/voice/transcribe — multipart/form-data upload, returns
// { transcript, durationMs, sessionId }.
//
// Multipart fields:
//   - audio       (file)   — required. The audio blob (webm/ogg/mp4/wav/mp3).
//   - durationMs  (string) — required. Audio duration as reported by the
//                            frontend MediaRecorder. Used for spend-cap
//                            cost estimation and audit cost calculation.
//   - sessionId   (string) — required. Client-generated id grouping multi-
//                            turn voice rows from one voice-pill / inline-
//                            mic session.
//   - language    (string) — optional. ISO 639-1 language hint (e.g. 'en').
//
// Flow:
//   1. Validate (auth, file present, parseable durationMs, sessionId).
//   2. SpendCapEnforcer.canSpend(shopId) — 429 if budget exhausted.
//      No estimated-cost parameter — the enforcer does a binary
//      "any budget left" check like every other AI surface.
//   3. WhisperClient.transcribe(buffer, mimetype, durationMs).
//   4. Always write the audit row (success OR failure).
//   5. recordSpend on success.
//   6. Return { transcript, durationMs, sessionId }.
//
// Shop-scoped via JWT (req.user.shopId). Audio buffer is forwarded to
// OpenAI immediately, never persisted on our infrastructure.

import { Request, Response } from "express";
import { logger } from "../../../utils/logger";
import { WhisperClient, whisperClient } from "../../../services/openai/WhisperClient";
import { SpendCapEnforcer } from "../services/SpendCapEnforcer";
import { VoiceAuditLogger, voiceAuditLogger } from "../services/VoiceAuditLogger";

// Bounds on the input fields. The file-size cap lives in
// audioUploadMiddleware (multer); these are for the form metadata.
const MAX_SESSION_ID_CHARS = 255;
const MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes — also matches 5 MB audio cap
const MAX_LANGUAGE_CHARS = 10;

export interface VoiceTranscribeDeps {
  whisper?: WhisperClient;
  spendCap?: SpendCapEnforcer;
  auditLogger?: VoiceAuditLogger;
}

export interface VoiceTranscribeResponseData {
  transcript: string;
  durationMs: number;
  sessionId: string;
}

interface ParsedRequest {
  durationMs: number;
  sessionId: string;
  language: string | undefined;
}

/**
 * Factory exists so tests can inject mocks via `deps`. The default
 * singleton is created lazily once at module load.
 */
export function createVoiceTranscribeController(
  deps: VoiceTranscribeDeps = {}
) {
  const whisper = deps.whisper ?? whisperClient;
  const spendCap = deps.spendCap ?? new SpendCapEnforcer();
  const auditLogger = deps.auditLogger ?? voiceAuditLogger;

  return async (req: Request, res: Response): Promise<void> => {
    const shopId = (req as any).user?.shopId;
    if (!shopId) {
      res.status(401).json({ success: false, error: "Shop ID required" });
      return;
    }

    // multer attaches the file to req.file when the route used
    // audioUploadMiddleware.single('audio').
    const file = (req as any).file as
      | { buffer: Buffer; mimetype: string; size: number }
      | undefined;
    if (!file) {
      res.status(400).json({
        success: false,
        error: "Missing 'audio' file in multipart form",
      });
      return;
    }

    const parsed = parseFormFields(req.body);
    if (parsed.ok === false) {
      res.status(400).json({ success: false, error: parsed.error });
      return;
    }
    const { durationMs, sessionId, language } = parsed.value;

    // 1. Spend-cap pre-flight (shared budget with the rest of AI).
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

    // 2. Whisper call. On error, the catch path still writes the audit
    // row so cost (0) and latency are captured.
    let transcript: string | null = null;
    let costUsd = 0;
    let latencyMs = 0;
    let errorMessage: string | null = null;

    try {
      const result = await whisper.transcribe(
        file.buffer,
        file.mimetype,
        durationMs,
        language
      );
      transcript = result.transcript;
      costUsd = result.costUsd;
      latencyMs = result.latencyMs;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      logger.error("VoiceTranscribeController: Whisper call failed", {
        shopId,
        sessionId,
        durationMs,
        audioSizeBytes: file.size,
        error: errorMessage,
      });
    }

    // 3. Audit row (always — success or failure).
    await auditLogger.log({
      shopId,
      sessionId,
      durationMs,
      audioSizeBytes: file.size,
      costUsd,
      transcript,
      latencyMs,
      errorMessage,
    });

    // 4. If the Whisper call failed, surface a sanitized 503 AFTER the
    // audit row was written. Never echo back errorMessage as-is — that
    // could leak internal details.
    if (transcript === null) {
      res.status(503).json({
        success: false,
        error:
          "Voice transcription is temporarily unavailable. Please try again or type your question.",
      });
      return;
    }

    // 5. Spend recorded post-success only (failed calls don't bill).
    await spendCap.recordSpend(shopId, costUsd);

    const data: VoiceTranscribeResponseData = {
      transcript,
      durationMs,
      sessionId,
    };
    res.json({ success: true, data });
  };
}

/**
 * Parse + validate the non-file multipart fields.
 *
 * multer puts the form fields on req.body as strings (because
 * multipart/form-data is text-encoded). We coerce + validate here.
 */
function parseFormFields(
  body: unknown
):
  | { ok: true; value: ParsedRequest }
  | { ok: false; error: string } {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Form body must include durationMs and sessionId" };
  }
  const b = body as Record<string, unknown>;

  const rawDuration = b.durationMs;
  const durationMs =
    typeof rawDuration === "string"
      ? parseInt(rawDuration, 10)
      : typeof rawDuration === "number"
        ? rawDuration
        : NaN;
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return { ok: false, error: "durationMs must be a positive integer (milliseconds)" };
  }
  if (durationMs > MAX_DURATION_MS) {
    return {
      ok: false,
      error: `durationMs exceeds maximum (${MAX_DURATION_MS}ms / 5 minutes)`,
    };
  }

  const sessionId = typeof b.sessionId === "string" ? b.sessionId.trim() : "";
  if (sessionId.length === 0) {
    return { ok: false, error: "sessionId is required" };
  }
  if (sessionId.length > MAX_SESSION_ID_CHARS) {
    return { ok: false, error: "sessionId exceeds 255 characters" };
  }

  let language: string | undefined;
  if (typeof b.language === "string" && b.language.trim().length > 0) {
    const lang = b.language.trim();
    if (lang.length > MAX_LANGUAGE_CHARS) {
      return { ok: false, error: "language hint must be <= 10 characters" };
    }
    language = lang;
  }

  return { ok: true, value: { durationMs, sessionId, language } };
}

// Lazy-default singleton — wired into routes.ts.
export const transcribeVoice = createVoiceTranscribeController();
