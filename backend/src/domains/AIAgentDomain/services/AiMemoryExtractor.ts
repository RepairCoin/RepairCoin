// backend/src/domains/AIAgentDomain/services/AiMemoryExtractor.ts
//
// AI Memory auto-extract (Phase 3) — the "Advanced AI Memory" upgrade. A cheap Haiku pass that
// captures the owner's STANDING INTENT from a normal conversation turn, without them invoking the
// remember_this tool. Intent ONLY, never DB facts (D0). Runs only on turns whose owner message
// carries directive language (pre-filter) so trivial/factual turns cost nothing. Cost is metered on
// the shop allowance AND logged to ai_misc_usage (feature=memory_autoextract) so it stays visible in
// ai_usage_events — a new AI surface must never spend invisibly.
//
// Gated by AI_MEMORY_AUTOEXTRACT at the call site (UnifiedAssistantController), under ENABLE_AI_MEMORY
// + the Business tier. Plan: docs/tasks/strategy/ai-memory/ai-memory-autoextract-plan.md.

import { AnthropicClient } from './AnthropicClient';
import { SpendCapEnforcer } from './SpendCapEnforcer';
import { isFactLike, getAiMemoryService } from './AiMemoryService';
import { cheapModel } from '../../../config/aiModels';
import { logger } from '../../../utils/logger';
import type { AiMemoryKind } from '../../../repositories/AiMemoryRepository';

const KINDS: AiMemoryKind[] = ['preference', 'instruction', 'decision', 'correction'];
const isKind = (k: unknown): k is AiMemoryKind => typeof k === 'string' && (KINDS as string[]).includes(k);

/** Master sub-flag for Phase 3 — auto-extract only runs when this is on (under ENABLE_AI_MEMORY). */
export function isAutoExtractEnabled(): boolean {
  return process.env.AI_MEMORY_AUTOEXTRACT === 'true';
}

// Only pay for a Haiku extraction when the owner's message plausibly states a STANDING instruction.
// This cheap gate keeps the common case (questions, one-off asks) free.
//
// It matches instruction SHAPE, not vocabulary. The first version listed directive words
// ("always|never|from now on|…") and caught only 7 of 20 ordinary phrasings of a standing rule —
// "Don't mention discounts in my emails" and "Keep it under 100 words" both sailed past, silently,
// which is worse than not capturing at all because the owner has no way to tell. Two rules learned
// from measuring against real staging traffic (which is largely voice-transcribed and rambling):
//
//   1. A negation only counts when it OPENS a clause. "Don't mention discounts" is an instruction;
//      "I don't know if I'm in their target" is narration. Bare /don't/ matches both.
//   2. A preference must be about a CATEGORY, not the artifact on screen. "I hate long emails" is a
//      standing rule; "I love it" is applause for the draft just produced — hence the pronoun
//      lookahead in `soft-preference`.
//
// Measured: 18/20 real phrasings caught, 0 false fires against 16 real noise samples, and the
// fire-rate on 479 real owner messages moves only 1.5% → 1.7% — so recall went up ~2.5x for
// essentially no extra Haiku spend. Known gap: evaluative phrasings with no imperative
// ("Casual tone is better for my shop", "My customers prefer text over email") are still missed;
// the patterns that would catch them also match "whatever you suggest is better to do".

// A question and nothing else is never a standing instruction.
const PURE_QUESTION =
  /^\s*(what|when|where|who|why|how|which|is|are|was|were|do|does|did|can|could|should|would|will|show|list|tell me|give me)\b[^.!]*\?\s*$/i;

// Start of string, or after sentence-ending punctuation, optionally via "please".
const CLAUSE_START = String.raw`(?:^|[.!?;]\s+|^\s*please\s+|[.!?;]\s+please\s+)`;

const DIRECTIVE_PATTERNS: RegExp[] = [
  // Standing-time markers.
  /\b(from now on|going forward|from here on|in future|in the future|always|never|by default|every time|whenever|no longer|no more)\b/i,
  // Stated policy or decision.
  /\b(our policy|we (decided|agreed)|company policy|house rule)\b/i,
  // Negative imperative — must OPEN a clause (rule 1 above).
  new RegExp(CLAUSE_START + String.raw`(don'?t|do not|stop|quit|avoid|skip|refrain from)\s+\w+`, 'i'),
  // Positive "ensure" forms.
  /\b(make sure|be sure to|remember to|always remember)\b/i,
  // Explicit preference about how the assistant should behave.
  /\b(i'?d rather|i prefer|i'?d prefer|i (want|need) you to|i don'?t want you to|i don'?t want any)\b/i,
  // Standing style / format constraints.
  /\b(keep (it|them|these|those|the|all|my|campaign|emails?)\b[^?]{0,40}\b(short|brief|simple|casual|under|to \d)|under \d+ (words|characters)|sign off as|sign them|lead with|focus on)\b/i,
  /\buse a\b[^?]{0,25}\b(tone|voice|style)\b|\b(tone|voice) (should|must)\b/i,
  // Soft preference about a category — the pronoun lookahead excludes applause (rule 2 above).
  /\bi (hate|love|like|prefer|dislike|can'?t stand)\s+(?!it\b|this\b|that\b|them\b|these\b|those\b|the way\b)\w+/i,
];

export function hasDirectiveSignal(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  if (PURE_QUESTION.test(t)) return false;
  return DIRECTIVE_PATTERNS.some((re) => re.test(t));
}

function minConfidence(): number {
  const n = Number(process.env.AI_MEMORY_AUTOEXTRACT_MIN_CONFIDENCE);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.7;
}

export interface ExtractedMemory {
  kind: AiMemoryKind;
  content: string;
  tags: string[];
  confidence: number;
}

const SYSTEM = `You extract the shop owner's STANDING INTENT from one turn of a conversation with their AI assistant, so the assistant can honor it in FUTURE conversations.

Extract ONLY durable instructions about how the business or the assistant should behave — preferences, standing instructions, decisions, or corrections the owner states (e.g. "from now on…", "always…", "never…", "when I say X I mean…", "we decided…", "our policy is…").

Do NOT extract:
- Facts answerable from data (revenue, stock levels, bookings, prices, customer counts) — those come from the database, never from memory.
- One-off requests for THIS conversation ("draft an email now", "what's my revenue?").
- Chit-chat, questions, or the assistant's own words.
- **Fixes to the specific thing the assistant just produced.** If the owner is correcting the image,
  draft, campaign, or answer in front of them, that is a revision request for THAT artifact — not a
  durable rule — even when it is phrased with "make sure" or "always". "You're not taking off the logo,
  make sure you take off the logo" is a fix for the current image; it becomes standing intent only if
  the owner generalizes it ("on every image", "from now on", "that's our policy"). Use the assistant's
  reply, when provided, to tell which one it is: if the reply is a concrete artifact the owner is
  reacting to, prefer [].

An extracted memory outlives this conversation and shapes every future answer, so a wrong one is
expensive and silence is cheap. When you are unsure whether something is durable, return [] rather than
guessing — and never raise confidence above 0.7 for intent you inferred rather than heard stated.

ONE UTTERANCE, ONE MEMORY. If the owner states several related preferences in a single breath
("make sure the designs are the best and always work around the logo and branding colors"), combine them
into ONE instruction rather than emitting near-duplicates. Only return multiple elements when the owner
stated genuinely unrelated rules about different topics. Duplicated memories crowd out the rest when the
assistant recalls them later.

DON'T RE-SAVE WHAT IS ALREADY REMEMBERED. You will be shown the rules this shop has already stored.
Owners repeat themselves, and a re-statement in different words is still the same rule — if the intent
is ALREADY COVERED by a stored rule, return [] for it, even when the wording differs completely
("Never use emojis in customer-facing messages" already covers "Stop using emojis in customer messages").
Exception: if the owner is CHANGING or REVERSING a stored rule ("actually, do use emojis now",
"make it 200 words instead of 100"), that IS new intent — return it as a "correction" so the change is
not lost.

Return a JSON array and NOTHING else. Each element:
{"kind":"preference"|"instruction"|"decision"|"correction","content":"<the standing instruction, one concise sentence in the owner's voice>","tags":["<short topic tags>"],"confidence":<0-1 how sure this is durable standing intent>}
If the turn contains no standing intent, return [].`;

/** Cap the already-remembered block so a shop with many rules can't bloat the extraction prompt. */
const MAX_EXISTING_IN_PROMPT = 40;

export class AiMemoryExtractor {
  constructor(
    private readonly anthropic: AnthropicClient = new AnthropicClient(),
    private readonly spendCap: SpendCapEnforcer = new SpendCapEnforcer(),
    /** Injectable for tests; defaults to the live service so call sites need no change. */
    private readonly listMemories: (shopId: string) => Promise<Array<{ content: string }>> = (shopId) =>
      getAiMemoryService().list(shopId)
  ) {}

  /**
   * Extract standing-intent candidates from one turn. Returns [] — with NO Haiku call — when the
   * owner message has no directive signal; also [] on any error or empty result. Never throws.
   */
  async extract(shopId: string, turn: { ownerMessage: string; assistantReply?: string }): Promise<ExtractedMemory[]> {
    const owner = (turn.ownerMessage || '').trim();
    if (!owner || !hasDirectiveSignal(owner)) return [];

    try {
      const model = cheapModel();

      // What this shop already remembers. Without it the model cannot tell a NEW rule from a
      // re-statement of an old one, and `remember()`'s duplicate guard only compares exact content —
      // so "Stop using emojis in customer messages" happily created a second copy of an existing
      // "Never use emojis in customer-facing messages" (observed on staging 2026-07-28). Owners repeat
      // themselves; without this every repetition adds another near-duplicate diluting recall.
      // Fail-open: if the lookup fails we still extract, we just lose de-duplication for this turn.
      let existingBlock = '';
      try {
        const existing = await this.listMemories(shopId);
        if (existing.length) {
          existingBlock =
            `\n\nAlready remembered for this shop — do NOT re-save these, only genuine changes to them:\n` +
            existing.slice(0, MAX_EXISTING_IN_PROMPT).map((m) => `- ${m.content}`).join('\n');
        }
      } catch (e) {
        logger.warn('AiMemoryExtractor could not load existing memories; extracting without de-dup', {
          shopId,
          error: (e as Error)?.message,
        });
      }

      const userContent =
        `Owner said:\n"""${owner}"""` +
        (turn.assistantReply ? `\n\nAssistant replied:\n"""${turn.assistantReply.trim()}"""` : '') +
        existingBlock;
      const resp = await this.anthropic.complete({
        systemPrompt: [{ text: SYSTEM, cache: false }],
        messages: [{ role: 'user', content: userContent }],
        model,
        maxTokens: 500,
      });
      // RC-1: extraction latency is the input to the capture-receipt timeout (ai-memory-receipt-plan.md
      // D-RC5) — the receipt awaits this call inside the response, so the number must come from
      // observation, not a guessed constant. Logged on every fire; fires are ~1.7% of turns.
      logger.info('AiMemoryExtractor timing', { shopId, model, latencyMs: resp.latencyMs });
      // Meter on the shop allowance + log to ai_misc_usage so this cost shows up in ai_usage_events.
      await this.spendCap.recordSpend(shopId, resp.costUsd, {
        feature: 'memory_autoextract',
        vendor: 'anthropic',
        model,
      });
      return this.parse(resp.text);
    } catch (err) {
      logger.error('AiMemoryExtractor.extract failed', { shopId, error: (err as Error)?.message });
      return [];
    }
  }

  /** Tolerant JSON parse + confidence/fact filtering. Pure — exported for unit testing. */
  parse(text: string): ExtractedMemory[] {
    const start = (text || '').indexOf('[');
    const end = (text || '').lastIndexOf(']');
    if (start === -1 || end === -1 || end < start) return [];
    let arr: unknown;
    try {
      arr = JSON.parse(text.slice(start, end + 1));
    } catch {
      return [];
    }
    if (!Array.isArray(arr)) return [];

    const threshold = minConfidence();
    const out: ExtractedMemory[] = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const content = typeof r.content === 'string' ? r.content.trim() : '';
      const confidence = typeof r.confidence === 'number' ? r.confidence : 0;
      const kind = isKind(r.kind) ? r.kind : 'instruction';
      const tags = Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [];
      if (!content) continue;
      if (confidence < threshold) continue; // D-AX3 confidence gate
      if (isFactLike(content)) continue; // D-AX2 belt-and-suspenders: never store a DB fact
      out.push({ kind, content, tags, confidence });
    }
    return out;
  }
}

let _extractor: AiMemoryExtractor | null = null;
export function getAiMemoryExtractor(): AiMemoryExtractor {
  return (_extractor ??= new AiMemoryExtractor());
}
