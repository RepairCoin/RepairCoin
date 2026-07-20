/**
 * T3.2 Slice 3 — AiOverageStripeService: flag gate, no-pending / no-customer guards, happy-path
 * invoice + reconcile, and invoiceAllDue. Mocks Stripe + shopRepository + the pool; the charges repo
 * is injected. No DB / no network.
 */
jest.mock("../../src/services/StripeService", () => ({ getStripeService: jest.fn() }));
jest.mock("../../src/repositories", () => ({ shopRepository: { getShop: jest.fn() } }));
jest.mock("../../src/utils/database-pool", () => ({
  getSharedPool: jest.fn(() => ({ query: jest.fn().mockResolvedValue({ rows: [] }) })),
}));

import { AiOverageStripeService } from "../../src/domains/AIAgentDomain/services/AiOverageStripeService";
import { getStripeService } from "../../src/services/StripeService";
import { shopRepository } from "../../src/repositories";

const mockedStripe = getStripeService as jest.Mock;
const mockedGetShop = (shopRepository as any).getShop as jest.Mock;

function svc(over: any = {}) {
  const marked: any[] = [];
  const charges = {
    pendingForShop:
      over.pendingForShop ?? (async () => [{ id: "c1", periodMonth: "2026-06-01", amountCents: 12 }]),
    markStatus: over.markStatus ?? (async (ids: string[], status: string, inv?: string) => { marked.push({ ids, status, inv }); }),
    listShopsWithPending: over.listShopsWithPending ?? (async () => []),
  } as any;
  return { s: new AiOverageStripeService(charges), charges, marked };
}

describe("AiOverageStripeService.invoiceShopPending", () => {
  const ORIG = process.env.AI_OVERAGE_STRIPE_ENABLED;
  beforeEach(() => { process.env.AI_OVERAGE_STRIPE_ENABLED = "true"; mockedStripe.mockReset(); mockedGetShop.mockReset(); });
  afterEach(() => { process.env.AI_OVERAGE_STRIPE_ENABLED = ORIG; });

  it("throws 400 when there's nothing pending", async () => {
    const { s } = svc({ pendingForShop: async () => [] });
    await expect(s.invoiceShopPending("shop1")).rejects.toMatchObject({ status: 400 });
  });

  it("throws 501 when the master flag is off (pending exists)", async () => {
    process.env.AI_OVERAGE_STRIPE_ENABLED = "false";
    const { s } = svc();
    await expect(s.invoiceShopPending("shop1")).rejects.toMatchObject({ status: 501 });
  });

  it("throws 409 when the shop has no Stripe customer", async () => {
    mockedGetShop.mockResolvedValue({}); // no stripeCustomerId; pool fallback returns []
    const { s } = svc();
    await expect(s.invoiceShopPending("shop1")).rejects.toMatchObject({ status: 409 });
  });

  it("invoices + marks paid on the happy path", async () => {
    mockedGetShop.mockResolvedValue({ stripeCustomerId: "cus_1" });
    const createImmediateInvoice = jest.fn().mockResolvedValue({ id: "in_1", status: "paid" });
    mockedStripe.mockReturnValue({ createImmediateInvoice });
    const { s, marked } = svc();
    const r = await s.invoiceShopPending("shop1");
    expect(createImmediateInvoice).toHaveBeenCalledWith(
      "cus_1",
      [{ amountCents: 12, description: expect.stringContaining("AI Usage Overage") }],
      expect.objectContaining({ kind: "ai_overage_billing", shop_id: "shop1" })
    );
    expect(marked).toEqual([{ ids: ["c1"], status: "paid", inv: "in_1" }]);
    expect(r).toEqual({ stripeInvoiceId: "in_1", totalCents: 12, status: "paid" });
  });

  it("marks 'invoiced' when the invoice isn't immediately paid", async () => {
    mockedGetShop.mockResolvedValue({ stripeCustomerId: "cus_1" });
    mockedStripe.mockReturnValue({ createImmediateInvoice: jest.fn().mockResolvedValue({ id: "in_2", status: "open" }) });
    const { s, marked } = svc();
    const r = await s.invoiceShopPending("shop1");
    expect(marked[0].status).toBe("invoiced");
    expect(r.status).toBe("invoiced");
  });
});

describe("AiOverageStripeService.invoiceAllDue", () => {
  const ORIG = process.env.AI_OVERAGE_STRIPE_ENABLED;
  afterEach(() => { process.env.AI_OVERAGE_STRIPE_ENABLED = ORIG; });

  it("is a no-op returning [] when the flag is off", async () => {
    process.env.AI_OVERAGE_STRIPE_ENABLED = "false";
    const { s } = svc({ listShopsWithPending: async () => ["a", "b"] });
    expect(await s.invoiceAllDue()).toEqual([]);
  });

  it("invoices each due shop and reports per-shop outcomes (one failure doesn't stop the rest)", async () => {
    process.env.AI_OVERAGE_STRIPE_ENABLED = "true";
    mockedGetShop.mockResolvedValue({ stripeCustomerId: "cus_1" });
    mockedStripe.mockReturnValue({ createImmediateInvoice: jest.fn().mockResolvedValue({ id: "in_x", status: "paid" }) });
    let call = 0;
    const { s } = svc({
      listShopsWithPending: async () => ["ok-shop", "empty-shop"],
      // second shop has no pending → invoiceShopPending throws 400 → recorded as failure
      pendingForShop: async () => (call++ === 0 ? [{ id: "c1", periodMonth: "2026-06-01", amountCents: 5 }] : []),
    });
    const results = await s.invoiceAllDue();
    expect(results).toEqual([
      { shopId: "ok-shop", ok: true },
      { shopId: "empty-shop", ok: false, error: expect.any(String) },
    ]);
  });
});
