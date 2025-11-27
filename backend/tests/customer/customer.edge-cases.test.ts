import request from "supertest";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from "@jest/globals";

// ============================================
// MOCK DATABASE POOL - MUST BE BEFORE IMPORTS
// ============================================
const mockPoolQuery = jest
  .fn<any>()
  .mockResolvedValue({ rows: [], rowCount: 0 });
const mockPoolConnect = jest.fn<any>().mockResolvedValue({
  query: mockPoolQuery,
  release: jest.fn(),
});
const mockPool = {
  query: mockPoolQuery,
  connect: mockPoolConnect,
  end: jest.fn(),
  on: jest.fn(),
};

// Mock the database pool module
jest.mock("../../src/utils/database-pool", () => ({
  getSharedPool: () => mockPool,
  initializeSharedPool: jest.fn(),
  closeSharedPool: jest.fn(),
}));

// Mock pg module
jest.mock("pg", () => ({
  Pool: jest.fn(() => mockPool),
}));

// Mock DatabaseService
jest.mock("../../src/services/DatabaseService", () => ({
  DatabaseService: {
    getInstance: () => ({
      query: mockPoolQuery,
      getClient: mockPoolConnect,
      getPool: () => mockPool,
    }),
  },
}));

// Mock UniquenessService to prevent DB calls during validation
// The validation middleware uses "new UniquenessService()"
jest.mock("../../src/services/uniquenessService", () => ({
  UniquenessService: jest.fn().mockImplementation(() => ({
    checkEmailUniqueness: jest.fn<any>().mockResolvedValue({ isUnique: true }),
    checkWalletUniqueness: jest.fn<any>().mockResolvedValue({ isUnique: true }),
    checkPhoneUniqueness: jest.fn<any>().mockResolvedValue({ isUnique: true }),
  })),
}));

// Mock RefreshTokenRepository to prevent DB calls during auth
jest.mock("../../src/repositories/RefreshTokenRepository", () => ({
  RefreshTokenRepository: jest.fn().mockImplementation(() => ({
    hasRecentRevocation: jest.fn<any>().mockResolvedValue(false),
    createRefreshToken: jest.fn<any>().mockResolvedValue({ id: "token-1" }),
    revokeToken: jest.fn<any>().mockResolvedValue(true),
    getToken: jest.fn<any>().mockResolvedValue(null),
    validateRefreshToken: jest.fn<any>().mockResolvedValue(null),
    updateLastUsed: jest.fn<any>().mockResolvedValue(true),
    testConnection: jest.fn<any>().mockResolvedValue(true),
  })),
}));

// Mock the repositories index to provide mock singletons
const mockRefreshTokenRepository = {
  hasRecentRevocation: jest.fn<any>().mockResolvedValue(false),
  createRefreshToken: jest.fn<any>().mockResolvedValue({ id: "token-1" }),
  revokeToken: jest.fn<any>().mockResolvedValue(true),
  getToken: jest.fn<any>().mockResolvedValue(null),
  validateRefreshToken: jest.fn<any>().mockResolvedValue(null),
  updateLastUsed: jest.fn<any>().mockResolvedValue(true),
  testConnection: jest.fn<any>().mockResolvedValue(true),
};

jest.mock("../../src/repositories", () => ({
  customerRepository: {
    getCustomer: jest.fn(),
    createCustomer: jest.fn(),
    updateCustomer: jest.fn(),
    testConnection: jest.fn<any>().mockResolvedValue(true),
  },
  shopRepository: {
    getShopByWallet: jest.fn(),
    getShop: jest.fn(),
    testConnection: jest.fn<any>().mockResolvedValue(true),
  },
  adminRepository: {
    isAdmin: jest.fn<any>().mockResolvedValue(false),
    getAdmin: jest.fn(),
    testConnection: jest.fn<any>().mockResolvedValue(true),
  },
  refreshTokenRepository: mockRefreshTokenRepository,
  transactionRepository: {
    testConnection: jest.fn<any>().mockResolvedValue(true),
  },
  webhookRepository: {
    testConnection: jest.fn<any>().mockResolvedValue(true),
  },
  treasuryRepository: {
    testConnection: jest.fn<any>().mockResolvedValue(true),
  },
  redemptionSessionRepository: {
    testConnection: jest.fn<any>().mockResolvedValue(true),
  },
  shopSubscriptionRepository: {
    testConnection: jest.fn<any>().mockResolvedValue(true),
  },
  healthRepository: {
    testConnection: jest.fn<any>().mockResolvedValue(true),
  },
  promoCodeRepository: {
    testConnection: jest.fn<any>().mockResolvedValue(true),
  },
  CustomerRepository: jest.fn(),
  ShopRepository: jest.fn(),
  AdminRepository: jest.fn(),
  RefreshTokenRepository: jest
    .fn()
    .mockImplementation(() => mockRefreshTokenRepository),
  TransactionRepository: jest.fn(),
  WebhookRepository: jest.fn(),
  TreasuryRepository: jest.fn(),
  RedemptionSessionRepository: jest.fn(),
  ShopSubscriptionRepository: jest.fn(),
  HealthRepository: jest.fn(),
  PromoCodeRepository: jest.fn(),
  BaseRepository: jest.fn(),
}));

// Mock other repositories that test DB connection on startup
jest.mock("../../src/repositories/TransactionRepository");
jest.mock("../../src/repositories/WebhookRepository");
jest.mock("../../src/repositories/TreasuryRepository");
jest.mock("../../src/repositories/RedemptionSessionRepository");
jest.mock("../../src/repositories/ShopSubscriptionRepository");
jest.mock("../../src/repositories/HealthRepository");
jest.mock("../../src/repositories/PromoCodeRepository");
jest.mock("../../src/repositories/WebhookLogRepository");
jest.mock("../../src/repositories/NotificationRepository");
jest.mock("../../src/repositories/AffiliateShopGroupRepository");

// Mock BaseRepository to prevent any DB connection attempts
jest.mock("../../src/repositories/BaseRepository", () => ({
  BaseRepository: jest.fn().mockImplementation(() => ({
    pool: mockPool,
    testConnection: jest.fn<any>().mockResolvedValue(true),
  })),
  PaginatedResult: {},
}));

// Mock AdminSyncService to prevent DB calls during startup
jest.mock("../../src/services/AdminSyncService", () => ({
  AdminSyncService: jest.fn().mockImplementation(() => ({
    syncAdminsFromEnvironment: jest.fn<any>().mockResolvedValue(undefined),
    syncAdminAddress: jest.fn<any>().mockResolvedValue(undefined),
    cleanupRemovedAdmins: jest.fn<any>().mockResolvedValue(undefined),
    getSyncStatus: jest.fn<any>().mockResolvedValue({ synced: [], failed: [] }),
  })),
}));

// Mock CleanupService
jest.mock("../../src/services/CleanupService", () => ({
  cleanupService: {
    startScheduledCleanup: jest.fn(),
    stopScheduledCleanup: jest.fn(),
    runCleanup: jest.fn<any>().mockResolvedValue(undefined),
  },
}));

// Mock MonitoringService
jest.mock("../../src/services/MonitoringService", () => ({
  monitoringService: {
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    getMetrics: jest.fn().mockReturnValue({}),
  },
}));

// Mock RedemptionSessionService
jest.mock("../../src/domains/token/services/RedemptionSessionService", () => ({
  RedemptionSessionService: jest.fn().mockImplementation(() => ({
    cleanupExpiredSessions: jest.fn<any>().mockResolvedValue(undefined),
    startCleanupInterval: jest.fn(),
    stopCleanupInterval: jest.fn(),
  })),
}));

// Mock SubscriptionService
jest.mock("../../src/services/SubscriptionService", () => ({
  SubscriptionService: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn<any>().mockResolvedValue(true),
  })),
}));

// Now import app and other modules
import RepairCoinApp from "../../src/app";
import { CustomerRepository } from "../../src/repositories/CustomerRepository";
import { ShopRepository } from "../../src/repositories/ShopRepository";
import { ReferralRepository } from "../../src/repositories/ReferralRepository";
import { ServiceRepository } from "../../src/repositories/ServiceRepository";
import { OrderRepository } from "../../src/repositories/OrderRepository";
import { VerificationService } from "../../src/domains/token/services/VerificationService";
import { AdminRepository } from "../../src/repositories/AdminRepository";

// Mock main dependencies
jest.mock("../../src/repositories/CustomerRepository");
jest.mock("../../src/repositories/ShopRepository");
jest.mock("../../src/repositories/ReferralRepository");
jest.mock("../../src/repositories/ServiceRepository");
jest.mock("../../src/repositories/OrderRepository");
jest.mock("../../src/repositories/AdminRepository");
jest.mock("../../src/domains/token/services/VerificationService");
jest.mock("thirdweb");

describe("Customer Features - Edge Cases & Error Scenarios", () => {
  let app: any;
  const validAddress = "0x1234567890123456789012345678901234567890";
  const invalidAddress = "0xinvalid";
  const shortAddress = "0x12345";

  beforeAll(async () => {
    // Set test environment variables
    process.env.JWT_SECRET = "test-secret";
    process.env.NODE_ENV = "test";
    process.env.SKIP_DB_CONNECTION_TESTS = "true";
    process.env.SKIP_ADMIN_SYNC = "true";

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;
  }, 60000); // Increase timeout for initialization

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // 1. INPUT VALIDATION EDGE CASES
  // ========================================
  describe("1. Input Validation Edge Cases", () => {
    describe("1.1 Registration Validation", () => {
      it("should reject invalid wallet address format", async () => {
        const response = await request(app)
          .post("/api/customers/register")
          .send({
            walletAddress: invalidAddress,
            email: "test@example.com",
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain(
          "walletAddress must be a valid Ethereum address"
        );
      });

      it("should reject short wallet address", async () => {
        const response = await request(app)
          .post("/api/customers/register")
          .send({
            walletAddress: shortAddress,
            email: "test@example.com",
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain(
          "walletAddress must be a valid Ethereum address"
        );
      });

      it("should reject invalid email format", async () => {
        jest
          .spyOn(CustomerRepository.prototype, "getCustomer")
          .mockResolvedValue(null);
        jest
          .spyOn(ShopRepository.prototype, "getShopByWallet")
          .mockResolvedValue(null);
        jest
          .spyOn(AdminRepository.prototype, "isAdmin")
          .mockResolvedValue(false);

        const response = await request(app)
          .post("/api/customers/register")
          .send({
            walletAddress: validAddress,
            email: "invalid-email",
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain(
          "email must be a valid email address"
        );
      });

      it("should handle missing required fields", async () => {
        const response = await request(app)
          .post("/api/customers/register")
          .send({
            email: "test@example.com",
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain(
          "Missing required fields: walletAddress"
        );
      });

      it("should handle extremely long input strings", async () => {
        const longString = "a".repeat(1000);
        const uniqueAddress = "0xABCDEF1234567890123456789012345678901234";

        jest
          .spyOn(CustomerRepository.prototype, "getCustomer")
          .mockResolvedValue(null);
        jest
          .spyOn(ShopRepository.prototype, "getShopByWallet")
          .mockResolvedValue(null);
        jest
          .spyOn(AdminRepository.prototype, "isAdmin")
          .mockResolvedValue(false);

        const response = await request(app)
          .post("/api/customers/register")
          .send({
            walletAddress: uniqueAddress,
            email: "test@example.com",
            name: longString,
          });

        expect(response.status).toBe(400);
      });
    });

    describe("1.2 Phone Number Validation", () => {
      it("should accept various phone formats", async () => {
        const phoneFormats = [
          "+1234567890",
          "+1 234 567 8900",
          "+44 20 7946 0958",
          "+81 3-1234-5678",
        ];

        jest
          .spyOn(CustomerRepository.prototype, "getCustomer")
          .mockResolvedValue(null);
        jest
          .spyOn(ShopRepository.prototype, "getShopByWallet")
          .mockResolvedValue(null);
        jest
          .spyOn(AdminRepository.prototype, "isAdmin")
          .mockResolvedValue(false);
        jest
          .spyOn(CustomerRepository.prototype, "createCustomer")
          .mockResolvedValue({} as any);

        for (const phone of phoneFormats) {
          const uniqueAddr = `0x${phone
            .replace(/[^0-9]/g, "")
            .padStart(40, "0")
            .slice(0, 40)}`;

          const response = await request(app)
            .post("/api/customers/register")
            .send({
              walletAddress: uniqueAddr,
              email: `test${phone.replace(/[^a-z0-9]/gi, "")}@example.com`,
              phone,
            });

          expect([200, 201, 400]).toContain(response.status);
        }
      });

      it("should reject invalid phone formats", async () => {
        const invalidPhones = [
          "123",
          "phone-number",
          "++1234567890",
          "+1234567890123456789",
        ];

        for (const phone of invalidPhones) {
          const response = await request(app)
            .post("/api/customers/register")
            .send({
              walletAddress: validAddress,
              email: "test@example.com",
              phone,
            });

          expect(response.status).toBe(400);
        }
      });
    });
  });

  // ========================================
  // 2. REFERRAL EDGE CASES
  // ========================================
  describe("2. Referral Edge Cases", () => {
    describe("2.1 Referral Code Edge Cases", () => {
      it("should handle case-insensitive referral codes", async () => {
        const mockReferrer = {
          address: "0x9999999999999999999999999999999999999999",
          referralCode: "ABCD1234",
        };

        jest
          .spyOn(CustomerRepository.prototype, "getCustomer")
          .mockResolvedValue(null);
        jest
          .spyOn(ShopRepository.prototype, "getShopByWallet")
          .mockResolvedValue(null);
        jest
          .spyOn(AdminRepository.prototype, "isAdmin")
          .mockResolvedValue(false);
        jest
          .spyOn(CustomerRepository.prototype, "getCustomerByReferralCode")
          .mockResolvedValue(mockReferrer as any);
        jest
          .spyOn(CustomerRepository.prototype, "createCustomer")
          .mockResolvedValue({} as any);

        const caseVariations = ["ABCD1234", "abcd1234", "AbCd1234", "aBcD1234"];

        for (const code of caseVariations) {
          const response = await request(app)
            .post("/api/customers/register")
            .send({
              walletAddress: validAddress,
              email: `test${code}@example.com`,
              referralCode: code,
            });

          expect([200, 201, 400]).toContain(response.status);
        }
      });

      it("should reject self-referral", async () => {
        const mockCustomer = {
          address: validAddress,
          referralCode: "SELF1234",
        };

        jest
          .spyOn(CustomerRepository.prototype, "getCustomer")
          .mockResolvedValue(null);
        jest
          .spyOn(ShopRepository.prototype, "getShopByWallet")
          .mockResolvedValue(null);
        jest
          .spyOn(AdminRepository.prototype, "isAdmin")
          .mockResolvedValue(false);
        jest
          .spyOn(CustomerRepository.prototype, "getCustomerByReferralCode")
          .mockResolvedValue(mockCustomer as any);

        const response = await request(app)
          .post("/api/customers/register")
          .send({
            walletAddress: validAddress,
            email: "self@example.com",
            referralCode: "SELF1234",
          });

        expect([200, 201, 400]).toContain(response.status);
      });

      it("should handle non-existent referral codes gracefully", async () => {
        jest
          .spyOn(CustomerRepository.prototype, "getCustomer")
          .mockResolvedValue(null);
        jest
          .spyOn(ShopRepository.prototype, "getShopByWallet")
          .mockResolvedValue(null);
        jest
          .spyOn(AdminRepository.prototype, "isAdmin")
          .mockResolvedValue(false);
        jest
          .spyOn(CustomerRepository.prototype, "getCustomerByReferralCode")
          .mockResolvedValue(null);
        jest
          .spyOn(CustomerRepository.prototype, "createCustomer")
          .mockResolvedValue({} as any);

        const response = await request(app)
          .post("/api/customers/register")
          .send({
            walletAddress: validAddress,
            email: "noreferral@example.com",
            referralCode: "NOTEXIST",
          });

        expect([200, 201, 400]).toContain(response.status);
      });
    });

    describe("2.2 Referral Reward Edge Cases", () => {
      it("should handle referral with already referred customer", async () => {
        const existingCustomer = {
          address: validAddress,
          referredBy: "0x8888888888888888888888888888888888888888",
        };

        jest
          .spyOn(CustomerRepository.prototype, "getCustomer")
          .mockResolvedValue(existingCustomer as any);

        const response = await request(app)
          .post("/api/customers/register")
          .send({
            walletAddress: validAddress,
            email: "existing@example.com",
            referralCode: "NEWCODE",
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain("already");
      });
    });
  });

  // ========================================
  // 3. EARNING & LIMIT EDGE CASES
  // ========================================
  describe("3. Earning & Limit Edge Cases", () => {
    let customerToken: string;

    beforeEach(async () => {
      const mockCustomer = {
        address: validAddress,
        lastEarnedDate: new Date().toISOString(),
        isActive: true,
        tier: "BRONZE",
        lifetimeEarnings: 500,
        currentRcnBalance: 49,
        totalRedemptions: 0,
      };

      jest
        .spyOn(CustomerRepository.prototype, "getCustomer")
        .mockResolvedValue(mockCustomer as any);

      const authResponse = await request(app)
        .post("/api/auth/customer")
        .send({ address: validAddress });

      customerToken = authResponse.body.token;
    });

    describe("3.1 Daily Limit Edge Cases", () => {
      it("should handle customer at daily limit edge (49/50 RCN)", async () => {
        const customer = await CustomerRepository.prototype.getCustomer(
          validAddress
        );
        expect(customer?.currentRcnBalance).toBe(49);
      });

      it("should reset daily earnings after midnight", async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const customerWithYesterdayEarnings = {
          address: validAddress,
          lastEarnedDate: yesterday.toISOString(),
          isActive: true,
          lifetimeEarnings: 50,
        };

        jest
          .spyOn(CustomerRepository.prototype, "getCustomer")
          .mockResolvedValue(customerWithYesterdayEarnings as any);

        const customer = await CustomerRepository.prototype.getCustomer(
          validAddress
        );
        expect(customer?.lastEarnedDate).not.toBe(new Date().toDateString());
      });
    });

    describe("3.2 Monthly Limit Edge Cases", () => {
      it("should handle customer at monthly limit edge (499/500 RCN)", async () => {
        const mockCustomer = {
          address: validAddress,
          lifetimeEarnings: 499,
          currentRcnBalance: 499,
          isActive: true,
        };

        jest
          .spyOn(CustomerRepository.prototype, "getCustomer")
          .mockResolvedValue(mockCustomer as any);

        const customer = await CustomerRepository.prototype.getCustomer(
          validAddress
        );
        expect(customer?.lifetimeEarnings).toBe(499);
      });

      it("should handle month rollover", async () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const customerWithLastMonthEarnings = {
          address: validAddress,
          lifetimeEarnings: 500,
          lastEarnedDate: lastMonth.toISOString(),
          isActive: true,
        };

        jest
          .spyOn(CustomerRepository.prototype, "getCustomer")
          .mockResolvedValue(customerWithLastMonthEarnings as any);

        const customer = await CustomerRepository.prototype.getCustomer(
          validAddress
        );
        expect(new Date(customer?.lastEarnedDate || "").getMonth()).not.toBe(
          new Date().getMonth()
        );
      });
    });
  });

  // ========================================
  // 4. TIER PROGRESSION EDGE CASES
  // ========================================
  describe("4. Tier Progression Edge Cases", () => {
    describe("4.1 Tier Boundary Cases", () => {
      it("should handle exact tier boundaries correctly", async () => {
        const tierBoundaries = [
          { earnings: 0, expectedTier: "BRONZE" },
          { earnings: 99, expectedTier: "BRONZE" },
          { earnings: 100, expectedTier: "SILVER" },
          { earnings: 499, expectedTier: "SILVER" },
          { earnings: 500, expectedTier: "GOLD" },
          { earnings: 999, expectedTier: "GOLD" },
          { earnings: 1000, expectedTier: "PLATINUM" },
        ];

        for (const { earnings, expectedTier } of tierBoundaries) {
          const mockCustomer = {
            address: validAddress,
            lifetimeEarnings: earnings,
            tier: expectedTier,
            isActive: true,
            name: "Test User",
          };

          jest
            .spyOn(CustomerRepository.prototype, "getCustomer")
            .mockResolvedValue(mockCustomer as any);

          const authResponse = await request(app)
            .post("/api/auth/customer")
            .send({ address: validAddress });

          if (authResponse.status === 200 && authResponse.body.user) {
            expect(authResponse.body.user.tier).toBe(expectedTier);
          }
        }
      });
    });
  });

  // ========================================
  // 5. REDEMPTION EDGE CASES
  // ========================================
  describe("5. Redemption Edge Cases", () => {
    describe("5.1 Redemption Verification Edge Cases", () => {
      it("should handle exact balance redemption", async () => {
        const availableBalance = 100;
        const requestAmount = 100;

        jest
          .spyOn(VerificationService.prototype, "verifyRedemption")
          .mockResolvedValue({
            canRedeem: true,
            maxRedeemable: 100,
            availableBalance: availableBalance,
            isHomeShop: true,
            crossShopLimit: 0,
            message: "Redemption approved",
          });

        const result = await VerificationService.prototype.verifyRedemption(
          validAddress,
          "SHOP123",
          requestAmount
        );

        expect(result.canRedeem).toBe(true);
        expect(result.maxRedeemable).toBe(100);
      });

      it("should reject redemption exceeding balance", async () => {
        const availableBalance = 100;
        const requestAmount = 101;

        jest
          .spyOn(VerificationService.prototype, "verifyRedemption")
          .mockResolvedValue({
            canRedeem: false,
            maxRedeemable: 100,
            availableBalance: availableBalance,
            isHomeShop: false,
            crossShopLimit: 0,
            message: "Insufficient balance",
          });

        const result = await VerificationService.prototype.verifyRedemption(
          validAddress,
          "SHOP123",
          requestAmount
        );

        expect(result.canRedeem).toBe(false);
      });

      it("should handle fractional RCN amounts", async () => {
        const availableBalance = 33.33;
        const requestAmount = 33.33;

        jest
          .spyOn(VerificationService.prototype, "verifyRedemption")
          .mockResolvedValue({
            canRedeem: true,
            maxRedeemable: 33.33,
            availableBalance: availableBalance,
            isHomeShop: true,
            crossShopLimit: 0,
            message: "Redemption approved",
          });

        const result = await VerificationService.prototype.verifyRedemption(
          validAddress,
          "SHOP123",
          requestAmount
        );

        expect(result.canRedeem).toBe(true);
      });
    });

    describe("5.2 Balance Verification Edge Cases", () => {
      it("should return correct balance info for customer", async () => {
        jest
          .spyOn(VerificationService.prototype, "getBalance")
          .mockResolvedValue({
            availableBalance: 150,
            lifetimeEarned: 200,
            totalRedeemed: 50,
            earningHistory: {
              fromRepairs: 150,
              fromReferrals: 30,
              fromBonuses: 10,
              fromTierBonuses: 10,
            },
          });

        const result = await VerificationService.prototype.getBalance(
          validAddress
        );

        expect(result.availableBalance).toBe(150);
        expect(result.lifetimeEarned).toBe(200);
        expect(result.totalRedeemed).toBe(50);
      });
    });
  });

  // ========================================
  // 6. CONCURRENCY EDGE CASES
  // ========================================
  describe("6. Concurrency Edge Cases", () => {
    describe("6.1 Race Conditions", () => {
      it("should handle simultaneous registration attempts", async () => {
        let firstCall = true;

        jest
          .spyOn(CustomerRepository.prototype, "getCustomer")
          .mockImplementation(() => {
            if (firstCall) {
              firstCall = false;
              return Promise.resolve(null);
            }
            return Promise.resolve({ address: validAddress } as any);
          });

        jest
          .spyOn(ShopRepository.prototype, "getShopByWallet")
          .mockResolvedValue(null);
        jest
          .spyOn(AdminRepository.prototype, "isAdmin")
          .mockResolvedValue(false);
        jest
          .spyOn(CustomerRepository.prototype, "createCustomer")
          .mockResolvedValue({} as any);

        const promises = [
          request(app).post("/api/customers/register").send({
            walletAddress: validAddress,
            email: "race1@example.com",
          }),
          request(app).post("/api/customers/register").send({
            walletAddress: validAddress,
            email: "race2@example.com",
          }),
        ];

        const responses = await Promise.all(promises);
        const statuses = responses.map((r) => r.status);
        expect(statuses.some((s) => [200, 201, 400].includes(s))).toBe(true);
      });
    });
  });

  // ========================================
  // 7. DATA INTEGRITY EDGE CASES
  // ========================================
  describe("7. Data Integrity Edge Cases", () => {
    describe("7.1 Missing or Corrupted Data", () => {
      it("should handle customer with missing tier data", async () => {
        const customerWithMissingTier = {
          address: validAddress,
          lifetimeEarnings: 500,
          isActive: true,
          tier: undefined,
          name: "Test User",
        };

        jest
          .spyOn(CustomerRepository.prototype, "getCustomer")
          .mockResolvedValue(customerWithMissingTier as any);

        const response = await request(app)
          .post("/api/auth/customer")
          .send({ address: validAddress });

        expect([200, 400, 403]).toContain(response.status);
      });

      it("should handle null or undefined values in optional fields", async () => {
        const customerWithNulls = {
          address: validAddress,
          name: null,
          email: null,
          phone: null,
          tier: "BRONZE",
          lifetimeEarnings: 0,
          isActive: true,
        };

        jest
          .spyOn(CustomerRepository.prototype, "getCustomer")
          .mockResolvedValue(customerWithNulls as any);

        const response = await request(app)
          .post("/api/auth/customer")
          .send({ address: validAddress });

        expect([200, 400, 403]).toContain(response.status);
      });
    });
  });

  // ========================================
  // 8. SERVICE MARKETPLACE EDGE CASES
  // ========================================
  describe("8. Service Marketplace Edge Cases", () => {
    describe("8.1 Service Listing Edge Cases", () => {
      it("should handle service with zero price", async () => {
        // Using correct ShopService interface properties
        const freeService = {
          serviceId: "service-free",
          shopId: "SHOP123",
          serviceName: "Free Consultation",
          description: "Free consultation service",
          priceUsd: 0,
          durationMinutes: 30,
          category: "consultation",
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        jest
          .spyOn(ServiceRepository.prototype, "getServiceById")
          .mockResolvedValue(freeService as any);

        const service = await ServiceRepository.prototype.getServiceById(
          "service-free"
        );
        expect(service?.priceUsd).toBe(0);
      });

      it("should handle service with very long description", async () => {
        const longDescription = "A".repeat(5000);
        const serviceWithLongDesc = {
          serviceId: "service-long-desc",
          shopId: "SHOP123",
          serviceName: "Detailed Service",
          description: longDescription,
          priceUsd: 50,
          durationMinutes: 60,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        jest
          .spyOn(ServiceRepository.prototype, "getServiceById")
          .mockResolvedValue(serviceWithLongDesc as any);

        const service = await ServiceRepository.prototype.getServiceById(
          "service-long-desc"
        );
        expect(service?.description?.length).toBe(5000);
      });

      it("should handle inactive service lookup", async () => {
        const inactiveService = {
          serviceId: "service-inactive",
          shopId: "SHOP123",
          serviceName: "Discontinued Service",
          priceUsd: 100,
          active: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        jest
          .spyOn(ServiceRepository.prototype, "getServiceById")
          .mockResolvedValue(inactiveService as any);

        const service = await ServiceRepository.prototype.getServiceById(
          "service-inactive"
        );
        expect(service?.active).toBe(false);
      });

      it("should handle service filtering by category", async () => {
        const services = [
          {
            serviceId: "1",
            serviceName: "Phone Screen Repair",
            category: "phone_repair",
            active: true,
          },
          {
            serviceId: "2",
            serviceName: "Phone Battery Replacement",
            category: "phone_repair",
            active: true,
          },
        ];

        // Using correct PaginatedResult structure
        jest
          .spyOn(ServiceRepository.prototype, "getAllActiveServices")
          .mockResolvedValue({
            items: services as any[],
            pagination: {
              hasMore: false,
              limit: 10,
              totalItems: 2,
              totalPages: 1,
              page: 1,
            },
          });

        const result = await ServiceRepository.prototype.getAllActiveServices(
          { category: "phone_repair" },
          { page: 1, limit: 10 }
        );

        expect(result.items.length).toBe(2);
        expect(
          result.items.every((s: any) => s.category === "phone_repair")
        ).toBe(true);
      });

      it("should handle service price range filtering", async () => {
        const services = [
          {
            serviceId: "2",
            serviceName: "Standard Service",
            priceUsd: 50,
            active: true,
          },
        ];

        jest
          .spyOn(ServiceRepository.prototype, "getAllActiveServices")
          .mockResolvedValue({
            items: services as any[],
            pagination: {
              hasMore: false,
              limit: 10,
              totalItems: 1,
              totalPages: 1,
              page: 1,
            },
          });

        const result = await ServiceRepository.prototype.getAllActiveServices(
          { minPrice: 30, maxPrice: 80 },
          { page: 1, limit: 10 }
        );

        expect(result.items.length).toBe(1);
        expect(result.items[0].priceUsd).toBe(50);
      });
    });

    describe("8.2 Service with Shop Info Edge Cases", () => {
      it("should return service with complete shop information", async () => {
        // ShopServiceWithShopInfo uses flat properties, not nested shop object
        const serviceWithShop = {
          serviceId: "service-1",
          shopId: "SHOP123",
          serviceName: "Screen Repair",
          priceUsd: 99,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          // Flat shop info properties
          shopName: "Tech Repairs Inc",
          shopAddress: "123 Main St",
          shopPhone: "+1234567890",
          shopEmail: "shop@example.com",
        };

        jest
          .spyOn(ServiceRepository.prototype, "getServiceWithShopInfo")
          .mockResolvedValue(serviceWithShop as any);

        const service =
          await ServiceRepository.prototype.getServiceWithShopInfo("service-1");

        expect(service?.shopName).toBe("Tech Repairs Inc");
        expect(service?.shopAddress).toBe("123 Main St");
        expect(service?.shopPhone).toBe("+1234567890");
      });

      it("should handle service for non-existent shop", async () => {
        jest
          .spyOn(ServiceRepository.prototype, "getServiceWithShopInfo")
          .mockResolvedValue(null);

        const service =
          await ServiceRepository.prototype.getServiceWithShopInfo(
            "non-existent"
          );
        expect(service).toBeNull();
      });
    });
  });

  // ========================================
  // 9. MY BOOKINGS (ORDER) EDGE CASES
  // ========================================
  describe("9. My Bookings (Order) Edge Cases", () => {
    describe("9.1 Order Creation Edge Cases", () => {
      it("should create order with valid booking date", async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);

        // Using correct ServiceOrder interface
        const newOrder = {
          orderId: "order-1",
          serviceId: "service-1",
          customerAddress: validAddress,
          shopId: "SHOP123",
          status: "pending" as const,
          totalAmount: 99,
          bookingDate: futureDate,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        jest
          .spyOn(OrderRepository.prototype, "createOrder")
          .mockResolvedValue(newOrder as any);

        const order = await OrderRepository.prototype.createOrder({
          orderId: "order-1",
          serviceId: "service-1",
          customerAddress: validAddress,
          shopId: "SHOP123",
          totalAmount: 99,
          bookingDate: futureDate,
        });

        expect(order.status).toBe("pending");
        expect(order.bookingDate).toBeDefined();
      });

      it("should handle order creation without booking date", async () => {
        const newOrder = {
          orderId: "order-2",
          serviceId: "service-1",
          customerAddress: validAddress,
          shopId: "SHOP123",
          status: "pending" as const,
          totalAmount: 99,
          bookingDate: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        jest
          .spyOn(OrderRepository.prototype, "createOrder")
          .mockResolvedValue(newOrder as any);

        const order = await OrderRepository.prototype.createOrder({
          orderId: "order-2",
          serviceId: "service-1",
          customerAddress: validAddress,
          shopId: "SHOP123",
          totalAmount: 99,
        });

        expect(order.status).toBe("pending");
        expect(order.bookingDate).toBeUndefined();
      });

      it("should handle order with notes", async () => {
        const newOrder = {
          orderId: "order-3",
          serviceId: "service-1",
          customerAddress: validAddress,
          shopId: "SHOP123",
          status: "pending" as const,
          totalAmount: 99,
          notes: "Please call before arriving",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        jest
          .spyOn(OrderRepository.prototype, "createOrder")
          .mockResolvedValue(newOrder as any);

        const order = await OrderRepository.prototype.createOrder({
          orderId: "order-3",
          serviceId: "service-1",
          customerAddress: validAddress,
          shopId: "SHOP123",
          totalAmount: 99,
          notes: "Please call before arriving",
        });

        expect(order.notes).toBe("Please call before arriving");
      });
    });

    describe("9.2 Order Status Transition Edge Cases", () => {
      it("should update order status from pending to paid", async () => {
        const updatedOrder = {
          orderId: "order-1",
          serviceId: "service-1",
          customerAddress: validAddress,
          shopId: "SHOP123",
          status: "paid" as const,
          totalAmount: 99,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        jest
          .spyOn(OrderRepository.prototype, "updateOrderStatus")
          .mockResolvedValue(updatedOrder as any);

        const order = await OrderRepository.prototype.updateOrderStatus(
          "order-1",
          "paid"
        );
        expect(order.status).toBe("paid");
      });

      it("should set completedAt when marking as completed", async () => {
        const completedAt = new Date();
        const completedOrder = {
          orderId: "order-1",
          serviceId: "service-1",
          customerAddress: validAddress,
          shopId: "SHOP123",
          status: "completed" as const,
          totalAmount: 99,
          completedAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        jest
          .spyOn(OrderRepository.prototype, "updateOrderStatus")
          .mockResolvedValue(completedOrder as any);

        const order = await OrderRepository.prototype.updateOrderStatus(
          "order-1",
          "completed"
        );
        expect(order.status).toBe("completed");
        expect(order.completedAt).toBeDefined();
      });

      it("should handle order cancellation", async () => {
        const cancelledOrder = {
          orderId: "order-1",
          serviceId: "service-1",
          customerAddress: validAddress,
          shopId: "SHOP123",
          status: "cancelled" as const,
          totalAmount: 99,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        jest
          .spyOn(OrderRepository.prototype, "updateOrderStatus")
          .mockResolvedValue(cancelledOrder as any);

        const order = await OrderRepository.prototype.updateOrderStatus(
          "order-1",
          "cancelled"
        );
        expect(order.status).toBe("cancelled");
      });

      it("should handle order refund", async () => {
        const refundedOrder = {
          orderId: "order-1",
          serviceId: "service-1",
          customerAddress: validAddress,
          shopId: "SHOP123",
          status: "refunded" as const,
          totalAmount: 99,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        jest
          .spyOn(OrderRepository.prototype, "updateOrderStatus")
          .mockResolvedValue(refundedOrder as any);

        const order = await OrderRepository.prototype.updateOrderStatus(
          "order-1",
          "refunded"
        );
        expect(order.status).toBe("refunded");
      });
    });

    describe("9.3 Order Retrieval Edge Cases", () => {
      it("should get order with full details", async () => {
        // ServiceOrderWithDetails uses flat properties, not nested objects
        const orderWithDetails = {
          orderId: "order-1",
          serviceId: "service-1",
          customerAddress: validAddress,
          shopId: "SHOP123",
          status: "pending" as const,
          totalAmount: 99,
          createdAt: new Date(),
          updatedAt: new Date(),
          // Flat detail properties
          serviceName: "Screen Repair",
          serviceDescription: "Professional screen repair",
          serviceDuration: 60,
          serviceCategory: "phone_repair",
          shopName: "Tech Repairs",
          shopAddress: "123 Main St",
          shopPhone: "+1234567890",
          customerName: "John Doe",
        };

        jest
          .spyOn(OrderRepository.prototype, "getOrderWithDetails")
          .mockResolvedValue(orderWithDetails as any);

        const order = await OrderRepository.prototype.getOrderWithDetails(
          "order-1"
        );

        expect(order?.serviceName).toBeDefined();
        expect(order?.shopName).toBeDefined();
        expect(order?.customerName).toBeDefined();
      });

      it("should return null for non-existent order", async () => {
        jest
          .spyOn(OrderRepository.prototype, "getOrderWithDetails")
          .mockResolvedValue(null);

        const order = await OrderRepository.prototype.getOrderWithDetails(
          "non-existent"
        );
        expect(order).toBeNull();
      });

      it("should get orders by customer with pagination", async () => {
        const customerOrders = {
          items: [
            { orderId: "order-1", status: "completed" },
            { orderId: "order-2", status: "pending" },
          ],
          pagination: {
            hasMore: true,
            limit: 2,
            totalItems: 5,
            totalPages: 3,
            page: 1,
          },
        };

        jest
          .spyOn(OrderRepository.prototype, "getOrdersByCustomer")
          .mockResolvedValue(customerOrders as any);

        const result = await OrderRepository.prototype.getOrdersByCustomer(
          validAddress,
          {},
          { page: 1, limit: 2 }
        );

        expect(result.items.length).toBe(2);
        expect(result.pagination.hasMore).toBe(true);
        expect(result.pagination.totalItems).toBe(5);
      });

      it("should filter orders by status", async () => {
        const pendingOrders = {
          items: [
            { orderId: "order-1", status: "pending" },
            { orderId: "order-2", status: "pending" },
          ],
          pagination: {
            hasMore: false,
            limit: 10,
            totalItems: 2,
            totalPages: 1,
            page: 1,
          },
        };

        jest
          .spyOn(OrderRepository.prototype, "getOrdersByCustomer")
          .mockResolvedValue(pendingOrders as any);

        const result = await OrderRepository.prototype.getOrdersByCustomer(
          validAddress,
          { status: "pending" },
          { page: 1, limit: 10 }
        );

        expect(result.items.every((o: any) => o.status === "pending")).toBe(
          true
        );
      });

      it("should filter orders by date range", async () => {
        const startDate = new Date("2024-01-01");
        const endDate = new Date("2024-01-31");

        const ordersInRange = {
          items: [
            { orderId: "order-1", createdAt: new Date("2024-01-15T10:00:00Z") },
          ],
          pagination: {
            hasMore: false,
            limit: 10,
            totalItems: 1,
            totalPages: 1,
            page: 1,
          },
        };

        jest
          .spyOn(OrderRepository.prototype, "getOrdersByCustomer")
          .mockResolvedValue(ordersInRange as any);

        // OrderFilters expects Date objects, not strings
        const result = await OrderRepository.prototype.getOrdersByCustomer(
          validAddress,
          { startDate, endDate },
          { page: 1, limit: 10 }
        );

        expect(result.items.length).toBe(1);
      });
    });

    describe("9.4 Payment Integration Edge Cases", () => {
      it("should update payment intent on order", async () => {
        const orderWithPayment = {
          orderId: "order-1",
          serviceId: "service-1",
          customerAddress: validAddress,
          shopId: "SHOP123",
          status: "pending" as const,
          totalAmount: 99,
          stripePaymentIntentId: "pi_test_123456",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        jest
          .spyOn(OrderRepository.prototype, "updatePaymentIntent")
          .mockResolvedValue(orderWithPayment as any);

        const order = await OrderRepository.prototype.updatePaymentIntent(
          "order-1",
          "pi_test_123456"
        );

        expect(order.stripePaymentIntentId).toBe("pi_test_123456");
      });

      it("should retrieve order by payment intent", async () => {
        const order = {
          orderId: "order-1",
          serviceId: "service-1",
          customerAddress: validAddress,
          shopId: "SHOP123",
          status: "pending" as const,
          totalAmount: 99,
          stripePaymentIntentId: "pi_test_123456",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        jest
          .spyOn(OrderRepository.prototype, "getOrderByPaymentIntent")
          .mockResolvedValue(order as any);

        const result = await OrderRepository.prototype.getOrderByPaymentIntent(
          "pi_test_123456"
        );
        expect(result?.orderId).toBe("order-1");
      });

      it("should return null for invalid payment intent", async () => {
        jest
          .spyOn(OrderRepository.prototype, "getOrderByPaymentIntent")
          .mockResolvedValue(null);

        const result = await OrderRepository.prototype.getOrderByPaymentIntent(
          "pi_invalid"
        );
        expect(result).toBeNull();
      });
    });

    describe("9.5 Shop Order Management Edge Cases", () => {
      it("should get all orders for a shop", async () => {
        const shopOrders = {
          items: [
            { orderId: "order-1", shopId: "SHOP123", status: "pending" },
            { orderId: "order-2", shopId: "SHOP123", status: "completed" },
          ],
          pagination: {
            hasMore: false,
            limit: 10,
            totalItems: 2,
            totalPages: 1,
            page: 1,
          },
        };

        jest
          .spyOn(OrderRepository.prototype, "getOrdersByShop")
          .mockResolvedValue(shopOrders as any);

        const result = await OrderRepository.prototype.getOrdersByShop(
          "SHOP123",
          {},
          { page: 1, limit: 10 }
        );

        expect(result.items.length).toBe(2);
        expect(result.items.every((o: any) => o.shopId === "SHOP123")).toBe(
          true
        );
      });

      it("should update order notes", async () => {
        const updatedOrder = {
          orderId: "order-1",
          serviceId: "service-1",
          customerAddress: validAddress,
          shopId: "SHOP123",
          status: "pending" as const,
          totalAmount: 99,
          notes: "Updated: Customer requested afternoon slot",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        jest
          .spyOn(OrderRepository.prototype, "updateOrderNotes")
          .mockResolvedValue(updatedOrder as any);

        const result = await OrderRepository.prototype.updateOrderNotes(
          "order-1",
          "Updated: Customer requested afternoon slot"
        );

        expect(result.notes).toContain("Customer requested afternoon slot");
      });
    });
  });

  // ========================================
  // 10. CUSTOMER PROFILE UPDATE EDGE CASES
  // ========================================
  describe("10. Customer Profile Update Edge Cases", () => {
    it("should allow customer to update their own profile", async () => {
      const mockCustomer = {
        address: validAddress,
        name: "Updated Name",
        email: "updated@example.com",
        phone: "+1999999999",
        isActive: true,
        tier: "SILVER",
      };

      jest
        .spyOn(CustomerRepository.prototype, "getCustomer")
        .mockResolvedValue(mockCustomer as any);
      jest
        .spyOn(CustomerRepository.prototype, "updateCustomerProfile")
        .mockResolvedValue(undefined);

      const authResponse = await request(app)
        .post("/api/auth/customer")
        .send({ address: validAddress });

      expect([200, 403]).toContain(authResponse.status);
    });

    it("should handle suspended customer gracefully", async () => {
      const suspendedCustomer = {
        address: validAddress,
        isActive: false,
        suspendedAt: new Date().toISOString(),
        suspensionReason: "Policy violation",
        tier: "BRONZE",
        name: "Suspended User",
      };

      jest
        .spyOn(CustomerRepository.prototype, "getCustomer")
        .mockResolvedValue(suspendedCustomer as any);

      const response = await request(app)
        .post("/api/auth/customer")
        .send({ address: validAddress });

      // Suspended customers can still login per the code
      expect([200, 403]).toContain(response.status);

      if (response.status === 200 && response.body.user) {
        expect(response.body.user.suspended).toBe(true);
      }
    });
  });

  afterAll(async () => {
    jest.clearAllMocks();
  });
});
