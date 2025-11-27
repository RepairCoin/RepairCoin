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
import { customerBalanceService } from "../../src/domains/customer/services/CustomerBalanceService";
import { crossShopVerificationService } from "../../src/domains/customer/services/CrossShopVerificationService";

// Mock the services
jest.mock("../../src/domains/customer/services/CustomerBalanceService");
jest.mock("../../src/domains/customer/services/CrossShopVerificationService");
jest.mock("thirdweb");

describe("Customer Balance API Tests", () => {
  let app: any;
  const customerAddress = "0x1234567890123456789012345678901234567890";

  const mockBalanceInfo = {
    address: customerAddress,
    databaseBalance: 250,
    pendingMintBalance: 50,
    totalBalance: 300,
    lifetimeEarnings: 500,
    totalRedemptions: 100,
    tier: "SILVER",
    canMintToWallet: true,
    balanceSynced: true,
    lastBlockchainSync: new Date().toISOString(),
  };

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

  describe("GET /api/customers/balance/:address", () => {
    it("should get customer balance successfully", async () => {
      jest
        .spyOn(customerBalanceService, "getCustomerBalanceInfo")
        .mockResolvedValue(mockBalanceInfo as any);

      const response = await request(app).get(
        `/api/customers/balance/${customerAddress}`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        address: customerAddress,
        databaseBalance: 250,
        pendingMintBalance: 50,
        totalBalance: 300,
      });
    });

    it("should return 404 for non-existent customer", async () => {
      jest
        .spyOn(customerBalanceService, "getCustomerBalanceInfo")
        .mockResolvedValue(null);

      const response = await request(app).get(
        `/api/customers/balance/${customerAddress}`
      );

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("not found");
    });

    it("should return 400 for invalid address format", async () => {
      const invalidAddress = "invalid-address";

      const response = await request(app).get(
        `/api/customers/balance/${invalidAddress}`
      );

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid wallet address");
    });
  });

  describe("POST /api/customers/balance/:address/queue-mint", () => {
    it("should queue mint request successfully", async () => {
      const mintAmount = 100;
      const mockValidation = { valid: true };
      const mockMintRequest = {
        customerAddress,
        amount: mintAmount,
        requestedAt: new Date().toISOString(),
      };

      jest
        .spyOn(customerBalanceService, "validateMintRequest")
        .mockResolvedValue(mockValidation as any);

      jest
        .spyOn(customerBalanceService, "queueForMinting")
        .mockResolvedValue(mockMintRequest as any);

      const response = await request(app)
        .post(`/api/customers/balance/${customerAddress}/queue-mint`)
        .send({ amount: mintAmount });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.amount).toBe(mintAmount);
      expect(response.body.message).toContain("queued");
    });

    it("should reject invalid amount", async () => {
      const response = await request(app)
        .post(`/api/customers/balance/${customerAddress}/queue-mint`)
        .send({ amount: 0 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid amount");
    });

    it("should reject when validation fails", async () => {
      const mockValidation = {
        valid: false,
        reason: "Insufficient balance",
        maxAllowed: 50,
      };

      jest
        .spyOn(customerBalanceService, "validateMintRequest")
        .mockResolvedValue(mockValidation as any);

      const response = await request(app)
        .post(`/api/customers/balance/${customerAddress}/queue-mint`)
        .send({ amount: 100 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Insufficient balance");
      expect(response.body.maxAllowed).toBe(50);
    });
  });

  describe("POST /api/customers/balance/:address/sync", () => {
    it("should sync customer balance successfully", async () => {
      jest
        .spyOn(customerBalanceService, "syncCustomerBalance")
        .mockResolvedValue(mockBalanceInfo as any);

      const response = await request(app).post(
        `/api/customers/balance/${customerAddress}/sync`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("synchronized");
    });

    it("should return 400 for invalid address", async () => {
      const response = await request(app).post(
        "/api/customers/balance/invalid-address/sync"
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid wallet address");
    });
  });

  describe("GET /api/customers/balance/pending-mints", () => {
    it("should get pending mints successfully", async () => {
      const mockPendingMints = [
        {
          customerAddress: "0x1111111111111111111111111111111111111111",
          amount: 100,
          requestedAt: new Date().toISOString(),
        },
        {
          customerAddress: "0x2222222222222222222222222222222222222222",
          amount: 200,
          requestedAt: new Date().toISOString(),
        },
      ];

      jest
        .spyOn(customerBalanceService, "getPendingMints")
        .mockResolvedValue(mockPendingMints as any);

      const response = await request(app).get(
        "/api/customers/balance/pending-mints"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(customerBalanceService.getPendingMints).toHaveBeenCalledWith(100); // default limit
    });

    it("should respect limit parameter", async () => {
      jest
        .spyOn(customerBalanceService, "getPendingMints")
        .mockResolvedValue([] as any);

      const response = await request(app).get(
        "/api/customers/balance/pending-mints?limit=50"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(customerBalanceService.getPendingMints).toHaveBeenCalledWith(50);
    });

    it("should reject invalid limit (too high)", async () => {
      const response = await request(app).get(
        "/api/customers/balance/pending-mints?limit=2000"
      );

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Limit must be between");
    });

    it("should reject invalid limit (too low)", async () => {
      const response = await request(app).get(
        "/api/customers/balance/pending-mints?limit=0"
      );

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Limit must be between");
    });
  });

  describe("GET /api/customers/balance/statistics", () => {
    it("should get balance statistics successfully", async () => {
      const mockStatistics = {
        totalDatabaseBalance: 10000,
        totalPendingMints: 500,
        totalCustomersWithBalance: 50,
        averageBalance: 200,
      };

      jest
        .spyOn(customerBalanceService, "getBalanceStatistics")
        .mockResolvedValue(mockStatistics as any);

      const response = await request(app).get(
        "/api/customers/balance/statistics"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject(mockStatistics);
    });
  });
});

describe("Cross-Shop Verification API Tests", () => {
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
        verificationId: "verify-124",
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
  });
});
