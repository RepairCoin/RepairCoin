// frontend/src/hooks/useVoiceRecorder.ts
//
// Shared voice-capture hook for the Voice AI Dispatcher (Phase 2).
//
// State machine:
//   IDLE → REQUESTING_PERMISSION → LISTENING → TRANSCRIBING → TRANSCRIBED
//                                          ↓
//                                       ERROR
//
// Behavior:
//   - start() requests mic permission (must be called from a user-gesture
//     handler — Safari iOS rejects async-later calls). Once granted,
//     records via MediaRecorder + auto-stops on 1.5s of silence.
//   - stop() flushes the current recording, POSTs to the STT endpoint,
//     and lands in TRANSCRIBED with the result.
//   - reset() returns to IDLE and clears transcript/error.
//
// Silence detection: AudioContext + AnalyserNode read time-domain
// samples in a requestAnimationFrame loop. If RMS stays below
// SILENCE_THRESHOLD for SILENCE_DURATION_MS, the hook auto-stops.
//
// Max-duration safety: hard cap at 5 minutes to match the backend's
// 5 MB / 5-min upload cap. Always-on safety guard against runaway
// recordings.
//
// Browser quirks:
//   - iOS Safari prefers audio/mp4; Chrome/Firefox default to audio/webm.
//     We probe via MediaRecorder.isTypeSupported and pick the first match.
//   - All MediaStream tracks are stop()'d on cleanup, otherwise the
//     browser's "recording" indicator stays on forever.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio, TranscribeResponse } from "@/services/api/voice";

export type VoiceRecorderState =
  | "idle"
  | "requesting_permission"
  | "listening"
  | "transcribing"
  | "transcribed"
  | "error";

interface UseVoiceRecorderOptions {
  /** Re-used across multi-turn voice flows in the same panel-open session. */
  sessionId: string;
  /** Optional language hint (ISO 639-1). */
  language?: string;
  /** Called when transcription succeeds. */
  onTranscribed?: (result: TranscribeResponse) => void;
}

interface UseVoiceRecorderReturn {
  state: VoiceRecorderState;
  /** Latest transcript (editable via setTranscript). */
  transcript: string;
  setTranscript: (next: string) => void;
  /**
   * Phase 5 — the STT output before any user edit. Frozen the moment
   * transcription completes; never mutates after that. Empty string
   * when no recording has completed yet. Components compare
   * `transcript !== originalTranscript` to detect an edit and pass
   * the original to /api/ai/dispatch for audit purposes.
   */
  originalTranscript: string;
  /** User-friendly error string when state === 'error'. */
  error: string | null;
  /** Duration of the most-recent recording. */
  durationMs: number;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
  /**
   * Live mic loudness in [0,1], sampled from the same AnalyserNode the
   * silence detector already runs. Stable identity — call it from an
   * animation loop (e.g. a listening visualization) to read the current
   * amplitude WITHOUT triggering React re-renders. Returns 0 when not
   * actively listening.
   */
  getAmplitude: () => number;
}

// ----- Silence detection tuning -----
//
// RMS threshold below which a frame counts as "silent". The 0-1 range of
// time-domain samples in a normalized Float32 buffer puts a quiet room
// around 0.005-0.01; the threshold here errs on the side of waiting (no
// false auto-stops while the user is thinking).
const SILENCE_THRESHOLD = 0.015;
// Quiet time AFTER the user has started speaking before we auto-stop (end of
// speech). Generous enough to ride through natural mid-sentence pauses.
const SILENCE_DURATION_MS = 2000;
// Hard cap — never record longer than this regardless of silence.
const MAX_RECORDING_MS = 5 * 60 * 1000;
// How long to wait for the user to START speaking after they tap the mic. The
// end-of-speech auto-stop does NOT fire until speech is detected (see
// SPEECH_PEAK_THRESHOLD) — so a slow start never cuts them off. If they never
// speak within this window, we stop and report "didn't catch any speech".
const PRE_SPEECH_TIMEOUT_MS = 10000;
// Peak RMS a recording must reach to count as containing real speech. Well
// above SILENCE_THRESHOLD. Doubles as the "speech has started" signal: the
// end-of-speech silence timer only arms once the level crosses this. If a
// recording never crosses it, we skip the Whisper call entirely (the user
// didn't actually speak — sending it would invite a hallucinated transcript).
const SPEECH_PEAK_THRESHOLD = 0.05;
// Transient "we didn't hear you" errors (no speech / no audio / too quiet)
// auto-dismiss after this long so the red banner doesn't linger until the panel
// closes. Hardware/permission errors are NOT auto-hidden — they carry an action
// (e.g. "click the lock icon"), so the user needs time to read them.
const TRANSIENT_ERROR_HIDE_MS = 4000;

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function pickSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const candidate of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return null;
}

export function useVoiceRecorder(
  opts: UseVoiceRecorderOptions
): UseVoiceRecorderReturn {
  const { sessionId, language, onTranscribed } = opts;

  const [state, setState] = useState<VoiceRecorderState>("idle");
  const [transcript, setTranscript] = useState("");
  // Frozen after STT completes — never re-set on edit. Phase 5 lets
  // the dispatch endpoint distinguish "user edited" from "verbatim STT".
  const [originalTranscript, setOriginalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const lastLoudAtRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");
  // Latest RMS (0-1-ish) from the silence-detection tick; read by the
  // listening visualization. Ref, not state — updated ~60fps.
  const currentRmsRef = useRef<number>(0);
  // Peak RMS across the current recording (speech-presence gate). Reset on
  // start. `measuredRef` tracks whether the analyser ran at all — if the
  // browser lacked AudioContext we can't measure, so we skip the gate.
  const maxRmsRef = useRef<number>(0);
  const measuredRef = useRef<boolean>(false);
  // Pending auto-dismiss timer for a transient error (see setTransientError).
  const errorHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearErrorHideTimer = useCallback(() => {
    if (errorHideTimerRef.current !== null) {
      clearTimeout(errorHideTimerRef.current);
      errorHideTimerRef.current = null;
    }
  }, []);

  /** Surface a recoverable "we didn't hear you" error, then auto-clear it back
   *  to idle after a few seconds so the banner doesn't stick around. Any new
   *  start()/reset() cancels the pending timer, so it only fires if the user
   *  left the error untouched. */
  const setTransientError = useCallback(
    (message: string) => {
      setState("error");
      setError(message);
      clearErrorHideTimer();
      errorHideTimerRef.current = setTimeout(() => {
        errorHideTimerRef.current = null;
        setError(null);
        // Only step back to idle if we're still showing this error — never
        // clobber a recording the user has since restarted.
        setState((s) => (s === "error" ? "idle" : s));
      }, TRANSIENT_ERROR_HIDE_MS);
    },
    [clearErrorHideTimer]
  );

  /** Aggressively clean up every resource so the mic indicator goes away. */
  const teardown = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Already stopped — ignore.
      }
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {
        // Closed under us — ignore.
      });
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    chunksRef.current = [];
    currentRmsRef.current = 0; // bars rest at zero once we stop listening
  }, []);

  useEffect(() => {
    // Cleanup on unmount — releases the mic even if the component is
    // navigated away from mid-recording, and cancels any pending error timer.
    return () => {
      teardown();
      clearErrorHideTimer();
    };
  }, [teardown, clearErrorHideTimer]);

  const stop = useCallback(() => {
    // Order matters: snapshot duration BEFORE we tear down the recorder,
    // since the recorder is what we read state from.
    const recorder = mediaRecorderRef.current;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // Already stopped — ignore. The `onstop` handler still ran.
      }
    }
    // streamRef + audioCtx live until the onstop handler fires so the
    // final chunk lands. They're released in the handler.
  }, []);

  const start = useCallback(async (): Promise<void> => {
    // Reset prior state so re-recording starts clean.
    clearErrorHideTimer();
    setTranscript("");
    setOriginalTranscript("");
    setError(null);
    setDurationMs(0);
    chunksRef.current = [];
    maxRmsRef.current = 0;
    measuredRef.current = false;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setError("This browser doesn't support voice recording.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setState("error");
      setError("This browser doesn't support audio recording.");
      return;
    }
    const mimeType = pickSupportedMimeType();
    if (!mimeType) {
      setState("error");
      setError(
        "This browser doesn't support any of the audio formats we accept."
      );
      return;
    }

    setState("requesting_permission");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Browser-side noise / echo handling — improves Whisper accuracy
          // and makes the silence detector more reliable.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      setState("error");
      if (name === "NotAllowedError" || name === "SecurityError") {
        // Covers both "user clicked Deny" and "browser blocked by
        // default policy" — UX-wise the recovery action is the same:
        // open the URL-bar permission popover.
        setError(
          "Mic access blocked. Click the lock icon in your browser's URL bar to allow the microphone, then try again."
        );
      } else if (name === "NotFoundError") {
        setError("No microphone detected on this device.");
      } else if (name === "NotReadableError") {
        // Mic is in use by another tab / app — common on shared laptops.
        setError(
          "The microphone is in use by another tab or app. Close it and try again."
        );
      } else {
        setError("Couldn't access the microphone. Try again.");
      }
      return;
    }

    streamRef.current = stream;
    mimeTypeRef.current = mimeType;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      teardown();
      setState("error");
      setError("Couldn't start the recorder.");
      return;
    }
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const finalDurationMs = Date.now() - startedAtRef.current;
      setDurationMs(finalDurationMs);

      // Snapshot the speech-presence signals BEFORE teardown (which clears
      // the live RMS). peakRms is the loudest frame seen this recording.
      const peakRms = maxRmsRef.current;
      const measured = measuredRef.current;

      // Pull the chunks NOW, then release the mic so the browser
      // indicator clears before the (potentially several-second) upload.
      const chunks = chunksRef.current;
      const audioBlob = new Blob(chunks, { type: mimeTypeRef.current });
      teardown();

      if (audioBlob.size === 0) {
        setTransientError("Didn't catch any audio. Try again.");
        return;
      }

      // Layer 1 guard: if the analyser ran and never heard real speech (only
      // silence / background noise), skip the Whisper call entirely. Sending it
      // would just invite a hallucinated transcript. Skipped when we couldn't
      // measure (no AudioContext) — the server-side gate still backstops that.
      if (measured && peakRms < SPEECH_PEAK_THRESHOLD) {
        setTransientError("Didn't catch any speech. Tap the mic and try again.");
        return;
      }

      setState("transcribing");
      try {
        const result = await transcribeAudio(
          audioBlob,
          finalDurationMs,
          sessionId,
          language
        );
        const safeTranscript = (result.transcript || "").trim();
        if (safeTranscript.length === 0) {
          setTransientError("Didn't catch that. Try speaking a bit louder.");
          return;
        }
        setTranscript(safeTranscript);
        setOriginalTranscript(safeTranscript);
        setState("transcribed");
        onTranscribed?.(result);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Couldn't transcribe audio.";
        setState("error");
        setError(msg);
      }
    };

    // ----- Silence detection setup -----
    let audioCtx: AudioContext;
    try {
      // Safari uses webkitAudioContext on older versions; cast defensively.
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtx = new Ctx();
    } catch {
      // AudioContext unavailable — proceed without silence detection. The
      // user will need to tap Stop manually.
      audioCtxRef.current = null;
      recorder.start();
      startedAtRef.current = Date.now();
      lastLoudAtRef.current = Date.now();
      setState("listening");
      return;
    }
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyserRef.current = analyser;
    measuredRef.current = true; // analyser active → speech-presence gate valid

    recorder.start();
    startedAtRef.current = Date.now();
    lastLoudAtRef.current = Date.now();
    setState("listening");

    const buffer = new Float32Array(analyser.fftSize);

    const tick = () => {
      const ana = analyserRef.current;
      if (!ana) return;
      ana.getFloatTimeDomainData(buffer);

      // RMS of the time-domain window.
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = buffer[i];
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      currentRmsRef.current = rms; // surfaced via getAmplitude()
      if (rms > maxRmsRef.current) maxRmsRef.current = rms; // speech-presence peak

      const now = Date.now();
      if (rms >= SILENCE_THRESHOLD) {
        lastLoudAtRef.current = now;
      }

      const elapsed = now - startedAtRef.current;
      const sinceLoud = now - lastLoudAtRef.current;
      // Speech is "started" once the level has crossed the real-speech peak.
      const speechStarted = maxRmsRef.current >= SPEECH_PEAK_THRESHOLD;

      // End-of-speech: only auto-stop on silence AFTER the user has actually
      // spoken — so a slow start or a thinking pause before talking never cuts
      // them off (the bug: it stopped before they began).
      const endOfSpeech =
        speechStarted && sinceLoud >= SILENCE_DURATION_MS;
      // Never-spoke timeout: if they tapped but didn't speak within the window,
      // stop (the post-recording gate then reports "didn't catch any speech").
      const preSpeechTimeout =
        !speechStarted && elapsed >= PRE_SPEECH_TIMEOUT_MS;
      const hitMaxDuration = elapsed >= MAX_RECORDING_MS;

      if (endOfSpeech || preSpeechTimeout || hitMaxDuration) {
        stop();
        return;
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  }, [
    language,
    onTranscribed,
    sessionId,
    stop,
    teardown,
    clearErrorHideTimer,
    setTransientError,
  ]);

  const reset = useCallback(() => {
    clearErrorHideTimer();
    teardown();
    setState("idle");
    setTranscript("");
    setOriginalTranscript("");
    setError(null);
    setDurationMs(0);
  }, [teardown, clearErrorHideTimer]);

  // Normalize raw RMS into a punchy 0-1 range for visualization. Speech RMS
  // typically sits ~0.03-0.2; mapping 0.22 → full height keeps the bars lively
  // without clipping. Clamped both ends.
  const getAmplitude = useCallback(
    () => Math.max(0, Math.min(1, currentRmsRef.current / 0.22)),
    []
  );

  return {
    state,
    transcript,
    setTranscript,
    originalTranscript,
    error,
    durationMs,
    start,
    stop,
    reset,
    getAmplitude,
  };
}
