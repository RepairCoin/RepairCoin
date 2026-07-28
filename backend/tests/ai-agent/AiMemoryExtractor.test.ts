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

  // The original vocabulary-matching filter caught only 7 of these 20 — it recognised the formal
  // register of someone dictating a rule and missed the ordinary way people actually talk. A miss is
  // SILENT (nothing saved, nothing said), so these are the cases that made the feature feel broken.
  it("catches ordinary phrasings of a standing rule, not just formal directives", () => {
    for (const s of [
      "Don't mention discounts in my emails.",
      "Please keep campaign emails short.",
      "Stop using emojis in customer messages.",
      "I'd rather you focused on loyalty rewards.",
      "No more corporate speak.",
      "Use a friendly tone from here on.",
      "Keep it under 100 words.",
      "Just so you know, I hate long emails.",
      "Quit recommending bundles — nobody buys them.",
      "Lead with the warranty, not the price.",
      "Sign off as Peanut, not RepairCoin.",
    ]) {
      expect({ s, fires: hasDirectiveSignal(s) }).toEqual({ s, fires: true });
    }
  });

  // Real orchestrate traffic is largely voice-transcribed rambling. These are VERBATIM staging
  // messages that a naive broadening (bare /don't/, bare /i like/) swallows whole — each one would
  // be a paid Haiku call and a chance to store a bogus standing rule.
  it("rejects real voice-transcription noise and applause for the current draft", () => {
    for (const s of [
      "i like it lets send it",
      "I love it. Let's go ahead and send it.",
      "I don't even know if I'm in their target.",
      "I don't know if you can see it on the screen, but the sun is rising.",
      "Laugh out loud. I said flow, not blue, but I guess my English is not that great.",
      "Looks like I don't have any revenue and even last month's. Can we fix this?",
      "Send a campaign to all 4 customers to keep the momentum going",
      "Let's go ahead and make the campaign, whatever you suggest is better to do.",
    ]) {
      expect({ s, fires: hasDirectiveSignal(s) }).toEqual({ s, fires: false });
    }
  });

  // The two rules that make the above work, asserted directly so a future edit can't quietly undo
  // them: a negation must OPEN a clause, and a preference must name a category, not a pronoun.
  it("distinguishes an imperative negation from narrative, and a rule from applause", () => {
    expect(hasDirectiveSignal("Don't use emojis.")).toBe(true);
    expect(hasDirectiveSignal("I don't use emojis much myself.")).toBe(false);
    expect(hasDirectiveSignal("I hate long emails.")).toBe(true);
    expect(hasDirectiveSignal("I love it.")).toBe(false);
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
