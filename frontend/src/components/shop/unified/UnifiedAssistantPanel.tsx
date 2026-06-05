"use client";

import React, {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Loader2,
  Send,
  AlertCircle,
  Mic,
  Volume2,
  VolumeX,
  Pin,
  X,
  Square,
  Paperclip,
} from "lucide-react";
import { getApiBaseUrl } from "@/utils/apiUrl";
import ReactMarkdown, { Components } from "react-markdown";
import {
  askOrchestrate,
  OrchestrateMessage,
  OrchestrateToolCall,
  ORCHESTRATE_LIMITS,
} from "@/services/api/aiOrchestrate";
import {
  listPinnedQueries,
  pinQuery,
  unpinQuery,
  recordPinnedRun,
  PinnedQuery,
} from "@/services/api/aiInsights";
import { OrchestrateToolCallCard } from "./OrchestrateToolCallCard";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { ListeningBars } from "@/components/voice/ListeningBars";
import { speakText } from "@/services/api/voice";
import { useUnifiedAssistantStore } from "@/stores/unifiedAssistantStore";
import { unlockAudioPlayback, getPrimedAudio } from "@/lib/audioUnlock";

/**
 * UnifiedAssistantPanel (v2)
 *
 * The "one door" — a single conversation that answers business questions AND
 * takes marketing actions, no panel switching. Structurally a copy of
 * MarketingAIPanel (the tab-free chat skeleton), with three changes:
 *   - calls askOrchestrate (full cross-domain registry) instead of askMarketing
 *   - renders OrchestrateToolCallCard (delegates to both domains' card renderers)
 *   - cross-domain starter prompts + copy
 *
 * Voice-in is intentionally NOT wired here yet — the voice/TTS layer +
 * repointing the entry points is Phase 3. Text-only for Phase 2. State lives in
 * component memory only (sessionId minted per mount); server-side persistence
 * is Phase 2/D2 follow-up.
 */
// localStorage key — once the owner has seen/used the voice coach-mark, never
// show it again.
const COACH_SEEN_KEY = "rc_unified_talk_coach_seen";

const STARTER_PROMPTS: readonly string[] = [
  "How did we do this month?",
  "Why does it feel slower lately?",
  "Win back the customers who've gone quiet",
  "What's running low in inventory?",
] as const;

type Turn =
  | { role: "user"; content: string; imageUrl?: string }
  | { role: "assistant"; content: string; toolCalls: OrchestrateToolCall[] };

export const UnifiedAssistantPanel: React.FC<{
  /** The shop's chosen assistant name, for the spoken greeting. */
  assistantName?: string | null;
}> = ({ assistantName }) => {
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `orchestrate_${Math.random().toString(36).slice(2)}_${Date.now()}`
  );
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceOut, setVoiceOut] = useState(false);
  // Phase 9 — an image the owner attached via the paperclip, pending send.
  // Uploaded to shops/{shopId}/ai-uploads; its URL rides along with the next
  // message so the assistant can analyze or edit it.
  const [attachedImage, setAttachedImage] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [attaching, setAttaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The assistant's opening line (shown as a bubble + spoken) when a mic opens
  // the panel for the first time this session. UI-only — never sent to the
  // orchestrator (it would break the user-first message alternation).
  const [greeting, setGreeting] = useState<string | null>(null);
  // First-run coach-mark on the "Tap to talk" button — for owners who don't
  // know they can speak to it. Shows until they use voice or dismiss it, then
  // never again (persisted in localStorage).
  const [showCoach, setShowCoach] = useState(false);

  // v2.5 pinned questions — shared per-shop "saved questions" store (reused
  // from Insights). Pins only attach to pinnable insights read turns.
  const [pinned, setPinned] = useState<PinnedQuery[]>([]);
  const pendingRunRef = useRef<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Bumped to cancel an in-flight speech sequence (new reply, stop, unmount).
  const speechSeqRef = useRef(0);
  // False once the panel unmounts (Sheet closed). Async work (TTS fetch,
  // orchestrate reply, late transcription) checks this before playing audio or
  // setting state, so closing the panel can't leave a reply speaking — or stack
  // overlapping voices when it's reopened and asked again.
  const aliveRef = useRef(true);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, loading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Show the "Tap to talk" coach-mark on first ever open (guard for SSR +
  // blocked storage). Set in an effect, not initial state, to avoid a
  // server/client hydration mismatch.
  useEffect(() => {
    try {
      if (
        typeof window !== "undefined" &&
        !window.localStorage.getItem(COACH_SEEN_KEY)
      ) {
        setShowCoach(true);
      }
    } catch {
      /* localStorage unavailable (private mode / blocked) — just skip the coach */
    }
  }, []);

  // Load the shop's pinned questions once on mount.
  useEffect(() => {
    let cancelled = false;
    listPinnedQueries()
      .then((p) => {
        if (!cancelled) setPinned(p);
      })
      .catch(() => {
        /* pins are non-critical — chat works without them */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const atMessageLimit = turns.length >= ORCHESTRATE_LIMITS.maxMessages;

  // Turn[] → wire shape; substitute a single space for empty content so the
  // backend's non-empty-content validator passes (same as the other panels).
  const toWireMessages = (ts: Turn[]): OrchestrateMessage[] =>
    ts.map((t) => ({
      role: t.role,
      content: t.content.trim().length > 0 ? t.content : " ",
    }));

  // Paperclip → file picker → upload to shops/{shopId}/ai-uploads. The returned
  // URL is held as a pending attachment until the next message is sent.
  const handleAttachClick = () => fileInputRef.current?.click();

  const handleAttachFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = ""; // allow re-pick
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Unsupported image type. Use JPEG, PNG, GIF, or WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image is too large (max 5MB).");
      return;
    }
    const uploadOnce = async (): Promise<{ url: string }> => {
      const formData = new FormData();
      formData.append("image", file);
      const resp = await fetch(`${getApiBaseUrl()}/upload/ai-source`, {
        method: "POST",
        credentials: "include", // cookie auth, same as ImageUploader
        body: formData,
      });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok || !result.success || !result.url) {
        throw new Error(
          result.error || result.message || `Upload failed (${resp.status})`
        );
      }
      return result as { url: string };
    };

    setAttaching(true);
    setError(null);
    try {
      // Retry on a network-level failure (fetch throws a TypeError) — e.g. the
      // dev server momentarily restarting. Up to 3 attempts, 1s apart, covers a
      // ~2-3s restart window. A real HTTP error carries a message (not a
      // TypeError), so it surfaces immediately without retrying.
      let result: { url: string } | null = null;
      let lastErr: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          result = await uploadOnce();
          break;
        } catch (e) {
          lastErr = e;
          if (e instanceof TypeError && attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          throw e;
        }
      }
      if (!result) throw lastErr;
      setAttachedImage({ url: result.url, name: file.name });
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Couldn't reach the server — please try again."
          : err instanceof Error
          ? err.message
          : "Couldn't upload the image."
      );
    } finally {
      setAttaching(false);
    }
  };

  const submitText = async (rawText: string, opts?: { speak?: boolean }) => {
    if (loading) return;
    const text = rawText.trim();
    if (!text) return;

    if (atMessageLimit) {
      setError(
        `This conversation has reached the ${ORCHESTRATE_LIMITS.maxMessages}-message limit. Close and reopen to start fresh.`
      );
      return;
    }
    if (text.length > ORCHESTRATE_LIMITS.maxContentChars) {
      setError(
        `Message is too long (max ${ORCHESTRATE_LIMITS.maxContentChars} characters).`
      );
      return;
    }

    // Consume any pending paperclip attachment for THIS message, then clear it
    // so it never rides along on a later turn.
    const img = attachedImage;
    setAttachedImage(null);

    const nextTurns: Turn[] = [
      ...turns,
      { role: "user", content: text, ...(img ? { imageUrl: img.url } : {}) },
    ];
    setTurns(nextTurns);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await askOrchestrate(
        sessionId,
        toWireMessages(nextTurns),
        img?.url,
        lastShownImageUrl(turns)
      );
      // Panel was closed while the reply was in flight — drop it silently so we
      // don't speak into a torn-down panel (the source of overlapping voices).
      if (!aliveRef.current) return;
      setTurns([
        ...nextTurns,
        {
          role: "assistant",
          content: res.reply,
          toolCalls: res.toolCalls ?? [],
        },
      ]);
      if ((opts?.speak ?? voiceOut) && res.reply && res.reply.trim()) {
        void playSpeech(res.reply);
      }
      // If this turn was a re-run of a pinned question, record the run.
      if (pendingRunRef.current) {
        const pid = pendingRunRef.current;
        pendingRunRef.current = null;
        void recordPinnedRun(pid, (res.reply || "").slice(0, 500)).catch(() => {});
      }
    } catch (err) {
      const ax = err as {
        response?: { status?: number; data?: { error?: string } };
        message?: string;
      };
      const status = ax?.response?.status;
      const detail = ax?.response?.data?.error;
      let msg: string;
      switch (status) {
        case 401:
          msg = "Your session has expired. Please log in again.";
          break;
        case 400:
          msg = detail || "We couldn't process that request. Try rephrasing it.";
          break;
        case 429:
          msg =
            detail ||
            "AI budget exhausted for this month. Try again later or contact RepairCoin support.";
          break;
        case 503:
          msg = "AI service is temporarily unavailable. Try again in a moment.";
          break;
        default:
          msg = ax?.message || "Something went wrong. Please try again.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Stop any reply currently speaking / queued (new answer, or unmount).
  const stopSpeech = () => {
    speechSeqRef.current++; // invalidates any running sequence
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  };

  // Voice-out: speak an assistant reply, best-effort.
  //
  // To make the voice start ~when the text appears (instead of waiting for the
  // WHOLE clip to synthesize — the source of the multi-second lag), we split
  // the reply into chunks, fire all the TTS requests in PARALLEL, and play them
  // strictly IN ORDER as they resolve. The short first sentence comes back in
  // ~1s and starts playing while later sentences are still generating.
  const playSpeech = async (text: string) => {
    stopSpeech(); // never overlap a previous reply
    const myToken = speechSeqRef.current;
    const chunks = chunkForSpeech(text);
    if (chunks.length === 0) return;

    // Kick off every chunk's synthesis at once; each resolves to a playable
    // object URL (or null if that chunk failed — we skip it, keep the rest).
    const pending = chunks.map((c) =>
      speakText(c)
        .then((b) => URL.createObjectURL(b))
        .catch(() => null)
    );
    const cancelled = () =>
      myToken !== speechSeqRef.current || !aliveRef.current;

    for (let i = 0; i < pending.length; i++) {
      const url = await pending[i];
      if (cancelled()) {
        if (url) URL.revokeObjectURL(url);
        // Release any later chunks that are still synthesizing.
        pending
          .slice(i + 1)
          .forEach((p) => p.then((u) => u && URL.revokeObjectURL(u)));
        return;
      }
      if (!url) continue; // this chunk failed — keep going with the rest
      await new Promise<void>((resolve) => {
        if (cancelled()) {
          URL.revokeObjectURL(url);
          resolve();
          return;
        }
        const audio = new Audio(url);
        audioRef.current = audio;
        const done = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onended = done;
        audio.onerror = done;
        audio.play().catch(done);
      });
    }
  };

  // Voice-in: reuse the shared mic→STT recorder. Speaking auto-speaks the
  // reply back (spoke-to-it → speaks-back, Siri-style), regardless of toggle.
  const recorder = useVoiceRecorder({
    sessionId,
    // Pin STT to English — the shop dashboard is English; without a hint
    // Whisper can mis-detect the language on accented/unclear audio and
    // return a non-English transcript (which then flips the whole reply).
    language: "en",
    onTranscribed: (r) => {
      if (r.transcript && r.transcript.trim()) {
        void submitText(r.transcript, { speak: true });
      }
    },
  });

  // When opened via a voice trigger (HeaderVoiceMic / MobileBottomNavMic), the
  // store carries a one-shot "start the mic" flag. The Sheet mounts this panel
  // fresh on each open, so we consume the flag on mount and auto-start the
  // recorder — turning those buttons into "tap → talk to the unified assistant"
  // instead of the old route-to-panels dispatcher.
  // Speak a short, name-branded greeting, THEN start listening once it finishes
  // (never both at once — the mic would record the greeting = echo). Shows the
  // greeting text instantly, and caps the wait so a slow/blocked TTS doesn't
  // delay listening.
  const greetThenListen = (text: string) => {
    setGreeting(text);
    let advanced = false;
    const beginListening = () => {
      if (advanced || !aliveRef.current) return;
      advanced = true;
      void recorder.start();
    };
    // Safety net only for a HUNG fetch: a broken TTS rejects fast (the .catch
    // below starts listening immediately), and a slow-but-working one should
    // still be allowed to play — so this is generous, not a 3s race that would
    // skip a cold first-call greeting.
    const fallback = setTimeout(beginListening, 12000);
    speakText(text)
      .then(async (blob) => {
        // Timed out (already listening) or panel closed — don't play (echo).
        if (advanced || !aliveRef.current) {
          clearTimeout(fallback);
          return;
        }
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
        // Reuse the gesture-primed element so autoplay doesn't block the
        // greeting (it plays BEFORE any getUserMedia that would unlock audio).
        const audio = getPrimedAudio() ?? new Audio();
        audio.src = url;
        audio.volume = 1; // primed at volume 0 for the silent unlock
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          beginListening();
        };
        audio.onerror = () => beginListening();
        await audio.play(); // throws if autoplay is blocked
        clearTimeout(fallback); // playing — onended will start the mic
      })
      .catch(() => {
        clearTimeout(fallback);
        beginListening(); // TTS failed / autoplay blocked → just listen
      });
  };

  // When a voice trigger sets the one-shot mic flag — on first open (flag set
  // before mount) AND when a mic is tapped while the panel is already open —
  // either greet-then-listen (first voice open this session) or go straight to
  // listening. Consuming flips the flag false so it fires once per tap; ignored
  // if a recording is already in flight (mashing mics can't stack recordings).
  const pendingMic = useUnifiedAssistantStore((s) => s.pendingMic);
  useEffect(() => {
    if (!pendingMic) return;
    if (!useUnifiedAssistantStore.getState().consumePendingMic()) return;
    if (recorder.state === "listening" || recorder.state === "transcribing") {
      return;
    }
    const store = useUnifiedAssistantStore.getState();
    if (!store.hasGreeted) {
      store.markGreeted();
      greetThenListen(pickGreeting(assistantName ?? null));
    } else {
      void recorder.start();
    }
    // recorder.start / .state read at fire time; flag drives the single run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMic]);

  // Teardown on unmount (Sheet close): mark dead, kill any playing/queued TTS,
  // and release the mic. This is the core fix for overlapping spoken replies —
  // without it, closing the panel mid-reply leaves the Audio playing and a
  // late transcription can fire a fresh reply, so reopening stacks voices.
  useEffect(() => {
    // Set true on (re)mount so a StrictMode unmount/remount in dev doesn't
    // leave the panel permanently marked dead (which would silence TTS).
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      speechSeqRef.current++; // cancel any in-flight speech sequence
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      try {
        recorder.reset();
      } catch {
        /* recorder may already be idle */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = () => submitText(input);
  const handleStarterClick = (prompt: string) => submitText(prompt);

  // Permanently dismiss the "Tap to talk" coach-mark (on first use or close).
  const dismissCoach = () => {
    setShowCoach(false);
    try {
      window.localStorage.setItem(COACH_SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  // Pin the question that produced a card (delegated from the insights card's
  // Pin button). Idempotent — the backend de-dupes on (shop, question).
  const handlePin = async (questionText: string) => {
    const created = await pinQuery(questionText);
    setPinned((cur) =>
      cur.some((p) => p.id === created.id) ? cur : [created, ...cur]
    );
  };
  const handleUnpin = async (id: string) => {
    const prev = pinned;
    setPinned((cur) => cur.filter((p) => p.id !== id)); // optimistic
    try {
      await unpinQuery(id);
    } catch {
      setPinned(prev); // restore on failure
    }
  };
  const handlePinnedTap = (p: PinnedQuery) => {
    if (loading) return;
    pendingRunRef.current = p.id; // submitText records the run after the reply
    void submitText(p.questionText);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = input.trim().length > 0 && !loading && !atMessageLimit;
  const listening = recorder.state === "listening";
  const transcribing = recorder.state === "transcribing";
  const displayError =
    error ?? (recorder.state === "error" ? recorder.error : null);
  const markdownComponents = useMemo(() => buildMarkdownComponents(), []);

  return (
    <div className="flex-1 flex flex-col min-h-0 mt-4">
      {pinned.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-1">
            <Pin className="w-3 h-3" /> Pinned
          </span>
          {pinned.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 bg-[#1A1A1A] border border-gray-700 rounded-full pl-2.5 pr-1 py-1 text-xs text-gray-300 hover:border-[#FFCC00] transition-colors"
            >
              <button
                type="button"
                onClick={() => handlePinnedTap(p)}
                disabled={loading}
                title={p.questionText}
                className="max-w-[160px] truncate hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {p.questionText}
              </button>
              <button
                type="button"
                onClick={() => void handleUnpin(p.id)}
                aria-label="Unpin question"
                className="text-gray-500 hover:text-red-400 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3" aria-live="polite">
        {turns.length === 0 && !loading && !error && !greeting && (
          <EmptyState onPick={handleStarterClick} disabled={loading} />
        )}

        {/* Assistant's spoken greeting (voice opens, first time per session). */}
        {greeting && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-base break-words bg-[#1A1A1A] border border-gray-800 text-gray-200">
              {greeting}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <TurnBubble
            key={i}
            turn={t}
            markdownComponents={markdownComponents}
            onChipClick={loading ? undefined : submitText}
            onPin={handlePin}
            originatingQuestion={priorUserQuestion(turns, i)}
          />
        ))}

        {loading && <TypingBubble />}

        <div ref={messagesEndRef} />
      </div>

      {displayError && (
        <div className="mt-3 bg-red-900/30 border border-red-700/60 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300 leading-relaxed">{displayError}</p>
        </div>
      )}

      {listening ? (
        // Listening takeover — the plain input bar becomes a live, voice-
        // reactive equalizer (Siri-style). Auto-stops on silence, or tap Stop.
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-purple-500/40 bg-[#1A1A1A] px-4 py-3 shadow-[0_0_24px_rgba(168,85,247,0.22)]">
          <span className="flex items-center gap-2 text-sm font-medium text-purple-300 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Listening…
          </span>
          <ListeningBars getAmplitude={recorder.getAmplitude} className="flex-1" />
          <button
            type="button"
            onClick={() => recorder.stop()}
            aria-label="Stop and send"
            title="Stop"
            className="flex-shrink-0 p-2.5 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        </div>
      ) : (
      <div className="mt-3">
        {/* Hidden file input backing the paperclip. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleAttachFile}
          className="hidden"
        />
        {/* Pending attachment chip — thumbnail + name + remove. Sits above the
            textarea so the owner sees what will ride along with their message. */}
        {(attachedImage || attaching) && (
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-[#1A1A1A] border border-gray-700 pl-1.5 pr-2 py-1">
            {attaching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#FFCC00]" />
                <span className="text-xs text-gray-400">Uploading image…</span>
              </>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachedImage!.url}
                  alt="Attachment"
                  className="w-7 h-7 rounded object-cover border border-gray-700"
                />
                <span className="text-xs text-gray-300 max-w-[160px] truncate">
                  {attachedImage!.name}
                </span>
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  aria-label="Remove attached image"
                  className="text-gray-500 hover:text-red-400 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={ORCHESTRATE_LIMITS.maxContentChars}
          disabled={loading || atMessageLimit}
          placeholder={
            atMessageLimit
              ? "Conversation full — close to start fresh"
              : "Type your question, or tap “Talk” to speak…"
          }
          className="w-full bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-2 text-base text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Ask your business assistant anything"
        />
        {/* Labeled action buttons — icon + always-visible text so the controls
            are self-explanatory (no hover-only tooltips). Bigger tap targets
            for accessibility. */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* Talk — the headline voice affordance, given a warm yellow outline
              so it reads as "you can just speak to me". */}
          <div className="relative">
            {/* First-run coach-mark: an always-visible bubble (not a hover
                tooltip) pointing at the Talk button, for owners who don't know
                they can speak. Dismisses on first use or the × — then never
                shows again. */}
            {showCoach && (
              <div className="absolute bottom-full left-0 mb-2 z-20 w-max max-w-[230px]">
                <div className="relative bg-gradient-to-br from-purple-600 to-violet-700 text-white text-sm font-medium leading-snug rounded-lg px-3 py-2 shadow-[0_4px_20px_rgba(168,85,247,0.5)]">
                  <button
                    type="button"
                    onClick={dismissCoach}
                    aria-label="Dismiss tip"
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow-md ring-2 ring-[#101010]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  👋 New here? Tap <span className="font-bold">Talk</span> and
                  just speak — ask anything by voice.
                  {/* downward pointer toward the Talk button */}
                  <span className="absolute top-full left-6 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[7px] border-t-purple-600" />
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                dismissCoach();
                if (listening) recorder.stop();
                else void recorder.start();
              }}
              disabled={loading || atMessageLimit || transcribing}
              aria-label="Tap to talk to the assistant"
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-purple-500/10 border-purple-400/60 text-purple-300 hover:bg-purple-500/20 ${
                showCoach ? "ring-2 ring-purple-400/60" : ""
              }`}
            >
              {transcribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
              <span>{transcribing ? "Working…" : "Tap to talk"}</span>
            </button>
          </div>

          {/* Voice on/off — state shown in words, not just an icon. */}
          <button
            type="button"
            onClick={() => {
              // Turning spoken replies ON: unlock audio in this gesture so a
              // deferred reply play() (typed question → spoken answer, no mic
              // grant beforehand) isn't blocked by the autoplay policy.
              if (!voiceOut) unlockAudioPlayback();
              setVoiceOut((v) => !v);
            }}
            aria-pressed={voiceOut}
            aria-label={
              voiceOut
                ? "Spoken replies are on — tap to mute"
                : "Spoken replies are off — tap to hear answers"
            }
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors ${
              voiceOut
                ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                : "bg-[#1A1A1A] border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            {voiceOut ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
            <span>{voiceOut ? "Voice on" : "Voice off"}</span>
          </button>

          {/* Attach — drop in a photo (storefront, product, draft ad) for the
              assistant to analyze or edit (Phase 9). */}
          <button
            type="button"
            onClick={handleAttachClick}
            disabled={loading || atMessageLimit || attaching}
            aria-label="Attach an image"
            title="Attach an image"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#1A1A1A] border-gray-700 text-gray-400 hover:text-white hover:border-[#FFCC00]/60"
          >
            {attaching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
            <span>Attach</span>
          </button>

          {/* Send — primary action, pushed to the right. */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send"
            className={`ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              canSend
                ? "bg-[#FFCC00] text-black hover:bg-[#FFD700]"
                : "bg-[#1A1A1A] border border-gray-800 text-gray-600 cursor-not-allowed"
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Send</span>
          </button>
        </div>
      </div>
      )}

      <p className="mt-2 text-xs text-gray-400 text-center">
        I answer and draft — I never send, order, or charge anything without your
        tap.
      </p>
    </div>
  );
};

// ----- internals -----

/** Split a reply for streaming-ish TTS: a SHORT first chunk (just the first
 *  sentence) so the voice can start fast, then the remaining sentences merged
 *  into ~300-char chunks. Falls back to the whole string when there are no
 *  sentence breaks. Whitespace-normalized; content otherwise unchanged. */
function chunkForSpeech(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length === 0) return [];
  const sentences =
    clean.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [
      clean,
    ];
  if (sentences.length <= 1) return [clean];

  const chunks: string[] = [sentences[0]]; // first sentence alone = fast start
  let buf = "";
  for (let i = 1; i < sentences.length; i++) {
    const next = (buf ? buf + " " : "") + sentences[i];
    if (next.length > 300 && buf) {
      chunks.push(buf);
      buf = sentences[i];
    } else {
      buf = next;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

/** A short, varied opening line. Uses the assistant's name when set so the
 *  greeting reinforces the brand ("Hi, I'm Cain — …"). Pure; randomized per
 *  call (browser-only, no SSR concern since it's invoked from an effect). */
function pickGreeting(name: string | null): string {
  const n = name?.trim();
  const lines = n
    ? [
        `Hi, I'm ${n} — what can I help with?`,
        `Hey, ${n} here. What do you need?`,
        `${n} ready — what's on your mind?`,
        `Hi! ${n} here — how can I help today?`,
      ]
    : [
        `Hi — what can I help with?`,
        `Hey there — what do you need?`,
        `Ready when you are — what's up?`,
        `How can I help today?`,
      ];
  return lines[Math.floor(Math.random() * lines.length)];
}

const EmptyState: React.FC<{
  onPick: (prompt: string) => void;
  disabled: boolean;
}> = ({ onPick, disabled }) => (
  <div className="flex flex-col px-1 py-6">
    <p className="text-base text-gray-300 mb-1 text-center">
      Just talk to your business.
    </p>
    <p className="text-sm text-gray-500 mb-5 text-center">
      Ask a question, or tell me to do something — try:
    </p>
    <div className="w-full space-y-2">
      {STARTER_PROMPTS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(p)}
          disabled={disabled}
          className="w-full text-left text-sm text-gray-300 bg-[#1A1A1A] border border-gray-700 hover:border-[#FFCC00] hover:text-white rounded-lg px-3 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {p}
        </button>
      ))}
    </div>
  </div>
);

// Three bouncing dots — matches the AI Sales Agent's "typing" indicator
// (ConversationThread). Staggered animation-delays give the classic
// left-to-right typing ripple. Brand-yellow to fit the unified panel's theme.
const TypingBubble: React.FC = () => (
  <div className="flex justify-start" aria-live="polite" aria-label="Assistant is typing">
    <div className="rounded-lg px-3 py-2.5 bg-[#1A1A1A] border border-gray-800 flex items-center">
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 bg-[#FFCC00] rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2 h-2 bg-[#FFCC00] rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2 h-2 bg-[#FFCC00] rounded-full animate-bounce" />
      </div>
    </div>
  </div>
);

function buildMarkdownComponents(): Components {
  return {
    strong: ({ children }) => (
      <strong className="font-semibold text-white">{children}</strong>
    ),
    em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
    code: ({ children }) => (
      <code className="bg-black/40 border border-gray-700 rounded px-1 py-0.5 text-[12px] font-mono">
        {children}
      </code>
    ),
    p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
    ul: ({ children }) => (
      <ul className="list-disc list-outside ml-5 my-2 space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside ml-5 my-2 space-y-1">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="text-base leading-relaxed">{children}</li>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#FFCC00] hover:text-[#FFD700] underline"
      >
        {children}
      </a>
    ),
  };
}

/** The most recent user turn before assistant turn `i` — the question that
 *  produced it, used as the pin's `originatingQuestion`. */
function priorUserQuestion(turns: Turn[], i: number): string | undefined {
  for (let j = i - 1; j >= 0; j--) {
    if (turns[j].role === "user") return turns[j].content;
  }
  return undefined;
}

/** URL of the image the owner is currently looking at — the most recent
 *  campaign_image_proposal across the conversation. Sent so "edit this" targets
 *  the displayed image (and the edit keeps its size). Undefined if none shown. */
function lastShownImageUrl(turns: Turn[]): string | undefined {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.role !== "assistant") continue;
    for (let j = t.toolCalls.length - 1; j >= 0; j--) {
      const d = t.toolCalls[j].display;
      if (d && d.kind === "campaign_image_proposal" && d.imageUrl) {
        return d.imageUrl;
      }
    }
  }
  return undefined;
}

const TurnBubble: React.FC<{
  turn: Turn;
  markdownComponents: Components;
  onChipClick?: (prompt: string) => void;
  onPin?: (questionText: string) => Promise<void>;
  originatingQuestion?: string;
}> = ({ turn, markdownComponents, onChipClick, onPin, originatingQuestion }) => {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg px-3 py-2 text-base whitespace-pre-wrap break-words bg-[#FFCC00] text-black">
          {turn.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={turn.imageUrl}
              alt="Attached"
              className="mb-2 max-h-40 w-auto rounded-md border border-black/20"
            />
          )}
          {turn.content}
        </div>
      </div>
    );
  }

  // Skip the prose bubble when the reply is empty / punctuation-only; tool
  // cards still render (same hollow-bubble guard as the other panels).
  const hasProse = /[a-zA-Z0-9]/.test(turn.content);

  return (
    <div className="flex justify-start flex-col items-start gap-2">
      {hasProse && (
        <div className="max-w-[85%] rounded-lg px-3 py-2 text-base break-words bg-[#1A1A1A] border border-gray-800 text-gray-200">
          <ReactMarkdown components={markdownComponents}>
            {turn.content}
          </ReactMarkdown>
        </div>
      )}
      {turn.toolCalls.length > 0 && (
        <div className="w-full max-w-[85%] space-y-2">
          {turn.toolCalls.map((tc, i) => (
            <OrchestrateToolCallCard
              key={i}
              toolCall={tc}
              onChipClick={onChipClick}
              onPin={onPin}
              originatingQuestion={originatingQuestion}
            />
          ))}
        </div>
      )}
    </div>
  );
};
