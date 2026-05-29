// frontend/src/services/api/voice.ts
//
// Shop-side Voice AI Dispatcher — Phase 1 backend.
// Backed by POST /api/ai/voice/transcribe.
//
// Multipart upload: audio file + durationMs + sessionId + optional language.
// Returns transcript text + the durationMs the request was made with + the
// sessionId. Per the existing `client.ts` interceptor (line 119-121), the
// resolved response IS the backend body — read `response.data.<field>` to
// reach the inner payload, NOT `response.data.data.<field>`.

import apiClient from "./client";

export interface TranscribeResponse {
  transcript: string;
  durationMs: number;
  sessionId: string;
}

/**
 * POST audio to the STT endpoint. Auth comes from the httpOnly cookie
 * (withCredentials is already set on `apiClient`); no Authorization
 * header to add manually.
 *
 * 401 → session expired (interceptor handles refresh automatically).
 * 400 → validation failure (e.g. wrong MIME type, file too big, bad
 *       durationMs). The error message tells you which.
 * 413 → file too large (5 MB cap).
 * 429 → monthly AI budget exhausted for this shop.
 * 503 → Whisper temporarily unavailable; retry or fall back to typing.
 */
export const transcribeAudio = async (
  audio: Blob,
  durationMs: number,
  sessionId: string,
  language?: string
): Promise<TranscribeResponse> => {
  const form = new FormData();
  form.append("audio", audio, "recording.webm");
  form.append("durationMs", String(durationMs));
  form.append("sessionId", sessionId);
  if (language) form.append("language", language);

  // IMPORTANT: do NOT set Content-Type manually. The browser sets the
  // multipart boundary automatically; overriding the header breaks the
  // upload. The default axios JSON Content-Type from client.ts is
  // overridden per-request by axios when the body is FormData.
  const response = await apiClient.post("/ai/voice/transcribe", form, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 60000, // 60s — STT can take 2-4s for short clips, longer for max-duration uploads
  });

  return response.data.data || response.data;
};
