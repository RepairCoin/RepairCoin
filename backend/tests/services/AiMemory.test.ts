// backend/tests/services/AiMemory.test.ts
//
// Unit tests for AI Memory (Phase 1): the pure ranking/guard helpers + the
// AiMemoryService flag-gating and write rules. No DB — the service is exercised
// with a fake repository injected through its constructor.

import {
  AiMemoryService,
  rankMemories,
  tokenize,
  isFactLike,
} from "../../src/domains/AIAgentDomain/services/AiMemoryService";
import type {
  AiMemory,
  CreateAiMemoryInput,
} from "../../src/repositories/AiMemoryRepository";

function mk(partial: Partial<AiMemory>): AiMemory {
  return {
    id: partial.id ?? "id-" + Math.random().toString(36).slice(2),
    shopId: partial.shopId ?? "shop1",
    scope: partial.scope ?? "shop",
    kind: partial.kind ?? "instruction",
    customerId: partial.customerId ?? null,
    content: partial.content ?? "",
    tags: partial.tags ?? [],
    source: partial.source ?? "explicit",
    pinned: partial.pinned ?? false,
    sourceConversationId: partial.sourceConversationId ?? null,
    confidence: partial.confidence ?? null,
    lastReferencedAt: partial.lastReferencedAt ?? null,
    createdAt: partial.createdAt ?? new Date("2026-01-01T00:00:00Z"),
  };
}

/** Minimal in-memory fake of AiMemoryRepository. */
class FakeRepo {
  rows: AiMemory[] = [];
  touched: string[] = [];
  async listActive(shopId: string): Promise<AiMemory[]> {
    return this.rows.filter((r) => r.shopId === shopId);
  }
  async create(input: CreateAiMemoryInput): Promise<AiMemory> {
    const m = mk({ ...input, id: "new-" + this.rows.length });
    this.rows.push(m);
    return m;
  }
  async touch(ids: string[]): Promise<void> {
    this.touched.push(...ids);
  }
  async softDelete(): Promise<boolean> {
    return true;
  }
  async purgeStale(): Promise<number> {
    return 0;
  }
}

function svcWith(repo: FakeRepo): AiMemoryService {
  return new AiMemoryService(repo as any);
}

describe("AI Memory — pure helpers", () => {
  it("tokenize keeps words of length >= 3, lowercased", () => {
    expect(tokenize("Never suggest a DISCOUNT")).toEqual([
      "never",
      "suggest",
      "discount",
    ]);
  });

  it("isFactLike flags DB-answerable phrasings, passes standing intent", () => {
    expect(isFactLike("What was my revenue last week?")).toBe(true);
    expect(isFactLike("how many screens are in stock")).toBe(true);
    expect(isFactLike("")).toBe(true);
    expect(isFactLike("Never suggest discounts in campaigns")).toBe(false);
    expect(isFactLike("Address me as Coach")).toBe(false);
  });

  it("rankMemories prefers keyword overlap, then pinned, then recency", () => {
    const relevant = mk({ content: "Never suggest discounts in campaigns", tags: ["campaigns"] });
    const pinnedOld = mk({ content: "Address me as Coach", pinned: true, createdAt: new Date("2025-01-01") });
    const recentUnpinned = mk({ content: "Use a friendly tone", createdAt: new Date("2026-06-01") });

    const ranked = rankMemories([pinnedOld, recentUnpinned, relevant], "draft a campaign with discounts", 3);
    expect(ranked[0]).toBe(relevant); // overlap wins
    expect(ranked[1]).toBe(pinnedOld); // then pinned
    expect(ranked[2]).toBe(recentUnpinned);
  });

  it("rankMemories caps at k", () => {
    const ms = [mk({ content: "a" }), mk({ content: "b" }), mk({ content: "c" })];
    expect(rankMemories(ms, "", 2)).toHaveLength(2);
  });
});

describe("AiMemoryService — flag gating", () => {
  const prev = process.env.ENABLE_AI_MEMORY;
  afterEach(() => {
    if (prev === undefined) delete process.env.ENABLE_AI_MEMORY;
    else process.env.ENABLE_AI_MEMORY = prev;
  });

  it("recall returns [] and does NOT touch the DB when the flag is off", async () => {
    delete process.env.ENABLE_AI_MEMORY;
    const repo = new FakeRepo();
    repo.rows = [mk({ content: "Never suggest discounts" })];
    const out = await svcWith(repo).recall("shop1", { hint: "discounts" });
    expect(out).toEqual([]);
    expect(repo.touched).toEqual([]);
  });

  it("remember is a no-op when the flag is off", async () => {
    delete process.env.ENABLE_AI_MEMORY;
    const repo = new FakeRepo();
    const r = await svcWith(repo).remember("shop1", { kind: "instruction", content: "Never suggest discounts" });
    expect(r.saved).toBe(false);
    expect(r.reason).toBe("disabled");
    expect(repo.rows).toHaveLength(0);
  });
});

describe("AiMemoryService — enabled behavior", () => {
  const prev = process.env.ENABLE_AI_MEMORY;
  beforeEach(() => { process.env.ENABLE_AI_MEMORY = "true"; });
  afterEach(() => {
    if (prev === undefined) delete process.env.ENABLE_AI_MEMORY;
    else process.env.ENABLE_AI_MEMORY = prev;
  });

  it("recall ranks active memories and touches the returned ids", async () => {
    const repo = new FakeRepo();
    const a = mk({ id: "a", content: "Never suggest discounts in campaigns", tags: ["campaigns"] });
    const b = mk({ id: "b", content: "Use a friendly tone" });
    repo.rows = [a, b];
    const out = await svcWith(repo).recall("shop1", { hint: "campaign discounts", limit: 1 });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("a");
    expect(repo.touched).toEqual(["a"]);
  });

  it("remember saves valid intent and pins explicit memories", async () => {
    const repo = new FakeRepo();
    const r = await svcWith(repo).remember("shop1", {
      kind: "instruction",
      content: "Never suggest discounts",
      tags: ["Campaigns"],
    });
    expect(r.saved).toBe(true);
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0].pinned).toBe(true); // explicit → pinned
    expect(repo.rows[0].tags).toEqual(["campaigns"]); // lowercased
  });

  it("remember rejects empty, fact-like, and duplicate content", async () => {
    const repo = new FakeRepo();
    const s = svcWith(repo);

    expect((await s.remember("shop1", { kind: "instruction", content: "   " })).reason).toBe("empty");
    expect((await s.remember("shop1", { kind: "instruction", content: "What was my revenue?" })).reason).toBe("looks_like_fact");

    await s.remember("shop1", { kind: "instruction", content: "Never suggest discounts" });
    const dup = await s.remember("shop1", { kind: "instruction", content: "never suggest discounts" });
    expect(dup.saved).toBe(false);
    expect(dup.reason).toBe("duplicate");
  });
});
