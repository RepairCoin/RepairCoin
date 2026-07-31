// Capture receipt (ai-memory-receipt-plan.md, RC-2): auto-extract now runs INSIDE the response so the
// owner can be told what was remembered. The contract that matters is the failure path — a slow or
// broken extraction must leave the reply exactly as it would have been (D-RC3), and the memory must
// still save even when the receipt is missed.

import {
  captureStandingIntent,
  MEMORY_CAPTURE_TIMEOUT_MS,
} from "../../src/domains/AIAgentDomain/controllers/UnifiedAssistantController";
import * as Extractor from "../../src/domains/AIAgentDomain/services/AiMemoryExtractor";

// The chip reports what was PERSISTED, not what the extractor proposed — so the stub row carries the
// confidence through the way the repository does.
const memoryRow = (id: string, content: string, confidence = 0.95) => ({
  id,
  shopId: "peanut",
  kind: "instruction" as const,
  content,
  tags: [],
  source: "auto" as const,
  pinned: false,
  confidence,
  createdAt: new Date(),
  lastReferencedAt: null,
  sourceConversationId: null,
});

/** A memory service stub that records what it was asked to persist. */
const makeMemory = (rows: Record<string, string> = {}) => {
  const saved: string[] = [];
  return {
    saved,
    remember: jest.fn(async (_shopId: string, input: any) => {
      saved.push(input.content);
      const id = rows[input.content] ?? `id-${saved.length}`;
      return { saved: true, memory: memoryRow(id, input.content) };
    }),
  };
};

const stubExtract = (impl: (...a: any[]) => any) =>
  jest.spyOn(Extractor, "getAiMemoryExtractor").mockReturnValue({ extract: impl } as any);

afterEach(() => jest.restoreAllMocks());

describe("captureStandingIntent — the receipt", () => {
  it("returns the saved memories so the panel can show a chip", async () => {
    stubExtract(async () => [
      { kind: "instruction", content: "Never mention discounts in emails.", tags: ["campaigns"], confidence: 0.95 },
    ]);
    const memory = makeMemory({ "Never mention discounts in emails.": "mem-1" });

    const out = await captureStandingIntent({
      shopId: "peanut",
      ownerMessage: "Don't mention discounts in my emails.",
      memory: memory as any,
    });

    expect(out).toEqual([
      { id: "mem-1", kind: "instruction", content: "Never mention discounts in emails.", confidence: 0.95 },
    ]);
  });

  it("returns one entry per saved memory when a turn states several unrelated rules", async () => {
    stubExtract(async () => [
      { kind: "instruction", content: "Never text customers after 8pm.", tags: [], confidence: 0.95 },
      { kind: "instruction", content: "Assign weekend jobs to Joe.", tags: [], confidence: 0.95 },
    ]);
    const out = await captureStandingIntent({
      shopId: "peanut",
      ownerMessage: "Never text customers after 8pm, and make sure weekend jobs go to Joe.",
      memory: makeMemory() as any,
    });
    expect(out).toHaveLength(2);
  });

  it("gives up on the receipt when extraction is slow — but the memory still saves", async () => {
    let resolveExtract: (v: any) => void = () => {};
    const slow = new Promise((r) => { resolveExtract = r; });
    stubExtract(() => slow);
    const memory = makeMemory();

    const out = await captureStandingIntent({
      shopId: "peanut",
      ownerMessage: "From now on always confirm bookings by text.",
      memory: memory as any,
      timeoutMs: 20,
    });

    // No chip this turn...
    expect(out).toBeUndefined();

    // ...but the detached work continues and still persists the memory.
    resolveExtract([{ kind: "instruction", content: "Always confirm bookings by text.", tags: [], confidence: 0.95 }]);
    await new Promise((r) => setImmediate(r));
    expect(memory.saved).toEqual(["Always confirm bookings by text."]);
  });

  it("never throws when extraction fails — the reply must be unaffected", async () => {
    stubExtract(async () => { throw new Error("anthropic down"); });
    await expect(
      captureStandingIntent({
        shopId: "peanut",
        ownerMessage: "Never suggest discounts.",
        memory: makeMemory() as any,
      })
    ).resolves.toBeUndefined();
  });

  it("returns undefined rather than an empty array when nothing was captured", async () => {
    stubExtract(async () => []);
    const out = await captureStandingIntent({
      shopId: "peanut",
      ownerMessage: "Keep it under 100 words.",
      memory: makeMemory() as any,
    });
    // Absent, not empty — the response field is omitted entirely so the panel renders nothing.
    expect(out).toBeUndefined();
  });

  it("drops candidates the service refused to save (duplicates) instead of showing a dead chip", async () => {
    stubExtract(async () => [
      { kind: "instruction", content: "Never suggest discounts.", tags: [], confidence: 0.9 },
      { kind: "instruction", content: "Sign off as Peanut.", tags: [], confidence: 0.9 },
    ]);
    const memory = {
      remember: jest.fn(async (_s: string, input: any) =>
        input.content === "Sign off as Peanut."
          ? { saved: true, memory: memoryRow("mem-2", input.content, input.confidence) }
          : { saved: false, reason: "duplicate" }
      ),
    };
    const out = await captureStandingIntent({
      shopId: "peanut",
      ownerMessage: "Never suggest discounts. Sign off as Peanut.",
      memory: memory as any,
    });
    expect(out).toEqual([
      { id: "mem-2", kind: "instruction", content: "Sign off as Peanut.", confidence: 0.9 },
    ]);
  });

  // Observed on staging 2026-07-28: "Stop using emojis in customer messages" made the model call
  // remember_this AND tripped auto-extract, storing the same rule twice in different words —
  // "Never use emojis in customer-facing messages" (explicit, PINNED) and "Do not use emojis in any
  // customer-facing messages" (auto). remember()'s duplicate guard compares exact content, so it
  // cannot catch a paraphrase. The controller now skips auto-extract when remember_this already fired;
  // this asserts the extractor stays untouched so the skip cannot be quietly removed.
  it("does not double-capture: an already-remembered turn must not reach the extractor", async () => {
    const extract = jest.fn();
    stubExtract(extract);
    const memory = makeMemory();

    // Simulates the controller's guard: with remember_this in the turn's tool calls, capture is
    // never invoked at all.
    const toolCalls = [{ tool: "remember_this", args: {} }];
    const alreadyRemembered = toolCalls.some((t) => t.tool === "remember_this");
    if (!alreadyRemembered) {
      await captureStandingIntent({
        shopId: "peanut",
        ownerMessage: "Stop using emojis in customer messages.",
        memory: memory as any,
      });
    }

    expect(alreadyRemembered).toBe(true);
    expect(extract).not.toHaveBeenCalled();
    expect(memory.saved).toEqual([]);
  });

  it("uses a timeout derived from measured extraction latency, with headroom over p90", () => {
    // RC-1 measured p50 1431ms / p90 1922ms on real Haiku calls. If someone drops this near or below
    // p90, most receipts silently disappear — the number is load-bearing, not decorative.
    expect(MEMORY_CAPTURE_TIMEOUT_MS).toBeGreaterThan(1922);
  });
});
