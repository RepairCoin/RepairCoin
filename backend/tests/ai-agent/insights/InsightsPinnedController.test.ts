// backend/tests/ai-agent/insights/InsightsPinnedController.test.ts
//
// Mock-pool tests for the Phase 7.3 saved-queries CRUD controller.
// Verifies auth (401), validation (400), shop-scoping in every SQL
// statement, idempotent create (no dup on same text), pin cap (409),
// and the dedicated PUT-run path.

import { makeInsightsPinnedController } from "../../../src/domains/AIAgentDomain/controllers/InsightsPinnedController";
import type { Pool } from "pg";

type CapturedQuery = { sql: string; params: unknown[] };

const makeMockPool = (responses: Array<{ rows: any[]; rowCount?: number }>) => {
  const captured: CapturedQuery[] = [];
  const remaining = [...responses];
  const query = jest.fn((sql: string, params?: unknown[]) => {
    captured.push({ sql, params: params ?? [] });
    return Promise.resolve(remaining.shift() ?? { rows: [], rowCount: 0 });
  });
  return { pool: { query } as unknown as Pool, captured, query };
};

const makeReq = (opts: { user?: any; body?: any; params?: any } = {}) =>
  ({
    user: opts.user ?? {},
    body: opts.body ?? {},
    params: opts.params ?? {},
  }) as any;

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const aRow = (overrides: Partial<{
  id: string;
  question_text: string;
  pinned_at: Date;
  last_run_at: Date | null;
  last_response_excerpt: string | null;
  display_order: number;
}> = {}) => ({
  id: "row-1",
  question_text: "How much did I earn this month?",
  pinned_at: new Date("2026-05-22T10:00:00Z"),
  last_run_at: null,
  last_response_excerpt: null,
  display_order: 0,
  ...overrides,
});

describe("InsightsPinnedController", () => {
  describe("listPinned", () => {
    it("401 when no shopId on req.user", async () => {
      const mock = makeMockPool([]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      const res = makeRes();
      await ctrl.listPinned(makeReq(), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("returns DTOs ordered by display_order then pinned_at DESC", async () => {
      const mock = makeMockPool([{ rows: [aRow(), aRow({ id: "row-2" })] }]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      const res = makeRes();
      await ctrl.listPinned(makeReq({ user: { shopId: "peanut" } }), res);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { pinned: expect.arrayContaining([
          expect.objectContaining({ id: "row-1" }),
          expect.objectContaining({ id: "row-2" }),
        ]) },
      });
      expect(mock.captured[0].sql).toMatch(
        /ORDER BY display_order ASC, pinned_at DESC/
      );
      expect(mock.captured[0].params).toEqual(["peanut"]);
    });

    it("dates are serialized as ISO strings", async () => {
      const pinnedAt = new Date("2026-05-22T10:00:00Z");
      const lastRun = new Date("2026-05-22T12:00:00Z");
      const mock = makeMockPool([
        { rows: [aRow({ pinned_at: pinnedAt, last_run_at: lastRun })] },
      ]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      const res = makeRes();
      await ctrl.listPinned(makeReq({ user: { shopId: "peanut" } }), res);
      const body = res.json.mock.calls[0][0];
      expect(body.data.pinned[0].pinnedAt).toBe(pinnedAt.toISOString());
      expect(body.data.pinned[0].lastRunAt).toBe(lastRun.toISOString());
    });
  });

  describe("createPinned", () => {
    it("400 when questionText missing or non-string", async () => {
      const mock = makeMockPool([]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      let res = makeRes();
      await ctrl.createPinned(
        makeReq({ user: { shopId: "peanut" }, body: {} }),
        res
      );
      expect(res.status).toHaveBeenCalledWith(400);

      res = makeRes();
      await ctrl.createPinned(
        makeReq({ user: { shopId: "peanut" }, body: { questionText: 123 } }),
        res
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("400 on empty / whitespace-only questionText", async () => {
      const mock = makeMockPool([]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      const res = makeRes();
      await ctrl.createPinned(
        makeReq({ user: { shopId: "peanut" }, body: { questionText: "   " } }),
        res
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("400 on questionText > 2000 chars", async () => {
      const mock = makeMockPool([]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      const res = makeRes();
      await ctrl.createPinned(
        makeReq({
          user: { shopId: "peanut" },
          body: { questionText: "x".repeat(2001) },
        }),
        res
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns existing row when (shop, text) duplicate", async () => {
      // Sequence: COUNT(0), SELECT existing returns 1 row.
      const mock = makeMockPool([
        { rows: [{ n: "5" }] },
        { rows: [aRow({ id: "existing-id" })] },
      ]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      const res = makeRes();
      await ctrl.createPinned(
        makeReq({
          user: { shopId: "peanut" },
          body: { questionText: "How much did I earn this month?" },
        }),
        res
      );
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ id: "existing-id" }),
      });
      // No INSERT — only COUNT + SELECT existing.
      expect(mock.captured.length).toBe(2);
      expect(mock.captured[1].sql).toMatch(/SELECT/);
    });

    it("inserts when not a duplicate; returns 201", async () => {
      const mock = makeMockPool([
        { rows: [{ n: "3" }] }, // count
        { rows: [] }, // no dedupe row
        { rows: [aRow({ id: "new-id" })] }, // INSERT RETURNING
      ]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      const res = makeRes();
      await ctrl.createPinned(
        makeReq({
          user: { shopId: "peanut" },
          body: { questionText: "Top customers this month" },
        }),
        res
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ id: "new-id" }),
      });
      const insertCall = mock.captured[2];
      expect(insertCall.sql).toMatch(/INSERT INTO ai_insights_pinned_queries/);
      expect(insertCall.params).toEqual(["peanut", "Top customers this month"]);
    });

    it("trims whitespace before checking dedupe / inserting", async () => {
      const mock = makeMockPool([
        { rows: [{ n: "0" }] },
        { rows: [] },
        { rows: [aRow()] },
      ]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      const res = makeRes();
      await ctrl.createPinned(
        makeReq({
          user: { shopId: "peanut" },
          body: { questionText: "  Top customers this week  " },
        }),
        res
      );
      // INSERT param should be trimmed.
      expect(mock.captured[2].params[1]).toBe("Top customers this week");
    });

    it("409 when shop has hit the pin cap (50)", async () => {
      const mock = makeMockPool([{ rows: [{ n: "50" }] }]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      const res = makeRes();
      await ctrl.createPinned(
        makeReq({
          user: { shopId: "peanut" },
          body: { questionText: "yet another" },
        }),
        res
      );
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/Pin limit reached/),
        })
      );
    });
  });

  describe("deletePinned", () => {
    it("404 when shop's row doesn't exist", async () => {
      const mock = makeMockPool([{ rows: [], rowCount: 0 }]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      const res = makeRes();
      await ctrl.deletePinned(
        makeReq({ user: { shopId: "peanut" }, params: { id: "fake-uuid" } }),
        res
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("shop-scopes the DELETE via WHERE shop_id = $2", async () => {
      const mock = makeMockPool([{ rows: [], rowCount: 1 }]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      const res = makeRes();
      await ctrl.deletePinned(
        makeReq({ user: { shopId: "peanut" }, params: { id: "row-1" } }),
        res
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(mock.captured[0].sql).toMatch(
        /DELETE FROM ai_insights_pinned_queries[\s\S]*WHERE id = \$1 AND shop_id = \$2/
      );
      expect(mock.captured[0].params).toEqual(["row-1", "peanut"]);
    });
  });

  describe("recordRun", () => {
    it("UPDATEs last_run_at + truncated excerpt; shop-scoped", async () => {
      const mock = makeMockPool([{ rows: [], rowCount: 1 }]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      const res = makeRes();
      await ctrl.recordRun(
        makeReq({
          user: { shopId: "peanut" },
          params: { id: "row-1" },
          body: { excerpt: "Your shop made $2,117.00 this week." },
        }),
        res
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(mock.captured[0].sql).toMatch(
        /UPDATE ai_insights_pinned_queries[\s\S]*SET last_run_at = NOW\(\), last_response_excerpt = \$1[\s\S]*WHERE id = \$2 AND shop_id = \$3/
      );
      expect(mock.captured[0].params).toEqual([
        "Your shop made $2,117.00 this week.",
        "row-1",
        "peanut",
      ]);
    });

    it("truncates oversized excerpt to 500 chars", async () => {
      const mock = makeMockPool([{ rows: [], rowCount: 1 }]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      const res = makeRes();
      await ctrl.recordRun(
        makeReq({
          user: { shopId: "peanut" },
          params: { id: "row-1" },
          body: { excerpt: "x".repeat(600) },
        }),
        res
      );
      const updateCall = mock.captured[0];
      expect((updateCall.params[0] as string).length).toBe(500);
    });

    it("404 when row not found for this shop", async () => {
      const mock = makeMockPool([{ rows: [], rowCount: 0 }]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      const res = makeRes();
      await ctrl.recordRun(
        makeReq({
          user: { shopId: "peanut" },
          params: { id: "wrong-id" },
          body: { excerpt: "hi" },
        }),
        res
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("400 when excerpt isn't a string", async () => {
      const mock = makeMockPool([]);
      const ctrl = makeInsightsPinnedController({ pool: mock.pool });
      const res = makeRes();
      await ctrl.recordRun(
        makeReq({
          user: { shopId: "peanut" },
          params: { id: "row-1" },
          body: {},
        }),
        res
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("auth", () => {
    it.each(["listPinned", "createPinned", "deletePinned", "recordRun"] as const)(
      "%s returns 401 without shopId",
      async (method) => {
        const mock = makeMockPool([]);
        const ctrl = makeInsightsPinnedController({ pool: mock.pool });
        const res = makeRes();
        await (ctrl as any)[method](
          makeReq({ params: { id: "x" }, body: { excerpt: "x", questionText: "x" } }),
          res
        );
        expect(res.status).toHaveBeenCalledWith(401);
      }
    );
  });
});
