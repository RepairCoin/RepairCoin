// backend/src/domains/AIAgentDomain/controllers/VoiceSpeakController.ts
//
// POST /api/ai/voice/speak — text → spoken MP3 audio (the voice-OUT / "Siri"
// half). Sibling to VoiceTranscribeController (voice-IN). Unified Assistant
// Phase 3.
//
// Request body (JSON): { text: string, voice?: TtsVoice }
// Response: on success, raw audio bytes with Content-Type audio/mpeg.
//           on error, a JSON { success:false, error } envelope.
//
// The asymmetric response (binary on success, JSON on error) is intentional —
// the browser plays the audio Blob directly; the frontend checks the
// Content-Type / status to tell success from a 4xx/5xx JSON error.
//
// Shop-scoped via JWT. Spend flows through the shared SpendCapEnforcer (same
// monthly budget as every other AI surface). No dedicated audit table — TTS
// cost is tiny and recorded via the spend cap + a logger line.

import { Request, Response } from "express";
import { logger } from "../../../utils/logger";
import {
  OpenAITtsClient,
  openAITtsClient,
  TTS_VOICES,
  TtsVoice,
  DEFAULT_TTS_VOICE,
} from "../../../services/openai/OpenAITtsClient";
import { SpendCapEnforcer } from "../services/SpendCapEnforcer";

const MAX_TEXT_CHARS = 4096; // OpenAI TTS input ceiling

export interface VoiceSpeakDeps {
  tts?: OpenAITtsClient;
  spendCap?: SpendCapEnforcer;
}

export function createVoiceSpeakController(deps: VoiceSpeakDeps = {}) {
  const tts = deps.tts ?? openAITtsClient;
  const spendCap = deps.spendCap ?? new SpendCapEnforcer();

  return async (req: Request, res: Response): Promise<void> => {
    const shopId = (req as any).user?.shopId;
    if (!shopId) {
      res.status(401).json({ success: false, error: "Shop ID required" });
      return;
    }

    const body = (req.body ?? {}) as { text?: unknown; voice?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length === 0) {
      res.status(400).json({ success: false, error: "text is required" });
      return;
    }
    if (text.length > MAX_TEXT_CHARS) {
      res.status(400).json({
        success: false,
        error: `text exceeds ${MAX_TEXT_CHARS} characters`,
      });
      return;
    }
    const voice: TtsVoice =
      typeof body.voice === "string" &&
      (TTS_VOICES as readonly string[]).includes(body.voice)
        ? (body.voice as TtsVoice)
        : DEFAULT_TTS_VOICE;

    // Spend-cap pre-flight (shared budget with the rest of AI).
    const spendCheck = await spendCap.canSpend(shopId);
    if (!spendCheck.allowed) {
      res.status(429).json({
        success: false,
        error:
          "AI budget for this month is exhausted. Try again next month or contact RepairCoin support.",
      });
      return;
    }

    try {
      const result = await tts.synthesize(text, voice);
      await spendCap.recordSpend(shopId, result.costUsd);
      logger.info("VoiceSpeak", {
        shopId,
        chars: result.charCount,
        voice,
        costUsd: result.costUsd,
        latencyMs: result.latencyMs,
      });
      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Cache-Control", "no-store");
      res.send(result.audio);
    } catch (err) {
      logger.error("VoiceSpeakController: TTS failed", err);
      res.status(503).json({
        success: false,
        error:
          "Voice synthesis is temporarily unavailable. Please try again or read the reply.",
      });
    }
  };
}

let _default: ReturnType<typeof createVoiceSpeakController> | null = null;
export function speakVoice(req: Request, res: Response): Promise<void> {
  if (!_default) _default = createVoiceSpeakController();
  return _default(req, res);
}
