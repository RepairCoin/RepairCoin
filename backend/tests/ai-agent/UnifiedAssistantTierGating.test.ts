// WS2 — the unified "sparkles" assistant (/ai/orchestrate) is Starter+, but its
// TOOLS are tier-scoped. This locks the fix for the leak where a Starter shop
// could reach Insights/Marketing/inventory through the orchestrator, bypassing
// the dedicated /ai/insights + /ai/marketing-chat route guards.
//
// We drive makeUnifiedAssistantController with fake deps and a mocked
// shopHasFeature, then assert which tool names reach anthropic.complete().

jest.mock("../../src/utils/shopTier", () => ({
  shopHasFeature: jest.fn(),
}));

import { makeUnifiedAssistantController } from "../../src/domains/AIAgentDomain/controllers/UnifiedAssistantController";
import { shopHasFeature } from "../../src/utils/shopTier";
import { getInsightsTools } from "../../src/domains/AIAgentDomain/services/insights/registry";
import { getMarketingTools } from "../../src/domains/AIAgentDomain/services/marketing/registry";

const mockShopHasFeature = shopHasFeature as jest.MockedFunction<
  typeof shopHasFeature
>;

const INSIGHTS_NAMES = getInsightsTools().map((t) => t.name);
const MARKETING_NAMES = getMarketingTools().map((t) => t.name);

// Capture the `tools` array from the (single) anthropic.complete call.
function makeDeps() {
  let capturedToolNames: string[] = [];
  const anthropic: any = {
    complete: jest.fn(async (opts: any) => {
      capturedToolNames = (opts.tools ?? []).map((t: any) => t.name);
      return {
        text: "ok",
        model: "claude-sonnet-4-6",
        stopReason: "end_turn",
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        },
        costUsd: 0,
        latencyMs: 1,
        toolUses: [], // no tool call → loop exits after one turn
      };
    }),
  };
  const spendCap: any = {
    canSpend: jest.fn(async () => ({
      allowed: true,
      useCheaperModel: false,
      currentSpendUsd: 0,
      monthlyBudgetUsd: 30,
    })),
    recordSpend: jest.fn(async () => {}),
  };
  const auditLogger: any = { log: jest.fn(async () => {}) };
  const pool: any = { query: jest.fn(async () => ({ rows: [] })) };
  const memory: any = { recall: jest.fn(async () => []) };
  const controller = makeUnifiedAssistantController({
    anthropic,
    spendCap,
    auditLogger,
    pool,
    memory,
  });
  return { controller, anthropic, getToolNames: () => capturedToolNames };
}

function makeReqRes() {
  const req: any = {
    user: { shopId: "shop-1" },
    body: {
      sessionId: "sess-1",
      messages: [{ role: "user", content: "how much did I earn last week?" }],
    },
  };
  const res: any = {
    statusCode: 0,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(b: any) {
      this.body = b;
      return this;
    },
  };
  return { req, res };
}

describe("UnifiedAssistantController — WS2 tool tier gating", () => {
  beforeEach(() => jest.clearAllMocks());

  it("strips Insights + Marketing + inventory tools for a Starter shop", async () => {
    mockShopHasFeature.mockResolvedValue(false); // nothing included
    const { controller, getToolNames } = makeDeps();
    const { req, res } = makeReqRes();

    await controller.askOrchestrator(req, res);

    const names = getToolNames();
    // No insights or marketing tool should be offered to the model.
    for (const n of INSIGHTS_NAMES) expect(names).not.toContain(n);
    for (const n of MARKETING_NAMES) expect(names).not.toContain(n);
    expect(names).not.toContain("propose_purchase_order");
  });

  it("offers Insights + Marketing + inventory tools for a Business shop", async () => {
    mockShopHasFeature.mockResolvedValue(true); // full access
    const { controller, getToolNames } = makeDeps();
    const { req, res } = makeReqRes();

    await controller.askOrchestrator(req, res);

    const names = getToolNames();
    for (const n of INSIGHTS_NAMES) expect(names).toContain(n);
    for (const n of MARKETING_NAMES) expect(names).toContain(n);
    expect(names).toContain("propose_purchase_order");
  });

  it("gates each capability independently (Insights on, Marketing off)", async () => {
    mockShopHasFeature.mockImplementation(
      async (_shopId: string, feature: string) => feature === "aiInsights"
    );
    const { controller, getToolNames } = makeDeps();
    const { req, res } = makeReqRes();

    await controller.askOrchestrator(req, res);

    const names = getToolNames();
    for (const n of INSIGHTS_NAMES) expect(names).toContain(n);
    for (const n of MARKETING_NAMES) expect(names).not.toContain(n);
  });
});
