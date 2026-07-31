// AI Memory is a Business-tier feature. Before this fix the CRUD API gated only on the
// ENABLE_AI_MEMORY flag, so any tier that called it directly got the feature (the UI hid it, the
// endpoint didn't). These tests lock in that the controller enforces BOTH the flag AND the
// aiMemory tier entitlement.

jest.mock("../../src/utils/shopTier", () => ({ shopHasFeature: jest.fn() }));
jest.mock("../../src/domains/AIAgentDomain/services/AiMemoryService", () => ({
  isAiMemoryEnabled: jest.fn(),
  getAiMemoryService: jest.fn(),
}));

import {
  listMemories,
  createMemory,
} from "../../src/domains/AIAgentDomain/controllers/AiMemoryController";
import { shopHasFeature } from "../../src/utils/shopTier";
import { isAiMemoryEnabled, getAiMemoryService } from "../../src/domains/AIAgentDomain/services/AiMemoryService";

const mockedHasFeature = shopHasFeature as jest.Mock;
const mockedEnabled = isAiMemoryEnabled as jest.Mock;
const mockedGetService = getAiMemoryService as jest.Mock;

const makeReq = (body: any = {}) => ({ user: { shopId: "shop_1" }, body, params: {}, query: {} } as any);
const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const service = { list: jest.fn(), remember: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetService.mockReturnValue(service);
  service.list.mockResolvedValue([{ id: "m1", content: "always upsell the wash" }]);
  service.remember.mockResolvedValue({ saved: true, memory: { id: "m2" } });
});

describe("AiMemoryController — Business-tier gate", () => {
  it("flag OFF → createMemory 409, regardless of tier", async () => {
    mockedEnabled.mockReturnValue(false);
    mockedHasFeature.mockResolvedValue(true); // even a Business shop
    const res = makeRes();
    await createMemory(makeReq({ content: "x" }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(service.remember).not.toHaveBeenCalled();
  });

  it("flag ON but BELOW tier → createMemory 403 (tier_upgrade_required), no write", async () => {
    mockedEnabled.mockReturnValue(true);
    mockedHasFeature.mockResolvedValue(false); // Growth/Starter
    const res = makeRes();
    await createMemory(makeReq({ content: "always upsell" }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "tier_upgrade_required" }));
    expect(service.remember).not.toHaveBeenCalled();
  });

  it("flag ON + Business tier → createMemory proceeds to the write", async () => {
    mockedEnabled.mockReturnValue(true);
    mockedHasFeature.mockResolvedValue(true);
    const res = makeRes();
    await createMemory(makeReq({ content: "always upsell" }), res);
    expect(service.remember).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("list: BELOW tier → enabled:false + empty, does NOT hit the service", async () => {
    mockedEnabled.mockReturnValue(true);
    mockedHasFeature.mockResolvedValue(false);
    const res = makeRes();
    await listMemories(makeReq(), res);
    expect(service.list).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { enabled: false, memories: [] } });
  });

  it("list: Business tier → enabled:true + the shop's memories", async () => {
    mockedEnabled.mockReturnValue(true);
    mockedHasFeature.mockResolvedValue(true);
    const res = makeRes();
    await listMemories(makeReq(), res);
    expect(service.list).toHaveBeenCalledWith("shop_1");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { enabled: true, memories: [{ id: "m1", content: "always upsell the wash" }] },
    });
  });
});
