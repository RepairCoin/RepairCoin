/**
 * T3.2 prod-hardening (#5) — the monthly billing cron is gated by AI_OVERAGE_STRIPE_ENABLED and delegates
 * to invoiceAllDue. Injects a mock billing service; no cron scheduling, no DB, no network.
 */
import { AiOverageBillingScheduler } from "../../src/domains/AIAgentDomain/services/AiOverageBillingScheduler";

describe("AiOverageBillingScheduler.tick", () => {
  const ORIG = process.env.AI_OVERAGE_STRIPE_ENABLED;
  afterEach(() => { process.env.AI_OVERAGE_STRIPE_ENABLED = ORIG; });

  it("skips invoicing when AI_OVERAGE_STRIPE_ENABLED is off", async () => {
    process.env.AI_OVERAGE_STRIPE_ENABLED = "false";
    const invoiceAllDue = jest.fn().mockResolvedValue([]);
    await new AiOverageBillingScheduler({ invoiceAllDue } as any).tick();
    expect(invoiceAllDue).not.toHaveBeenCalled();
  });

  it("invoices all due shops when the flag is on (tolerates per-shop failures)", async () => {
    process.env.AI_OVERAGE_STRIPE_ENABLED = "true";
    const invoiceAllDue = jest.fn().mockResolvedValue([
      { shopId: "a", ok: true },
      { shopId: "b", ok: false, error: "no card" },
    ]);
    await new AiOverageBillingScheduler({ invoiceAllDue } as any).tick();
    expect(invoiceAllDue).toHaveBeenCalledTimes(1);
  });

  it("never throws out of tick even if invoicing rejects", async () => {
    process.env.AI_OVERAGE_STRIPE_ENABLED = "true";
    const invoiceAllDue = jest.fn().mockRejectedValue(new Error("stripe down"));
    await expect(new AiOverageBillingScheduler({ invoiceAllDue } as any).tick()).resolves.toBeUndefined();
  });
});
