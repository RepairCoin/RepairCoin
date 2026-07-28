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
import { isFactLike } from './AiMemoryService';
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
const DIRECTIVE_SIGNALS =
  /\b(from now on|going forward|always|never|by default|make sure|remember to|don'?t ever|stop (doing|sending)|i (prefer|want you to|don'?t want)|we (decided|agreed)|our policy|whenever|every time|no longer)\b/i;

export function hasDirectiveSignal(text: string): boolean {
  return DIRECTIVE_SIGNALS.test(text || '');
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

Return a JSON array and NOTHING else. Each element:
{"kind":"preference"|"instruction"|"decision"|"correction","content":"<the standing instruction, one concise sentence in the owner's voice>","tags":["<short topic tags>"],"confidence":<0-1 how sure this is durable standing intent>}
If the turn contains no standing intent, return [].`;

export class AiMemoryExtractor {
  constructor(
    private readonly anthropic: AnthropicClient = new AnthropicClient(),
    private readonly spendCap: SpendCapEnforcer = new SpendCapEnforcer()
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
      const userContent =
        `Owner said:\n"""${owner}"""` +
        (turn.assistantReply ? `\n\nAssistant replied:\n"""${turn.assistantReply.trim()}"""` : '');
      const resp = await this.anthropic.complete({
        systemPrompt: [{ text: SYSTEM, cache: false }],
        messages: [{ role: 'user', content: userContent }],
        model,
        maxTokens: 500,
      });
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
