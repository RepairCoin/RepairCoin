// backend/tests/messaging/AiFollowupScheduler.test.ts
//
// Covers the quiet-hours behaviour of the AI inactivity follow-up worker.
// Delays now run to days (context-aware follow-ups), so a row can easily come
// due at 3am — and unlike the fixed-delay sales nudge, skipping would drop it
// permanently rather than retry it next tick. It must defer instead.
//
// The hour arithmetic itself is covered in tests/utils/shopQuietHours.test.ts;
// here it is mocked so the scheduler's branch is tested independently of when
// CI happens to run.

jest.mock("../../src/services/WebSocketManager", () => ({
  getWebSocketManager: () => null,
}));

const mockDeliver = jest.fn().mockResolvedValue(undefined);
const mockSetWs = jest.fn();
jest.mock("../../src/domains/messaging/services/MessageService", () => ({
  MessageService: jest.fn().mockImplementation(() => ({
    deliverScheduledAiMessage: mockDeliver,
    setWebSocketManager: mockSetWs,
  })),
}));

const mockListDue = jest.fn();
const mockDefer = jest.fn().mockResolvedValue(undefined);
const mockClear = jest.fn().mockResolvedValue(1);
const mockAdvance = jest.fn().mockResolvedValue(undefined);
jest.mock("../../src/repositories/MessageRepository", () => ({
  MessageRepository: jest.fn().mockImplementation(() => ({
    listDueAiFollowups: mockListDue,
    deferAiFollowup: mockDefer,
    clearAiFollowup: mockClear,
    advanceAiFollowupToClosing: mockAdvance,
  })),
}));

const mockGetTimezone = jest.fn().mockResolvedValue("America/New_York");
const mockHoursUntil = jest.fn().mockReturnValue(0);
jest.mock("../../src/utils/shopQuietHours", () => ({
  getShopTimezone: (...a: unknown[]) => mockGetTimezone(...a),
  hoursUntilShopDaytime: (...a: unknown[]) => mockHoursUntil(...a),
}));

import { AiFollowupScheduler } from "../../src/domains/messaging/services/AiFollowupScheduler";

const dueRow = (over: Record<string, unknown> = {}) => ({
  conversationId: "conv_1",
  shopId: "shop_1",
  customerAddress: "0xabc",
  serviceId: "srv_1",
  channel: "app",
  stage: "followup",
  followupText: "Still want that Friday slot?",
  closingText: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockClear.mockResolvedValue(1);
  mockGetTimezone.mockResolvedValue("America/New_York");
  mockHoursUntil.mockReturnValue(0);
});

describe("AiFollowupScheduler — quiet hours", () => {
  it("sends when the shop is inside its daytime window", async () => {
    mockListDue.mockResolvedValue([dueRow()]);

    await new AiFollowupScheduler().tick();

    expect(mockDeliver).toHaveBeenCalledTimes(1);
    expect(mockDefer).not.toHaveBeenCalled();
  });

  it("defers rather than sending when outside the window", async () => {
    mockListDue.mockResolvedValue([dueRow()]);
    mockHoursUntil.mockReturnValue(5); // 3am shop-local → 8am

    await new AiFollowupScheduler().tick();

    expect(mockDeliver).not.toHaveBeenCalled();
    expect(mockDefer).toHaveBeenCalledWith("conv_1", 5);
  });

  it("does not clear a deferred row — the drafted text must survive", async () => {
    mockListDue.mockResolvedValue([dueRow()]);
    mockHoursUntil.mockReturnValue(10);

    await new AiFollowupScheduler().tick();

    expect(mockClear).not.toHaveBeenCalled();
    expect(mockAdvance).not.toHaveBeenCalled();
  });

  it("resolves the window against the shop's own timezone", async () => {
    mockListDue.mockResolvedValue([dueRow()]);
    mockGetTimezone.mockResolvedValue("Asia/Manila");

    await new AiFollowupScheduler().tick();

    expect(mockGetTimezone).toHaveBeenCalledWith("shop_1");
    expect(mockHoursUntil).toHaveBeenCalledWith("Asia/Manila");
  });

  it("looks up each shop's timezone once per tick", async () => {
    mockListDue.mockResolvedValue([
      dueRow({ conversationId: "conv_1" }),
      dueRow({ conversationId: "conv_2" }),
      dueRow({ conversationId: "conv_3", shopId: "shop_2" }),
    ]);

    await new AiFollowupScheduler().tick();

    expect(mockDeliver).toHaveBeenCalledTimes(3);
    expect(mockGetTimezone).toHaveBeenCalledTimes(2); // shop_1, shop_2
  });
});

describe("AiFollowupScheduler — existing behaviour still holds", () => {
  it("clears a row whose stage has no drafted text", async () => {
    mockListDue.mockResolvedValue([dueRow({ followupText: null })]);

    await new AiFollowupScheduler().tick();

    expect(mockDeliver).not.toHaveBeenCalled();
    expect(mockClear).toHaveBeenCalledWith("conv_1");
  });

  it("advances to closing when a closing message was drafted", async () => {
    mockListDue.mockResolvedValue([dueRow({ closingText: "Here's our number." })]);

    await new AiFollowupScheduler().tick();

    expect(mockAdvance).toHaveBeenCalledWith("conv_1");
    expect(mockClear).not.toHaveBeenCalled();
  });

  it("clears a poison row when delivery throws", async () => {
    mockListDue.mockResolvedValue([dueRow()]);
    mockDeliver.mockRejectedValueOnce(new Error("boom"));

    await new AiFollowupScheduler().tick();

    expect(mockClear).toHaveBeenCalledWith("conv_1");
  });
});
