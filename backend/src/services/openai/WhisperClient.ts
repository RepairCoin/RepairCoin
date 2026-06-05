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

// ----- Hallucination gating thresholds -----
//
// Whisper fabricates plausible text when handed silence/noise. The verbose_json
// response carries per-segment confidence signals; these thresholds reject the
// fabricated runs. Tuned conservatively to avoid dropping real-but-quiet speech
// (the no-speech check requires BOTH a high no-speech prob AND low logprob).
const NO_SPEECH_PROB_THRESHOLD = 0.6; // ≥ this avg = likely no real speech
const AVG_LOGPROB_THRESHOLD = -0.5; // ≤ this avg = low-confidence decode
const COMPRESSION_RATIO_THRESHOLD = 2.4; // ≥ this = repetitive hallucination

// Known Whisper caption-artifact hallucinations. Whisper was trained on
// YouTube subtitles, so on silence/noise it confidently emits these — which
// means the probability signals (no_speech_prob / avg_logprob) DON'T flag them
// (it's "sure" it heard "Thanks for watching"). We catch them by content.
// Stored normalized (lowercase, punctuation stripped). None is a plausible
// business command, and we only reject when the WHOLE transcript is artifacts.
const HALLUCINATION_PHRASES = new Set<string>([
  "thanks for watching",
  "thank you for watching",
  "thanks for watching everyone",
  "thanks for watching this video",
  "thanks for watching and i'll see you in the next video",
  "please subscribe",
  "like and subscribe",
  "please like and subscribe",
  "don't forget to subscribe",
  "subscribe to my channel",
  "thank you",
  "thank you very much",
  "thank you so much",
  "thank you for your time",
  "you",
  "bye",
  "bye bye",
  "goodbye",
  "see you next time",
  "i'll see you next time",
  "see you in the next video",
  "music",
  "silence",
  "blank audio",
  "applause",
  "amara org",
  "subtitles by the amara org community",
]);

/** Normalize for artifact matching: lowercase, unify apostrophes, drop other
 *  punctuation/symbols, collapse whitespace. "[Music]" → "music",
 *  "Thanks for watching!" → "thanks for watching". */
function normalizeForArtifact(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the transcript is ENTIRELY known caption artifacts — either the
 *  whole string matches one, or every sentence-like chunk does (catches combos
 *  like "Thank you. Thanks for watching."). A real message with even one
 *  genuine sentence won't match, so legit commands are never dropped. */
function isHallucinationPhrase(raw: string): boolean {
  const whole = normalizeForArtifact(raw);
  if (whole.length === 0) return true;
  if (HALLUCINATION_PHRASES.has(whole)) return true;
  const parts = raw
    .split(/[.!?\n]+/)
    .map(normalizeForArtifact)
    .filter((p) => p.length > 0);
  return parts.length > 0 && parts.every((p) => HALLUCINATION_PHRASES.has(p));
}

export interface TranscribeResult {
  transcript: string;
  costUsd: number;
  latencyMs: number;
}

/** Subset of Whisper's verbose_json response we read for confidence gating. */
interface WhisperSegment {
  no_speech_prob?: number;
  avg_logprob?: number;
  compression_ratio?: number;
}
interface WhisperVerboseResponse {
  text?: string;
  segments?: WhisperSegment[];
  duration?: number;
  language?: string;
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
    // verbose_json adds per-segment no_speech_prob / avg_logprob /
    // compression_ratio so we can detect and drop hallucinated transcripts
    // on silence/noise. temperature 0 = greedy decode, which itself reduces
    // Whisper's tendency to fabricate.
    form.append("response_format", "verbose_json");
    form.append("temperature", "0");

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

    const payload = (await res.json()) as WhisperVerboseResponse;
    if (typeof payload.text !== "string") {
      logger.error("WhisperClient missing text field", { payload });
      throw new Error("Whisper API returned no transcript text");
    }

    // Gate hallucinated transcripts (silence / background noise). On reject we
    // return an EMPTY transcript — the frontend already treats that as "didn't
    // catch that", so no garbage reaches the assistant. We still bill the call.
    let transcript = payload.text;
    const gate = this.assessConfidence(payload);
    if (gate.rejected) {
      logger.info("WhisperClient: rejected low-confidence transcription", {
        reason: gate.reason,
        avgNoSpeechProb: Number(gate.avgNoSpeechProb.toFixed(3)),
        avgLogprob: Number(gate.avgLogprob.toFixed(3)),
        maxCompressionRatio: Number(gate.maxCompressionRatio.toFixed(3)),
        // Truncated preview of the discarded text for debugging (shop's own
        // audio; never anything more sensitive than what they spoke).
        textPreview: transcript.slice(0, 80),
      });
      transcript = "";
    }

    const costUsd = (durationMs / 60000) * COST_PER_MINUTE_USD;

    return {
      transcript,
      costUsd: Number(costUsd.toFixed(6)),
      latencyMs,
    };
  }

  /**
   * Inspect Whisper's per-segment confidence signals to decide whether the
   * transcript is a hallucination on silence/noise. Conservative by design:
   * the no-speech path needs BOTH a high average no_speech_prob AND a low
   * average logprob so genuine quiet speech isn't dropped; the repetition path
   * catches the looping fabrications ("…weekend. … weekend.").
   */
  private assessConfidence(payload: WhisperVerboseResponse): {
    rejected: boolean;
    reason: string;
    avgNoSpeechProb: number;
    avgLogprob: number;
    maxCompressionRatio: number;
  } {
    const text = (payload.text ?? "").trim();
    const segments = payload.segments ?? [];
    const empty = {
      rejected: false,
      reason: "",
      avgNoSpeechProb: 0,
      avgLogprob: 0,
      maxCompressionRatio: 0,
    };
    if (text.length === 0) return empty; // nothing to judge

    // Layer 2b — known caption-artifact hallucination ("Thanks for watching!").
    // Checked BEFORE the probability gates because these come back HIGH
    // confidence, so no_speech_prob / avg_logprob won't catch them.
    if (isHallucinationPhrase(text)) {
      return { ...empty, rejected: true, reason: "artifact" };
    }

    // No segments to judge the probability signals — let it through; an
    // empty-text result is already handled as "didn't catch that" downstream.
    if (segments.length === 0) return empty;

    const nums = (arr: Array<number | undefined>): number[] =>
      arr.filter((n): n is number => typeof n === "number");
    const ns = nums(segments.map((s) => s.no_speech_prob));
    const lp = nums(segments.map((s) => s.avg_logprob));
    const cr = nums(segments.map((s) => s.compression_ratio));

    const avg = (a: number[]): number =>
      a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    const avgNoSpeechProb = avg(ns);
    const avgLogprob = avg(lp);
    const maxCompressionRatio = cr.length ? Math.max(...cr) : 0;

    let rejected = false;
    let reason = "";
    if (
      avgNoSpeechProb >= NO_SPEECH_PROB_THRESHOLD &&
      avgLogprob <= AVG_LOGPROB_THRESHOLD
    ) {
      rejected = true;
      reason = "no_speech";
    } else if (maxCompressionRatio >= COMPRESSION_RATIO_THRESHOLD) {
      rejected = true;
      reason = "repetition";
    }

    return { rejected, reason, avgNoSpeechProb, avgLogprob, maxCompressionRatio };
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
