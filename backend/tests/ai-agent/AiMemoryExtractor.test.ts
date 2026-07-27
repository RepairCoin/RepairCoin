// AI Memory auto-extract (Phase 3): the directive-signal pre-filter (which turns cost a Haiku call)
// and the parse/guard pipeline (confidence gate + intent-only fact filter). No network — parse and
// hasDirectiveSignal are pure; extract() is exercised with a stubbed Anthropic client + spend cap.

import {
  AiMemoryExtractor,
  hasDirectiveSignal,
} from "../../src/domains/AIAgentDomain/services/AiMemoryExtractor";

describe("hasDirectiveSignal — the pre-filter", () => {
  it("fires on standing-instruction language", () => {
    for (const s of [
      "From now on, always confirm the appointment by text.",
      "Never text customers after 8pm.",
      "By default, offer the premium wash.",
      "We decided to stop sending Sunday promos.",
      "I prefer a friendly tone.",
    ]) {
      expect(hasDirectiveSignal(s)).toBe(true);
    }
  });

  it("stays quiet on questions / one-offs / facts (no Haiku call)", () => {
    for (const s of [
      "What's my revenue this month?",
      "Draft an email for the Friday promo.",
      "How many bookings do I have today?",
      "Thanks!",
    ]) {
      expect(hasDirectiveSignal(s)).toBe(false);
    }
  });
});

describe("AiMemoryExtractor.parse — confidence + fact guards", () => {
  const ex = new AiMemoryExtractor({} as any, {} as any);
  const ORIG = process.env.AI_MEMORY_AUTOEXTRACT_MIN_CONFIDENCE;
  afterEach(() => { process.env.AI_MEMORY_AUTOEXTRACT_MIN_CONFIDENCE = ORIG; });

  it("keeps high-confidence standing intent, drops below-threshold", () => {
    process.env.AI_MEMORY_AUTOEXTRACT_MIN_CONFIDENCE = "0.7";
    const out = ex.parse(JSON.stringify([
      { kind: "instruction", content: "Always confirm appointments by text", tags: ["comms"], confidence: 0.9 },
      { kind: "preference", content: "Maybe use a warmer tone", tags: [], confidence: 0.4 },
    ]));
    expect(out).toEqual([
      { kind: "instruction", content: "Always confirm appointments by text", tags: ["comms"], confidence: 0.9 },
    ]);
  });

  it("drops DB-fact-like content even at high confidence (D0)", () => {
    process.env.AI_MEMORY_AUTOEXTRACT_MIN_CONFIDENCE = "0.5";
    const out = ex.parse(JSON.stringify([
      { kind: "decision", content: "Our revenue this month is $12,000", tags: [], confidence: 0.99 },
    ]));
    expect(out).toEqual([]);
  });

  it("defaults an unknown kind to instruction; tolerates prose around the array", () => {
    process.env.AI_MEMORY_AUTOEXTRACT_MIN_CONFIDENCE = "0.5";
    const out = ex.parse('Here you go:\n[{"kind":"nonsense","content":"Prefer eco products","confidence":0.8}]\ndone');
    expect(out).toEqual([{ kind: "instruction", content: "Prefer eco products", tags: [], confidence: 0.8 }]);
  });

  it("returns [] for malformed / non-array / empty", () => {
    expect(ex.parse("not json")).toEqual([]);
    expect(ex.parse('{"kind":"instruction"}')).toEqual([]);
    expect(ex.parse("")).toEqual([]);
  });
});

describe("AiMemoryExtractor.extract — pre-filter short-circuit", () => {
  it("makes NO Haiku call when the owner message has no directive signal", async () => {
    const anthropic = { complete: jest.fn() };
    const spendCap = { recordSpend: jest.fn() };
    const ex = new AiMemoryExtractor(anthropic as any, spendCap as any);
    const out = await ex.extract("shop_1", { ownerMessage: "what's my revenue?" });
    expect(out).toEqual([]);
    expect(anthropic.complete).not.toHaveBeenCalled();
    expect(spendCap.recordSpend).not.toHaveBeenCalled();
  });

  it("calls Haiku + meters cost (with ledger) on a directive turn", async () => {
    const anthropic = {
      complete: jest.fn().mockResolvedValue({
        text: '[{"kind":"instruction","content":"Always upsell the wash","confidence":0.9}]',
        costUsd: 0.0003,
        model: "claude-haiku",
      }),
    };
    const spendCap = { recordSpend: jest.fn().mockResolvedValue(undefined) };
    const ex = new AiMemoryExtractor(anthropic as any, spendCap as any);
    process.env.AI_MEMORY_AUTOEXTRACT_MIN_CONFIDENCE = "0.7";
    const out = await ex.extract("shop_1", { ownerMessage: "From now on always upsell the wash" });
    expect(anthropic.complete).toHaveBeenCalledTimes(1);
    expect(spendCap.recordSpend).toHaveBeenCalledWith(
      "shop_1",
      0.0003,
      expect.objectContaining({ feature: "memory_autoextract", vendor: "anthropic" })
    );
    expect(out).toEqual([{ kind: "instruction", content: "Always upsell the wash", tags: [], confidence: 0.9 }]);
  });

  it("never throws — returns [] when the Haiku call fails", async () => {
    const anthropic = { complete: jest.fn().mockRejectedValue(new Error("api down")) };
    const spendCap = { recordSpend: jest.fn() };
    const ex = new AiMemoryExtractor(anthropic as any, spendCap as any);
    await expect(ex.extract("shop_1", { ownerMessage: "always confirm by text" })).resolves.toEqual([]);
  });
});
