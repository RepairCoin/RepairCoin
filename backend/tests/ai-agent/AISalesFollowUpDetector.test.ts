// backend/tests/ai-agent/AISalesFollowUpDetector.test.ts
//
// The detector is a thin scan-and-dispatch loop — it finds candidate
// conversations and hands each to the handler (the authoritative gate).
// These tests cover the dispatch + the overlap guard + error swallowing.

import { AISalesFollowUpDetector } from "../../src/domains/AIAgentDomain/services/AISalesFollowUpDetector";

const makeMocks = (opts: { candidateIds?: string[]; scanError?: any } = {}) => {
  const candidateIds = opts.candidateIds ?? ["conv_1", "conv_2", "conv_3"];

  const pool = {
    query: opts.scanError
      ? jest.fn().mockRejectedValue(opts.scanError)
      : jest.fn().mockResolvedValue({
          rows: candidateIds.map((id) => ({ conversation_id: id })),
        }),
  };

  const handler = {
    processFollowUp: jest.fn().mockResolvedValue(undefined),
  };

  const detector = new AISalesFollowUpDetector(handler as any, pool as any);
  return { detector, pool, handler };
};

describe("AISalesFollowUpDetector — tick dispatch", () => {
  it("hands every scanned candidate to the handler", async () => {
    const { detector, handler } = makeMocks({
      candidateIds: ["conv_1", "conv_2", "conv_3"],
    });
    await detector.tick();
    expect(handler.processFollowUp).toHaveBeenCalledTimes(3);
    expect(handler.processFollowUp).toHaveBeenCalledWith("conv_1");
    expect(handler.processFollowUp).toHaveBeenCalledWith("conv_2");
    expect(handler.processFollowUp).toHaveBeenCalledWith("conv_3");
  });

  it("does nothing when there are no candidates", async () => {
    const { detector, handler } = makeMocks({ candidateIds: [] });
    await detector.tick();
    expect(handler.processFollowUp).not.toHaveBeenCalled();
  });

  it("swallows a scan failure (never throws)", async () => {
    const { detector, handler } = makeMocks({ scanError: new Error("DB down") });
    await expect(detector.tick()).resolves.toBeUndefined();
    expect(handler.processFollowUp).not.toHaveBeenCalled();
  });

  it("scans only open, non-paused, recently-quiet conversations", async () => {
    const { detector, pool } = makeMocks();
    await detector.tick();
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain("status = 'open'");
    expect(sql).toContain("ai_paused_until");
    expect(sql).toContain("last_message_at");
  });
});

describe("AISalesFollowUpDetector — overlap guard", () => {
  it("skips a tick while the previous one is still running", async () => {
    const { detector, handler } = makeMocks({ candidateIds: ["conv_1"] });
    // A gate the first tick's processFollowUp hangs on. Created upfront so
    // the resolver is real before tick() ever runs.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    handler.processFollowUp.mockReturnValueOnce(gate);

    // tick() sets `running = true` synchronously before its first await,
    // so the second call sees it and no-ops immediately.
    const first = detector.tick();
    const second = detector.tick();
    release();
    await Promise.all([first, second]);

    // Only the first tick's single candidate was processed.
    expect(handler.processFollowUp).toHaveBeenCalledTimes(1);
  });
});

describe("AISalesFollowUpDetector — lifecycle", () => {
  it("start() then stop() does not leave a running timer", () => {
    const { detector } = makeMocks();
    detector.start(60_000);
    detector.stop();
    // A second stop is a harmless no-op.
    expect(() => detector.stop()).not.toThrow();
  });

  it("start() is idempotent", () => {
    const { detector } = makeMocks();
    detector.start(60_000);
    detector.start(60_000); // no-op, no second timer
    detector.stop();
  });
});
