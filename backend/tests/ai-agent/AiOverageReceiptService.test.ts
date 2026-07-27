/**
 * T3.2 #3 — AiOverageReceiptService: recipient resolution (invoice email → shop email → no-op), amount
 * formatting, and never-throws. Mocks Resend + shopRepository; no network, no DB.
 */
jest.mock("../../src/services/ResendEmailService", () => ({
  resendEmailService: { sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: "m1" }) },
}));
jest.mock("../../src/repositories", () => ({ shopRepository: { getShop: jest.fn() } }));

import { AiOverageReceiptService } from "../../src/domains/AIAgentDomain/services/AiOverageReceiptService";
import { resendEmailService } from "../../src/services/ResendEmailService";
import { shopRepository } from "../../src/repositories";

const mockedSend = (resendEmailService as any).sendEmail as jest.Mock;
const mockedGetShop = (shopRepository as any).getShop as jest.Mock;
const svc = new AiOverageReceiptService();

beforeEach(() => { mockedSend.mockClear(); mockedGetShop.mockReset(); });

describe("AiOverageReceiptService.sendReceipt", () => {
  it("emails the invoice's customer_email with the formatted amount + invoice number", async () => {
    await svc.sendReceipt({ id: "in_1", number: "RC-0001", customer_email: "shop@x.com", amount_paid: 3000, currency: "usd", hosted_invoice_url: "https://h", invoice_pdf: "https://p" }, "shop1");
    expect(mockedSend).toHaveBeenCalledTimes(1);
    const arg = mockedSend.mock.calls[0][0];
    expect(arg.to).toBe("shop@x.com");
    expect(arg.subject).toContain("$30.00");
    expect(arg.html).toContain("30.00");
    expect(arg.html).toContain("RC-0001");
    expect(arg.html).toContain("https://h"); // View invoice button
  });

  it("falls back to the shop's email when the invoice has none", async () => {
    mockedGetShop.mockResolvedValue({ email: "owner@shop.com" });
    await svc.sendReceipt({ id: "in_2", amount_paid: 1500, currency: "usd" }, "shop1");
    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(mockedSend.mock.calls[0][0].to).toBe("owner@shop.com");
  });

  it("no-ops (no send) when neither the invoice nor the shop has an email", async () => {
    mockedGetShop.mockResolvedValue({});
    await svc.sendReceipt({ id: "in_3", amount_paid: 1500 }, "shop1");
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("never throws when the email send rejects", async () => {
    mockedSend.mockRejectedValueOnce(new Error("resend down"));
    await expect(svc.sendReceipt({ id: "in_4", customer_email: "a@b.com", amount_paid: 100 }, "shop1")).resolves.toBeUndefined();
  });
});
