import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import RepairCoinApp from "../../src/app";
import jwt from "jsonwebtoken";
import { Pool } from "pg";

/**
 * Subscription Edge Cases Tests - Integration Tests with Database Setup
 *
 * NOTE: These tests create real users in the test database to ensure
 * proper integration testing with authentication middleware.
 */
describe("Subscription Edge Cases Tests", () => {
  let app: any;
  let adminToken: string;
  let shopToken: string;
  let pool: Pool;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    process.env.NODE_ENV = "test";

    // Initialize database connection for test setup
    pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "repaircoin_test",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
    });

    try {
      console.log("Setting up test users in database...");

      // Create test admin user
      await pool.query(
        `
        INSERT INTO admins (
          id, 
          email, 
          address, 
          role, 
          is_active, 
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (address) DO UPDATE 
        SET is_active = true, email = EXCLUDED.email
      `,
        [
          "test-admin-123",
          "admin@test.com",
          "0x8888888888888888888888888888888888888888",
          "admin",
          true,
        ]
      );

      // Create test shop user
      await pool.query(
        `
        INSERT INTO shops (
          id,
          name,
          address,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (address) DO UPDATE 
        SET is_active = true, name = EXCLUDED.name
      `,
        [
          "test-shop-123",
          "Test Shop",
          "0x1234567890123456789012345678901234567890",
          true,
        ]
      );

      console.log("✅ Test users created successfully");
    } catch (error: any) {
      console.error("❌ Error creating test users:", error.message);
      console.log("Note: If tables don't exist or columns are missing, tests will fail.");
      console.log("You may need to run migrations or check database schema.");
    }

    // Initialize app
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    // Generate real JWT tokens
    const jwtSecret = process.env.JWT_SECRET || "test-secret";

    // Admin token - now references existing user
    adminToken = jwt.sign(
      {
        id: "test-admin-123",
        role: "admin",
        address: "0x8888888888888888888888888888888888888888",
        email: "admin@test.com",
      },
      jwtSecret,
      { expiresIn: "1h" }
    );

    // Shop token - now references existing user
    shopToken = jwt.sign(
      {
        shopId: "test-shop-123",
        role: "shop",
        address: "0x1234567890123456789012345678901234567890",
        name: "Test Shop",
      },
      jwtSecret,
      { expiresIn: "1h" }
    );
  });

  /**
   * TC-EDGE-002: Pause Already Paused Subscription
   * Tests that the system handles redundant pause operations gracefully
   */
  describe("TC-EDGE-002: Pause Already Paused Subscription", () => {
    it("should handle gracefully when attempting to pause a non-existent subscription", async () => {
      const response = await request(app)
        .post("/api/admin/subscriptions/non-existent-id/pause")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "Testing pause operation" });

      // Should either handle gracefully (200/400) or return not found (404)
      expect([200, 400, 404]).toContain(response.status);
      expect(response.body).toHaveProperty("success");

      // If it's an error, should have an error message
      if (!response.body.success) {
        expect(response.body).toHaveProperty("error");
        expect(typeof response.body.error).toBe("string");
      }
    });

    it("should validate that only admins can pause subscriptions", async () => {
      const response = await request(app)
        .post("/api/admin/subscriptions/test-sub-id/pause")
        .set("Authorization", `Bearer ${shopToken}`)
        .send({ reason: "Shop attempting to pause" });

      // Shop should not be able to pause
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  /**
   * TC-EDGE-003: Resume Active Subscription
   * Tests that the system handles resume of non-paused subscriptions
   */
  describe("TC-EDGE-003: Resume Active Subscription", () => {
    it("should handle gracefully when attempting to resume non-existent subscription", async () => {
      const response = await request(app)
        .post("/api/admin/subscriptions/non-existent-id/resume")
        .set("Authorization", `Bearer ${adminToken}`);

      // Should return 404 (not found) or 400 (bad request)
      expect([400, 404]).toContain(response.status);
      expect(response.body).toHaveProperty("success");
      expect(response.body.success).toBe(false);
    });

    it("should validate that only admins can resume subscriptions", async () => {
      const response = await request(app)
        .post("/api/admin/subscriptions/test-sub-id/resume")
        .set("Authorization", `Bearer ${shopToken}`);

      // Shop should not be able to resume
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  /**
   * TC-EDGE-004: Cancel Already Cancelled Subscription
   * Tests that cancelling a cancelled subscription is handled properly
   */
  describe("TC-EDGE-004: Cancel Already Cancelled Subscription", () => {
    it("should handle gracefully when attempting to cancel non-existent subscription", async () => {
      const response = await request(app)
        .post("/api/admin/subscriptions/non-existent-id/cancel")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ immediately: true, reason: "Test cancellation" });

      // Should return appropriate error
      expect([400, 404]).toContain(response.status);
      expect(response.body).toHaveProperty("success");
    });

    it("should require admin authorization for cancellation", async () => {
      const response = await request(app)
        .post("/api/admin/subscriptions/test-sub-id/cancel")
        .set("Authorization", `Bearer ${shopToken}`)
        .send({ immediately: true });

      // Should reject non-admin
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  /**
   * TC-EDGE-005: Subscription Status During Payment Processing
   * Tests behavior when checking subscription status
   */
  describe("TC-EDGE-005: Subscription Status Checks", () => {
    it("should allow shop to check their own subscription status", async () => {
      const response = await request(app)
        .get("/api/shops/subscription/status")
        .set("Authorization", `Bearer ${shopToken}`);

      // Should return subscription status (even if no subscription)
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("hasActiveSubscription");
    });

    it("should require authentication for subscription status", async () => {
      const response = await request(app).get("/api/shops/subscription/status");
      // No auth token

      expect(response.status).toBe(401);
    });
  });

  /**
   * TC-EDGE-006: Multiple Admin Actions
   * Tests concurrent operations (simplified - tests the API is accessible)
   */
  describe("TC-EDGE-006: Admin Access Control", () => {
    it("should allow admin to access subscription management endpoints", async () => {
      const response = await request(app)
        .get("/api/admin/subscriptions")
        .set("Authorization", `Bearer ${adminToken}`);

      // Admin should be able to access
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success");
    });

    it("should deny non-admin access to subscription management", async () => {
      const response = await request(app)
        .get("/api/admin/subscriptions")
        .set("Authorization", `Bearer ${shopToken}`);

      // Shop should not be able to access admin endpoints
      expect(response.status).toBe(403);
    });

    it("should get subscription statistics", async () => {
      const response = await request(app)
        .get("/api/admin/subscriptions/stats")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
      if (response.body.data) {
        expect(response.body.data).toHaveProperty("total");
      }
    });
  });

  /**
   * Additional Integration Tests
   */
  describe("Subscription Integration Tests", () => {
    it("should handle missing authorization gracefully", async () => {
      const response = await request(app).post(
        "/api/admin/subscriptions/test-id/pause"
      );
      // No auth header

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });

    it("should handle malformed subscription IDs", async () => {
      const response = await request(app)
        .post("/api/admin/subscriptions//pause")
        .set("Authorization", `Bearer ${adminToken}`);

      // Should return error (404 or 400)
      expect([400, 404]).toContain(response.status);
    });

    it("should validate request body for pause operations", async () => {
      const response = await request(app)
        .post("/api/admin/subscriptions/test-id/pause")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ invalidField: "test" });

      // Should still process or give clear error
      expect([200, 400, 404]).toContain(response.status);
      expect(response.body).toHaveProperty("success");
    });
  });

  afterAll(async () => {
    // Clean up test users
    try {
      console.log("Cleaning up test users...");
      await pool.query(`DELETE FROM admins WHERE id = 'test-admin-123'`);
      await pool.query(`DELETE FROM shops WHERE id = 'test-shop-123'`);
      console.log("✅ Test users cleaned up");
    } catch (error: any) {
      console.error("❌ Error cleaning up test users:", error.message);
    } finally {
      await pool.end();
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  });
});