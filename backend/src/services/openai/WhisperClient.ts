// backend/src/services/openai/WhisperClient.ts
//
// Thin client for OpenAI's Whisper STT API. Single model (`whisper-1`)
// hardcoded — Whisper isn't a family with picker options, see
// docs/tasks/strategy/voice-ai-dispatcher/implementation.md §3 / §1 Q2.
//
// Uses Node 18+ built-in `fetch` + `FormData` + `Blob`. No `openai` SDK,
// no `node-fetch`, no `form-data` package — keeping the dependency
// surface small for a one-endpoint integration.
//
// Cost calculation per the Whisper pricing page:
//   $0.006 per minute → $0.0001 per second → durationMs * 0.0000001
//
// Secret hygiene: reads OPENAI_API_KEY from process.env at call time
// (not at module load). Throws a clear error if missing so the caller
// can return a 500 with a sensible message instead of crashing.
// The key is never logged, never echoed in errors.

import { logger } from "../../utils/logger";

const WHISPER_MODEL = "whisper-1";
const WHISPER_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";
const COST_PER_MINUTE_USD = 0.006;

export interface TranscribeResult {
  transcript: string;
  costUsd: number;
  latencyMs: number;
}

export class WhisperClient {
  /**
   * Transcribe an audio buffer via OpenAI Whisper.
   *
   * @param buffer       Raw audio bytes (typically WebM/Opus from MediaRecorder).
   * @param mimeType     MIME type of the audio (e.g. 'audio/webm').
   * @param durationMs   Audio duration in ms — used for cost calculation only.
   *                     OpenAI bills based on real duration on their side too,
   *                     but we compute our own number for the audit log.
   * @param language     Optional ISO 639-1 hint (e.g. 'en'). Whisper is
   *                     multilingual; passing a hint when known reduces
   *                     mis-detection on short clips.
   *
   * @returns transcript text + computed cost + measured latency.
   * @throws  Error with a sanitized message on any failure path. The
   *          OPENAI_API_KEY is never included in the error.
   */
  async transcribe(
    buffer: Buffer,
    mimeType: string,
    durationMs: number,
    language?: string
  ): Promise<TranscribeResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it to backend/.env (never commit)."
      );
    }

    const form = new FormData();
    // Built-in Blob accepts BufferSource; cast to Uint8Array for compatibility.
    form.append(
      "file",
      new Blob([new Uint8Array(buffer)], { type: mimeType }),
      // Filename hint helps the API pick the right decoder.
      this.guessFilename(mimeType)
    );
    form.append("model", WHISPER_MODEL);
    if (language) form.append("language", language);

    const startedAt = Date.now();
    let res: Response;
    try {
      res = await fetch(WHISPER_ENDPOINT, {
        method: "POST",
        headers: {
          // Note: do NOT set Content-Type — fetch + FormData will set
          // the correct multipart boundary automatically. Setting it
          // manually breaks the boundary.
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
      });
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      logger.error("WhisperClient network error", {
        latencyMs,
        message: err instanceof Error ? err.message : String(err),
      });
      throw new Error("Whisper request failed — network error");
    }

    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      // Read the body once for diagnostics; safely truncate so we never
      // surface secrets if OpenAI ever echoes our request headers.
      const body = await res.text().catch(() => "<unreadable>");
      logger.error("WhisperClient non-OK response", {
        status: res.status,
        latencyMs,
        body: body.slice(0, 500),
      });
      throw new Error(
        `Whisper API returned status ${res.status}`
      );
    }

    const payload = (await res.json()) as { text?: string };
    if (typeof payload.text !== "string") {
      logger.error("WhisperClient missing text field", { payload });
      throw new Error("Whisper API returned no transcript text");
    }

    const costUsd = (durationMs / 60000) * COST_PER_MINUTE_USD;

    return {
      transcript: payload.text,
      costUsd: Number(costUsd.toFixed(6)),
      latencyMs,
    };
  }

  /**
   * Pick a filename for the multipart form. OpenAI uses the extension
   * to choose a decoder when MIME type alone is ambiguous.
   */
  private guessFilename(mimeType: string): string {
    if (mimeType.includes("webm")) return "audio.webm";
    if (mimeType.includes("ogg")) return "audio.ogg";
    if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "audio.m4a";
    if (mimeType.includes("wav")) return "audio.wav";
    if (mimeType.includes("mp3") || mimeType.includes("mpeg")) return "audio.mp3";
    return "audio.bin";
  }
}

export const whisperClient = new WhisperClient();
