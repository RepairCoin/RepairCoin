// WS3 — image generation vs the monthly AI cap.
//
// Two behaviors are locked here (both are easy to silently re-break in a refactor
// of checkGates, and neither can be verified manually without spending real
// gpt-image-1 money):
//   1. Shop-budget image gen HARD-STOPS at the cap. Text chat soft-lands on a
//      cheaper model past the cap, but images can't degrade, so — like BrandKit's
//      vision endpoints — they must block. `canSpend` returns allowed:true under
//      the soft landing, so the block MUST key off `limitReached`, not `allowed`.
//   2. Ads creative (useCase 'ads') is COGS (ad_ai_costs), exempt from the shop's
//      $10/$30/$75 allowance — it must NOT be cap-blocked, and must NOT drain the
//      pool via recordSpend (T3.3).
//
// Everything external is mocked: no OpenAI, no DB, no storage, no real spend.

// The tier gate (aiImageGen) is orthogonal here — force it open so we isolate the
// CAP logic. (Matches the partial-mock pattern in tierGuard.test.ts.)
jest.mock("../../src/utils/shopTier", () => ({
  shopHasFeature: jest.fn().mockResolvedValue(true),
}));

import { ImageGenerationService } from "../../src/domains/AIAgentDomain/services/ImageGenerationService";

const overCap = {
  allowed: true,
  useCheaperModel: true,
  limitReached: true,
  monthlyBudgetUsd: 30,
  currentSpendUsd: 35,
  percentUsed: 1.17,
};
const underCap = {
  allowed: true,
  useCheaperModel: false,
  limitReached: false,
  monthlyBudgetUsd: 30,
  currentSpendUsd: 5,
  percentUsed: 0.16,
};

// Build the service with every external dep mocked. `getBrandKit` → null so the
// logo-overlay branch is skipped (no image fetch). `dalle` returns b64 so there's
// no network download. Successful path yields status 200.
function makeSvc(canSpendResult: any) {
  const spendCap: any = {
    canSpend: jest.fn().mockResolvedValue(canSpendResult),
    recordSpend: jest.fn().mockResolvedValue(undefined),
  };
  const pool: any = {
    query: jest.fn().mockResolvedValue({ rows: [{ ai_images_enabled: true }] }),
  };
  const auditLogger: any = {
    countToday: jest.fn().mockResolvedValue(0),
    log: jest.fn().mockResolvedValue(undefined),
  };
  const moderation: any = {
    check: jest.fn().mockResolvedValue({ flagged: false, categories: [] }),
  };
  const brandKit: any = {
    getBrandKit: jest.fn().mockResolvedValue(null),
    buildBrandedPrompt: jest.fn((p: string) => p),
  };
  const dalle: any = {
    generate: jest.fn().mockResolvedValue({
      costUsd: 0.05,
      latencyMs: 10,
      revisedPrompt: null,
      b64Json: Buffer.from("fake-image").toString("base64"),
    }),
  };
  const logoOverlay: any = { overlaySafe: jest.fn() };
  const storage: any = {
    uploadBuffer: jest.fn().mockResolvedValue({
      success: true,
      url: "https://cdn.test/ai-images/x.png",
      key: "shops/shop1/ai-images/x.png",
    }),
  };
  const svc = new ImageGenerationService({
    spendCap,
    pool,
    auditLogger,
    moderation,
    brandKit,
    dalle,
    logoOverlay,
    storage,
  });
  return { svc, spendCap, moderation };
}

describe("ImageGenerationService — WS3 cap", () => {
  beforeEach(() => jest.clearAllMocks());

  it("blocks shop-budget image generation at the cap (429), before any spend", async () => {
    const { svc, spendCap, moderation } = makeSvc(overCap);
    const out = await svc.generate("shop1", { prompt: "a cozy cafe", useCase: "marketing" });

    expect(out.ok).toBe(false);
    expect(out.status).toBe(429);
    expect(out.error).toMatch(/AI limit|overage/i);
    // Stopped at the cap gate — never reached moderation or recorded spend.
    expect(moderation.check).not.toHaveBeenCalled();
    expect(spendCap.recordSpend).not.toHaveBeenCalled();
  });

  it("does NOT block ads creative at the cap (ads are COGS, exempt)", async () => {
    const { svc, spendCap, moderation } = makeSvc(overCap);
    const out = await svc.generate("shop1", { prompt: "a cozy cafe", useCase: "ads" });

    expect(out.status).not.toBe(429);
    expect(out.ok).toBe(true); // passed the gate and produced an image
    expect(moderation.check).toHaveBeenCalled(); // proves it got past the cap gate
    // Ads must never drain the shop's included allowance.
    expect(spendCap.recordSpend).not.toHaveBeenCalled();
  });

  it("records spend for a normal (under-cap) shop image", async () => {
    const { svc, spendCap } = makeSvc(underCap);
    const out = await svc.generate("shop1", { prompt: "a cozy cafe", useCase: "marketing" });

    expect(out.ok).toBe(true);
    expect(out.status).toBe(200);
    expect(spendCap.recordSpend).toHaveBeenCalledTimes(1);
  });

  it("blocks image EDIT at the cap too (same gate, before the source fetch)", async () => {
    const { svc, moderation } = makeSvc(overCap);
    const out = await svc.edit("shop1", {
      sourceImageUrl: "https://cdn.test/src.png",
      prompt: "add falling snow",
      useCase: "marketing",
    });

    expect(out.ok).toBe(false);
    expect(out.status).toBe(429);
    expect(moderation.check).not.toHaveBeenCalled();
  });
});
