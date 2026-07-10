// backend/src/domains/AIAgentDomain/services/AiMemoryService.ts
//
// AI Memory (Phase 1) — the unified assistant's recall/write of the shop owner's
// STANDING INTENT (preferences/instructions/decisions/corrections). NOT facts the
// DB already holds (D0): those come from the assistant's data tools, so storing
// them here would be redundant + go stale. Gated by ENABLE_AI_MEMORY (default off).
//
// Read path: recall() → ranked top-K injected into the orchestrator system prompt.
// Write path: remember() ← the `remember_this` orchestrator tool.
// See docs/tasks/strategy/ai-memory/.

import {
  AiMemory,
  AiMemoryKind,
  AiMemoryRepository,
  AiMemorySource,
} from '../../../repositories/AiMemoryRepository';
import { logger } from '../../../utils/logger';

/** Master flag — when off, every method is a no-op and no DB call is made. */
export function isAiMemoryEnabled(): boolean {
  return process.env.ENABLE_AI_MEMORY === 'true';
}

function envInt(name: string, fallback: number): number {
  const n = parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const TOP_K = () => envInt('AI_MEMORY_TOP_K', 6);
const STALE_DAYS = () => envInt('AI_MEMORY_STALE_DAYS', 180);

/** Split text into lowercased word tokens (length ≥ 3) for overlap scoring. */
export function tokenize(text: string): string[] {
  return (text || '').toLowerCase().match(/[a-z0-9]+/g)?.filter((t) => t.length >= 3) ?? [];
}

/**
 * Defensive guard (D0): reject obvious DB-answerable FACT phrasings. Memory is for
 * INTENT, not data facts the tools already provide. Heuristic only — the tool
 * description is the primary guard; this catches the worst misuse.
 */
export function isFactLike(content: string): boolean {
  const t = (content || '').toLowerCase().trim();
  if (!t) return true;
  if (/^(what|how much|how many|when|who|show me|list|tell me|give me)\b/.test(t)) return true;
  if (/\b(revenue|sales figures?|in stock|stock level|how many .* (do|are)|current balance|bookings today)\b/.test(t)) return true;
  return false;
}

/**
 * Pure ranking: keyword/tag overlap with the hint, then pinned, then recency.
 * Exported for unit testing. Small sets → in-memory sort is fine.
 */
export function rankMemories(memories: AiMemory[], hint: string, k: number): AiMemory[] {
  const hintTokens = new Set(tokenize(hint));
  const scored = memories.map((m) => {
    const memTokens = new Set([...tokenize(m.content), ...m.tags.flatMap((tag) => tokenize(tag))]);
    let overlap = 0;
    for (const tok of memTokens) if (hintTokens.has(tok)) overlap++;
    return { m, overlap };
  });
  scored.sort((a, b) => {
    if (b.overlap !== a.overlap) return b.overlap - a.overlap;
    if (a.m.pinned !== b.m.pinned) return a.m.pinned ? -1 : 1;
    const at = new Date((a.m.lastReferencedAt ?? a.m.createdAt) as any).getTime();
    const bt = new Date((b.m.lastReferencedAt ?? b.m.createdAt) as any).getTime();
    return bt - at;
  });
  return scored.slice(0, Math.max(1, k)).map((s) => s.m);
}

/**
 * Render recalled memories as a system-prompt block. Shared by every AI surface
 * that injects memory (unified assistant, marketing chat, ads lead auto-answer)
 * so the framing is identical everywhere. Intent, NOT data — the wording tells
 * the model not to cite them as metrics.
 */
export function formatMemoryBlock(memories: AiMemory[]): string {
  const lines = memories.map((m) => `- [${m.kind}] ${m.content.trim()}`).join('\n');
  return `# OWNER PREFERENCES & STANDING INSTRUCTIONS
The owner has asked you to remember these and honor them in your reasoning, recommendations, drafts, and replies. They are standing instructions, NOT data — never cite them as metrics or figures.
${lines}`;
}

export interface RememberInput {
  kind: AiMemoryKind;
  content: string;
  tags?: string[];
  source?: AiMemorySource;
  conversationId?: string | null;
}

export interface RememberResult {
  saved: boolean;
  reason?: 'disabled' | 'empty' | 'looks_like_fact' | 'duplicate';
  memory?: AiMemory;
}

export class AiMemoryService {
  constructor(private readonly repo: AiMemoryRepository = new AiMemoryRepository()) {}

  /** Persist a piece of standing owner intent. No-op when the flag is off. */
  async remember(shopId: string, input: RememberInput): Promise<RememberResult> {
    if (!isAiMemoryEnabled()) return { saved: false, reason: 'disabled' };
    const content = (input.content || '').trim();
    if (!content) return { saved: false, reason: 'empty' };
    const source = input.source ?? 'explicit';
    // Only guard against fact-like content on the explicit (owner-typed) path;
    // auto-extract (phase 3) does its own intent-only filtering upstream.
    if (source === 'explicit' && isFactLike(content)) return { saved: false, reason: 'looks_like_fact' };

    const existing = await this.repo.listActive(shopId);
    const norm = content.toLowerCase();
    if (existing.some((m) => m.content.trim().toLowerCase() === norm)) {
      return { saved: false, reason: 'duplicate' };
    }

    const memory = await this.repo.create({
      shopId,
      kind: input.kind,
      content,
      tags: (input.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean),
      source,
      // Owner-stated intent is durable: pin explicit memories so they're exempt
      // from auto-aging (Q2). Auto-extracted (phase 3) memories stay unpinned.
      pinned: source === 'explicit',
      sourceConversationId: input.conversationId ?? null,
    });
    return { saved: true, memory };
  }

  /** Top-K memories to inject into the prompt for this turn. Fail-open → []. */
  async recall(shopId: string, opts: { hint?: string; limit?: number } = {}): Promise<AiMemory[]> {
    if (!isAiMemoryEnabled()) return [];
    try {
      const all = await this.repo.listActive(shopId);
      if (all.length === 0) return [];
      const top = rankMemories(all, opts.hint ?? '', opts.limit ?? TOP_K());
      await this.repo.touch(top.map((m) => m.id));
      return top;
    } catch (err) {
      logger.warn('AiMemoryService.recall failed — running without memory', {
        shopId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /**
   * Convenience for any AI surface: recall the top-K memories and return them
   * already formatted as a prompt block, or null when there's nothing (or the
   * flag is off). One call to inject memory into a system prompt.
   */
  async recallBlock(shopId: string, hint?: string): Promise<string | null> {
    const mems = await this.recall(shopId, { hint });
    return mems.length ? formatMemoryBlock(mems) : null;
  }

  /** Full list for the settings UI (Phase 2). */
  async list(shopId: string): Promise<AiMemory[]> {
    if (!isAiMemoryEnabled()) return [];
    return this.repo.listActive(shopId);
  }

  /** Edit an existing memory (settings UI). No-op when the flag is off. */
  async update(
    shopId: string,
    id: string,
    fields: { content?: string; tags?: string[]; pinned?: boolean }
  ): Promise<AiMemory | null> {
    if (!isAiMemoryEnabled()) return null;
    const patch: { content?: string; tags?: string[]; pinned?: boolean } = {};
    if (fields.content !== undefined) {
      const content = fields.content.trim();
      if (!content) return null;
      patch.content = content;
    }
    if (fields.tags !== undefined) {
      patch.tags = fields.tags.map((t) => t.toLowerCase().trim()).filter(Boolean);
    }
    if (fields.pinned !== undefined) patch.pinned = fields.pinned;
    return this.repo.update(id, shopId, patch);
  }

  async forget(shopId: string, id: string): Promise<boolean> {
    if (!isAiMemoryEnabled()) return false;
    return this.repo.softDelete(id, shopId);
  }

  /** Nightly aging of auto/unpinned, never-referenced memories (Phase 6). */
  async purgeStale(): Promise<number> {
    if (!isAiMemoryEnabled()) return 0;
    return this.repo.purgeStale(STALE_DAYS());
  }
}

let _svc: AiMemoryService | null = null;
export function getAiMemoryService(): AiMemoryService {
  if (!_svc) _svc = new AiMemoryService();
  return _svc;
}
