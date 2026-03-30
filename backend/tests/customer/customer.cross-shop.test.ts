import request from "supertest";
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  jest,
} from "@jest/globals";
import RepairCoinApp from "../../src/app";
import { crossShopVerificationService } from "../../src/domains/customer/services/CrossShopVerificationService";

// Mock the service (following the same pattern as balance.test.ts)
jest.mock("../../src/domains/customer/services/CrossShopVerificationService");
jest.mock("thirdweb");

describe("Cross-Shop Verification API Tests (Fixed)", () => {
  let app: any;
  const customerAddress = "0x1234567890123456789012345678901234567890";
  const shopId = "shop-123";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    process.env.NODE_ENV = "test";

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/customers/cross-shop/verify", () => {
    it("should approve redemption within 20% limit", async () => {
      const mockVerificationResult = {
        approved: true,
        availableBalance: 500,
        maxCrossShopAmount: 100, // 20% of 500
        requestedAmount: 80,
        verificationId: "verify-123",
        message: "Redemption approved",
      };

      jest
        .spyOn(crossShopVerificationService, "verifyRedemption")
        .mockResolvedValue(mockVerificationResult as any);

      const response = await request(app)
        .post("/api/customers/cross-shop/verify")
        .send({
          customerAddress,
          redemptionShopId: shopId,
          requestedAmount: 80,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.approved).toBe(true);
      expect(response.body.data.maxCrossShopAmount).toBe(100);
    });

    it("should deny redemption exceeding 20% limit", async () => {
      const mockVerificationResult = {
        approved: false,
        availableBalance: 500,
        maxCrossShopAmount: 100,
        requestedAmount: 150,
        verificationId: "verify-124",
        denialReason: "Requested amount exceeds cross-shop limit",
        message: "Redemption denied",
      };

      jest
        .spyOn(crossShopVerificationService, "verifyRedemption")
        .mockResolvedValue(mockVerificationResult as any);

      const response = await request(app)
        .post("/api/customers/cross-shop/verify")
        .send({
          customerAddress,
          redemptionShopId: shopId,
          requestedAmount: 150,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.approved).toBe(false);
      expect(response.body.data.denialReason).toContain("exceeds");
    });

    it("should handle exact 20% boundary", async () => {
      const mockVerificationResult = {
        approved: true,
        availableBalance: 500,
        maxCrossShopAmount: 100,
        requestedAmount: 100, // Exactly 20%
        verificationId: "verify-125",
        message: "Redemption approved at limit",
      };

      jest
        .spyOn(crossShopVerificationService, "verifyRedemption")
        .mockResolvedValue(mockVerificationResult as any);

      const response = await request(app)
        .post("/api/customers/cross-shop/verify")
        .send({
          customerAddress,
          redemptionShopId: shopId,
          requestedAmount: 100,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.approved).toBe(true);
      expect(response.body.data.requestedAmount).toBe(100);
    });

    it("should reject invalid customer address", async () => {
      jest
        .spyOn(crossShopVerificationService, "verifyRedemption")
        .mockResolvedValue({
          approved: false,
          availableBalance: 0,
          maxCrossShopAmount: 0,
          requestedAmount: 50,
          verificationId: "verify-invalid",
          denialReason: "Invalid customer address",
          message: "Verification failed",
        } as any);

      const response = await request(app)
        .post("/api/customers/cross-shop/verify")
        .send({
          customerAddress: "invalid-address",
          redemptionShopId: shopId,
          requestedAmount: 50,
        });

      expect(response.status).toBe(200); // ✅ Correct
      expect(response.body.data.approved).toBe(false); // ✅ Correct
      expect(response.body.data.denialReason).toContain("Invalid");
    });

    it("should reject missing required fields", async () => {
      const response = await request(app)
        .post("/api/customers/cross-shop/verify")
        .send({
          customerAddress,
          // Missing redemptionShopId and requestedAmount
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Missing required fields");
    });

    it("should reject zero or negative amounts", async () => {
      const response = await request(app)
        .post("/api/customers/cross-shop/verify")
        .send({
          customerAddress,
          redemptionShopId: shopId,
          requestedAmount: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should handle insufficient balance", async () => {
      const mockVerificationResult = {
        approved: false,
        availableBalance: 50,
        maxCrossShopAmount: 10,
        requestedAmount: 100,
        verificationId: "verify-126",
        denialReason: "Insufficient redeemable balance",
        message: "Redemption denied",
      };

      jest
        .spyOn(crossShopVerificationService, "verifyRedemption")
        .mockResolvedValue(mockVerificationResult as any);

      const response = await request(app)
        .post("/api/customers/cross-shop/verify")
        .send({
          customerAddress,
          redemptionShopId: shopId,
          requestedAmount: 100,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.approved).toBe(false);
      expect(response.body.data.denialReason).toContain("Insufficient");
    });

    it("should handle non-existent shop", async () => {
      const mockVerificationResult = {
        approved: false,
        availableBalance: 500,
        maxCrossShopAmount: 100,
        requestedAmount: 50,
        verificationId: "verify-127",
        denialReason: "Redemption shop not found",
        message: "Redemption denied",
      };

      jest
        .spyOn(crossShopVerificationService, "verifyRedemption")
        .mockResolvedValue(mockVerificationResult as any);

      const response = await request(app)
        .post("/api/customers/cross-shop/verify")
        .send({
          customerAddress,
          redemptionShopId: "non-existent-shop",
          requestedAmount: 50,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.approved).toBe(false);
      expect(response.body.data.denialReason).toContain("not found");
    });
  });
});
