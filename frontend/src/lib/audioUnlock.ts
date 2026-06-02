// frontend/src/lib/audioUnlock.ts
//
// Unlock HTML audio playback for the session from within a user gesture.
//
// Why: the assistant's spoken greeting (and TTS replies) play via a DEFERRED
// `audio.play()` that fires ~1s after the tap, once the TTS fetch returns —
// i.e. outside the click's call stack. On a fresh load, before any
// getUserMedia/mic grant, the browser's autoplay policy blocks that first
// deferred playback (greeting text shows, but no voice). Playing a tiny SILENT
// clip synchronously inside the tap handler blesses audio for the session, so
// the later deferred play() is allowed.
//
// Call this from the mic/voice onClick handlers (the gestures that lead to TTS).

"use client";

let unlocked = false;
let cachedSilentUri: string | null = null;
// A SINGLE audio element, primed inside the user gesture. Reusing this exact
// element for the first post-gesture playback (the greeting) is far more
// reliable than playing a throwaway element here and a fresh `new Audio()`
// later — some browsers bless the element, not just the document.
let primedAudio: HTMLAudioElement | null = null;

/** Build a ~0.05s silent mono WAV as a base64 data URI (guaranteed-valid,
 *  no network, no object-URL leak). Cached after first build. */
function silentWavDataUri(): string {
  if (cachedSilentUri) return cachedSilentUri;
  const sampleRate = 8000;
  const numSamples = 400; // ~0.05s
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits/sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  // Sample bytes are already zero = silence.
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  cachedSilentUri = `data:audio/wav;base64,${btoa(binary)}`;
  return cachedSilentUri;
}

/**
 * Prime audio playback. MUST be called from inside a user-gesture handler.
 * Idempotent (only the first successful call does work) and fully best-effort —
 * any failure is swallowed and it'll simply retry on the next gesture.
 */
export function unlockAudioPlayback(): void {
  if (typeof window === "undefined") return;
  if (!primedAudio) primedAudio = new Audio();
  if (unlocked) return;
  try {
    const audio = primedAudio;
    audio.src = silentWavDataUri();
    // Silent but UNMUTED — muted playback is always allowed and would NOT
    // count as user-initiated audio for the autoplay unlock.
    audio.volume = 0;
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        unlocked = true;
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {
          /* ignore */
        }
      }).catch(() => {
        /* gesture too weak / still blocked — retry on next tap */
      });
    } else {
      unlocked = true;
    }
  } catch {
    /* ignore — TTS will simply fall back to text */
  }
}

/**
 * The audio element that was primed inside the user gesture. Reuse it for the
 * first post-gesture playback (the spoken greeting) so it isn't blocked by the
 * autoplay policy. Returns null only on SSR. The caller sets `.src` + `.volume`
 * and plays it.
 */
export function getPrimedAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!primedAudio) primedAudio = new Audio();
  return primedAudio;
}
