// backend/src/services/openai/OpenAITtsClient.ts
//
// Thin client for OpenAI's text-to-speech API (voice-OUT — the "Siri" half).
// Sibling to WhisperClient (voice-IN). Reuses the SAME OPENAI_API_KEY, so no
// new secret / vendor / spend surface. See
//   docs/tasks/strategy/unified-assistant/implementation.md §3 (Phase 3)
//   docs/tasks/strategy/voice-ai-dispatcher/unified-assistant-vision.md §5a
//
// Model `tts-1` (the fast, cheap tier — good enough for turn-based replies;
// `tts-1-hd` is higher quality but slower/pricier). A custom branded voice
// (ElevenLabs) is deferred unless "name + voice the bot" becomes committed.
//
// Pricing: tts-1 is $15 / 1M input chars → chars * 0.000015.
//
// Secret hygiene mirrors WhisperClient: reads OPENAI_API_KEY at call time,
// never logs it. Uses Node 18+ built-in fetch; no `openai` SDK.

import { logger } from "../../utils/logger";

const TTS_MODEL = "tts-1";
const TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const COST_PER_MILLION_CHARS_USD = 15;
// OpenAI hard-caps TTS input at 4096 chars; we slice to be safe.
const MAX_INPUT_CHARS = 4096;

// The six built-in OpenAI voices. `nova` is warm/friendly — a sensible default
// for a shop assistant; overridable per-request (and later per-shop branding).
export const TTS_VOICES = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
] as const;
export type TtsVoice = (typeof TTS_VOICES)[number];
export const DEFAULT_TTS_VOICE: TtsVoice = "nova";

export interface SynthesizeResult {
  audio: Buffer;
  mimeType: "audio/mpeg";
  charCount: number;
  costUsd: number;
  latencyMs: number;
}

export class OpenAITtsClient {
  /**
   * Synthesize `text` to spoken MP3 audio.
   *
   * @param text   The assistant reply to speak. Sliced to 4096 chars.
   * @param voice  One of TTS_VOICES. Defaults to `nova`.
   * @returns      audio buffer (mp3) + char count + computed cost + latency.
   * @throws       Error with a sanitized message; OPENAI_API_KEY never leaks.
   */
  async synthesize(
    text: string,
    voice: TtsVoice = DEFAULT_TTS_VOICE
  ): Promise<SynthesizeResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it to backend/.env (never commit)."
      );
    }

    const input = text.slice(0, MAX_INPUT_CHARS);
    const startedAt = Date.now();

    let res: Response;
    try {
      res = await fetch(TTS_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: TTS_MODEL,
          input,
          voice,
          response_format: "mp3",
        }),
      });
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      logger.error("OpenAITtsClient network error", {
        latencyMs,
        message: err instanceof Error ? err.message : String(err),
      });
      throw new Error("TTS request failed — network error");
    }

    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      const body = await res.text().catch(() => "<unreadable>");
      logger.error("OpenAITtsClient non-OK response", {
        status: res.status,
        latencyMs,
        body: body.slice(0, 500),
      });
      throw new Error(`OpenAI TTS API returned status ${res.status}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const audio = Buffer.from(arrayBuf);
    if (audio.length === 0) {
      throw new Error("OpenAI TTS API returned empty audio");
    }

    const costUsd = Number(
      ((input.length / 1_000_000) * COST_PER_MILLION_CHARS_USD).toFixed(6)
    );

    return {
      audio,
      mimeType: "audio/mpeg",
      charCount: input.length,
      costUsd,
      latencyMs,
    };
  }
}

export const openAITtsClient = new OpenAITtsClient();
