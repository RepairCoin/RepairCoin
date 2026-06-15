// backend/src/domains/AdsDomain/controllers/BillingController.ts
//
// Q4/Q7 ad-management billing — admin-only. Manage a shop's plan (A/B/C + terms),
// view accrued charges, trigger accrual, and (gated) push a Stripe invoice.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { BillingPlanRepository, AdPlanType, PlanCModel, FlatTierName, FLAT_TIER_FEES } from '../repositories/BillingPlanRepository';
import { AdBillingService } from '../services/AdBillingService';
import { AdBillingStripeService } from '../services/AdBillingStripeService';

const plans = new BillingPlanRepository();
const billing = new AdBillingService();
const stripeBilling = new AdBillingStripeService();

const monthStart = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

// GET /shops/:shopId/billing-plan (admin)
export async function getBillingPlan(req: Request, res: Response): Promise<void> {
  try {
    res.json({ success: true, data: await plans.getOrDefault(req.params.shopId) });
  } catch (err) {
    logger.error('BillingController.getBillingPlan failed', err);
    res.status(500).json({ success: false, error: 'Failed to get billing plan' });
  }
}

// PUT /shops/:shopId/billing-plan (admin)
export async function setBillingPlan(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  // 'flat' is the live model ($199/$499/$999); a/b/c are legacy/dormant.
  if (b.planType && !['a', 'b', 'c', 'flat'].includes(b.planType)) {
    res.status(400).json({ success: false, error: "planType must be 'a', 'b', 'c' or 'flat'" });
    return;
  }
  if (b.flatTierName && !['starter', 'growth', 'business'].includes(b.flatTierName)) {
    res.status(400).json({ success: false, error: "flatTierName must be 'starter', 'growth' or 'business'" });
    return;
  }
  if (b.planType === 'flat' && !b.flatTierName && b.flatFeeCents == null) {
    res.status(400).json({ success: false, error: "flat plan requires flatTierName (starter|growth|business) or flatFeeCents" });
    return;
  }
  if (b.planCModel && !['per_booking', 'revenue_share'].includes(b.planCModel)) {
    res.status(400).json({ success: false, error: "planCModel must be 'per_booking' or 'revenue_share'" });
    return;
  }
  // A tier name maps to its fee; an explicit flatFeeCents (if provided) overrides.
  const flatTierName = b.flatTierName as FlatTierName | undefined;
  const flatFeeCents = b.flatFeeCents ?? (flatTierName ? FLAT_TIER_FEES[flatTierName] : undefined);
  try {
    const updated = await plans.upsertPlan(req.params.shopId, {
      planType: b.planType as AdPlanType | undefined,
      markupBps: b.markupBps,
      dashboardFeeCents: b.dashboardFeeCents,
      perBookingFeeCents: b.perBookingFeeCents,
      revenueShareBps: b.revenueShareBps,
      planCModel: b.planCModel as PlanCModel | undefined,
      flatFeeCents,
      flatTierName: flatTierName ?? undefined,
      active: b.active,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('BillingController.setBillingPlan failed', err);
    res.status(500).json({ success: false, error: 'Failed to update billing plan' });
  }
}

// GET /shops/:shopId/billing (admin) — plan + totals + recent charges + invoice preview
export async function getShopBilling(req: Request, res: Response): Promise<void> {
  try {
    const [data, preview] = await Promise.all([
      billing.getShopBilling(req.params.shopId),
      stripeBilling.previewShop(req.params.shopId),
    ]);
    res.json({ success: true, data: { ...data, invoicePreview: preview, stripeEnabled: stripeBilling.isEnabled() } });
  } catch (err) {
    logger.error('BillingController.getShopBilling failed', err);
    res.status(500).json({ success: false, error: 'Failed to get shop billing' });
  }
}

// GET /analytics/billing (admin) — platform-wide accrued ad-management revenue
export async function getBillingSummary(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ success: true, data: await billing.getAllShopsBilling() });
  } catch (err) {
    logger.error('BillingController.getBillingSummary failed', err);
    res.status(500).json({ success: false, error: 'Failed to get billing summary' });
  }
}

// POST /billing/accrue (admin) — run the accrual now (also runs nightly)
export async function triggerAccrual(_req: Request, res: Response): Promise<void> {
  try {
    await billing.runNightly(monthStart());
    res.json({ success: true });
  } catch (err) {
    logger.error('BillingController.triggerAccrual failed', err);
    res.status(500).json({ success: false, error: 'Failed to run accrual' });
  }
}

// POST /shops/:shopId/billing/invoice (admin) — gated Stripe push
export async function invoiceShop(req: Request, res: Response): Promise<void> {
  try {
    const result = await stripeBilling.invoiceShopPending(req.params.shopId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    const status = err?.status ?? 500;
    if (status >= 500 && status !== 501) logger.error('BillingController.invoiceShop failed', err);
    res.status(status).json({ success: false, error: err?.message ?? 'Failed to invoice' });
  }
}
