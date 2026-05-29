// backend/src/middleware/audioUpload.ts
//
// Multer config for the Voice AI Dispatcher STT endpoint. Voice-specific
// because the existing `fileUpload.ts` middleware filters MIME types for
// spreadsheets (.xlsx/.xls/.csv) — not the right shape for audio uploads.
//
// 5 MB hard cap on the upload size. At Whisper's ~16kHz Opus, that's
// well over a minute of audio — comfortably above the v1 expected
// utterance length (~5-30 seconds). See
// docs/tasks/strategy/voice-ai-dispatcher/implementation.md §4 Phase 1.
//
// MIME filter accepts the common browser MediaRecorder outputs:
//   - audio/webm (Chrome / Firefox default)
//   - audio/ogg  (Firefox alternate)
//   - audio/mp4 / audio/m4a (iOS Safari)
//   - audio/wav, audio/mpeg/mp3 (older browsers, less common)
//
// Memory storage (not disk) — the buffer is forwarded to OpenAI
// immediately, never persisted on our infrastructure.

import multer from "multer";
import type { FileFilterCallback } from "multer";

const MAX_AUDIO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_AUDIO_MIME_PREFIXES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
];

const audioFileFilter = (
  _req: unknown,
  file: { mimetype: string },
  cb: FileFilterCallback
) => {
  const mime = (file.mimetype || "").toLowerCase();
  const allowed = ALLOWED_AUDIO_MIME_PREFIXES.some((prefix) =>
    mime.startsWith(prefix)
  );
  if (!allowed) {
    return cb(
      new Error(
        `Unsupported audio MIME type: ${file.mimetype || "<missing>"}. ` +
          `Expected one of: ${ALLOWED_AUDIO_MIME_PREFIXES.join(", ")}.`
      )
    );
  }
  cb(null, true);
};

export const audioUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AUDIO_SIZE_BYTES,
    files: 1,
    fields: 5,
    parts: 6,
  },
  fileFilter: audioFileFilter,
});
