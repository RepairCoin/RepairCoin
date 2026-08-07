"use client";

import React from "react";
import Image from "next/image";
import { Loader2, SendHorizontal } from "lucide-react";
import { FaMicrophone } from "react-icons/fa";
import Badge from "./Badge";
import { m, useReducedMotion } from "framer-motion";
import { useModalStore } from "@/stores/modalStore";
import { askHomepageAi, type AnsweredBy } from "@/services/api/publicAi";

interface HeroSectionProps {
  hasWallet: boolean;
  isDetecting: boolean;
  isRedirecting?: boolean;
  onGetStartedClick: () => void;
}

/* ─── Viewport Ranges ───────────────────────────────
 *  mobile:  0 - 639px       (default / no prefix)
 *  tablet:  640px - 1279px  (sm:, md:, lg:)
 *  desktop: 1280px+         (xl:)
 *  wide:    1536px+         (2xl:)
 * ─────────────────────────────────────────────────── */
const layout = {
  section: [
    "relative bg-[#0a0a0a]",
    "min-h-[100svh]",
    "overflow-hidden",
    "flex items-center",
    "pt-24 pb-12 sm:pt-28 sm:pb-20 lg:py-28",
  ].join(" "),

  container: ["max-w-7xl mx-auto w-full", "px-4 lg:px-8"].join(" "),

  column: [
    "relative z-10",
    "flex flex-col items-center text-center",
    "space-y-6 sm:space-y-7",
  ].join(" "),

  heading: [
    "font-bold text-white leading-[1.15] text-balance",
    "max-w-4xl",
    "text-[2.25rem]",
    "sm:text-[3rem]",
    "xl:text-[4rem]",
  ].join(" "),

  ctaButton: [
    "btn-shimmer",
    "bg-[#F7CC00] hover:bg-[#E5BB00]",
    "text-black font-semibold",
    "px-8 py-3.5",
    "rounded-xl shadow-lg hover:shadow-xl",
    "transition-all duration-200",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "flex items-center gap-2",
    "text-sm sm:text-base",
  ].join(" "),
};

export default function HeroSection({
  hasWallet,
  isDetecting,
  isRedirecting = false,
  onGetStartedClick,
}: HeroSectionProps) {
  const isLoading = isDetecting || isRedirecting;
  const { openWelcomeModal } = useModalStore();
  const prefersReducedMotion = useReducedMotion();

  const handleGetStartedClick = () => {
    if (!hasWallet) {
      openWelcomeModal();
    } else {
      onGetStartedClick();
    }
  };

  const fadeUp = (delay: number) => ({
    initial: prefersReducedMotion ? undefined : { opacity: 0, y: 20 },
    animate: prefersReducedMotion ? undefined : { opacity: 1, y: 0 },
    transition: prefersReducedMotion
      ? undefined
      : { duration: 0.6, delay, ease: "easeOut" as const },
  });

  return (
    <section className={layout.section}>
      {/* Background pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src="/img/landingv2/bg-background.png"
          alt=""
          fill
          className="object-cover opacity-70"
          priority
        />
      </div>

      <div className={layout.container}>
        <div className={layout.column}>
          <m.div {...fadeUp(0.1)}>
            <Badge label="The Future of Service Businesses" />
          </m.div>

          <m.h1 {...fadeUp(0.2)} className={layout.heading}>
            The Smarter Way to Grow Your Business With AI
          </m.h1>

          <m.p
            {...fadeUp(0.35)}
            className="text-gray-300 leading-relaxed max-w-2xl text-base sm:text-[1.25rem] -mt-2 sm:-mt-3"
          >
            FixFlow helps local service businesses manage bookings, customers,
            marketing, rewards, and daily operations from one intelligent
            platform.
          </m.p>

          {/* CTA */}
          <m.div {...fadeUp(0.5)}>
            <button
              onClick={handleGetStartedClick}
              disabled={isLoading}
              className={layout.ctaButton}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isRedirecting ? "Redirecting..." : "Loading..."}
                </>
              ) : (
                <>Start Free Trial</>
              )}
            </button>
          </m.div>

          {/* ── AI assistant ── */}
          <div className="w-full max-w-3xl pt-4 sm:pt-6">
            {/* AI assistant prompt label */}
            <m.div
              {...fadeUp(0.6)}
              className="flex items-start justify-center gap-2"
            >
              <CurvedArrow />
              <span className="text-[#F7CC00] font-semibold text-sm sm:text-base text-left">
                Ask our AI assistant anything about your business
              </span>
            </m.div>

            {/* AI chat bar (visual only) */}
            <m.div {...fadeUp(0.7)} className="mt-3">
              <AIChatBar onCta={handleGetStartedClick} />
            </m.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Hand-drawn curved arrow pointing at the AI label ── */
function CurvedArrow() {
  return (
    <svg
      width="32"
      height="28"
      viewBox="0 0 32 28"
      fill="none"
      className="flex-shrink-0 text-[#F7CC00]"
      aria-hidden="true"
    >
      <path
        d="M30 4C18 2 4 8 4 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4 20L1 13M4 20L11 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── AI chat bar ──────────────────────────────────────────────────────────
 *
 * P1: answers come from the prospect corpus on the server; no model is called, so this cannot
 * produce a surprise bill. Three free answers, then an account is required — the limit is the call
 * to action, not a punishment.
 *
 * The thread grows DOWNWARD from the input and the input stays put, so nothing the visitor is
 * reading moves under them. See docs/tasks/strategy/homepage-ai/homepage-ai-plan.md §7.
 */
interface Turn {
  question: string;
  answer: string;
  nextStep: string;
  answeredBy: AnsweredBy;
}

function AIChatBar({ onCta }: { onCta: () => void }) {
  const [value, setValue] = React.useState("");
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [pending, setPending] = React.useState(false);
  const [gated, setGated] = React.useState(false);
  const threadRef = React.useRef<HTMLDivElement>(null);

  // Bring the newest answer into view without yanking the page. The answer appears directly under the
  // input, so nudging the thread itself is enough — scrolling the window would move the headline.
  React.useEffect(() => {
    if (turns.length || pending) {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [turns, pending]);

  const ask = async () => {
    const question = value.trim();
    if (!question || pending || gated) return;
    setValue("");
    setPending(true);
    try {
      const r = await askHomepageAi(question);
      setTurns((prev) => [...prev, { question, answer: r.answer, nextStep: r.nextStep, answeredBy: r.answeredBy }]);
      if (r.gated || r.answeredBy === "gated") setGated(true);
    } catch {
      // Never an error card. Rate limited, over budget and broken all read the same, because a
      // visitor cannot act on the difference and a broken box on the homepage is worse than no box.
      setTurns((prev) => [
        ...prev,
        {
          question,
          answer:
            "I couldn't get to that one just now. FixFlow helps local service businesses take bookings, keep customers coming back, and handle the follow-up automatically.",
          nextStep: "Start a 14-day free trial and have a look around.",
          answeredBy: "fallback",
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <div className="relative flex items-center gap-3 rounded-full bg-white border border-[#F7CC00]/60 pl-4 pr-2 py-2 shadow-[0_0_30px_-5px_rgba(247,204,0,0.35)]">
        <span className="relative w-7 h-7 flex-shrink-0">
          <Image src="/img/landingv4/chat-bot.png" alt="" fill className="object-contain" />
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void ask();
          }}
          disabled={gated}
          /* Capped server-side too; this only stops someone pasting a document in. */
          maxLength={300}
          placeholder={
            gated ? "Create a free account to keep going" : "Try.. How can I grow my business faster?"
          }
          className="flex-1 bg-transparent text-sm sm:text-base text-black placeholder-black/50 focus:outline-none disabled:cursor-not-allowed"
          aria-label="Ask the AI assistant"
        />
        <button
          type="button"
          onClick={() => void ask()}
          disabled={pending || gated || !value.trim()}
          aria-label="Send message"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-[#F7CC00] hover:bg-[#E5BB00] text-black transition-colors flex-shrink-0 disabled:opacity-50"
        >
          {pending ? <Loader2 className="w-5 h-5 animate-spin" /> : <SendHorizontal className="w-5 h-5" />}
        </button>
      </div>

      {(turns.length > 0 || pending) && (
        <div
          ref={threadRef}
          className="mt-3 max-h-[45vh] sm:max-h-[380px] overflow-y-auto space-y-3 text-left"
        >
          {turns.map((t, i) => (
            <div key={i} className="rounded-2xl bg-black/60 border border-white/10 p-4">
              <p className="text-sm text-gray-400">{t.question}</p>
              <div className="mt-2 text-[0.95rem] leading-relaxed text-gray-100 whitespace-pre-line">
                {stripMarkdown(t.answer)}
              </div>
              {t.nextStep && (
                <p className="mt-3 text-sm text-[#F7CC00]">{t.nextStep}</p>
              )}
            </div>
          ))}

          {/* The wait happens where the answer will be, not on the button. Corpus hits are instant. */}
          {pending && (
            <div className="rounded-2xl bg-black/60 border border-white/10 p-4">
              <span className="inline-flex gap-1" aria-label="Thinking">
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" />
              </span>
            </div>
          )}

          {/* The gate is a card in the thread, so it reads as the next thing said rather than a wall. */}
          {gated && (
            <div className="rounded-2xl bg-[#F7CC00]/10 border border-[#F7CC00]/40 p-4">
              <p className="text-[0.95rem] text-gray-100">
                That&apos;s the last of the free answers — create a free account and we can keep going.
              </p>
              <button
                type="button"
                onClick={onCta}
                className="mt-3 px-4 py-2 rounded-lg bg-[#F7CC00] hover:bg-[#E5BB00] text-black text-sm font-semibold transition-colors"
              >
                Start free trial
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The corpus is markdown; the card is not. Strips the few constructs the articles actually use. */
function stripMarkdown(md: string): string {
  return md
    // Headings: the card supplies its own hierarchy, so the hashes are noise.
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^[-*]\s+/gm, "• ")
    // Pipe tables (the pricing article) flatten to spaced cells — a real table does not fit a card
    // on a phone, and the separator row is dropped below.
    .replace(/^\|.*\|$/gm, (row) =>
      row.split("|").map((c) => c.trim()).filter(Boolean).join("  ")
    )
    .replace(/^[-\s|:]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
