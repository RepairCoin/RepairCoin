// backend/src/domains/AdsDomain/controllers/EnrollmentController.ts
//
// Shop "Request ads" opt-in. Shop submits a request (preferred plan + note); admin
// approves (which sets the shop's billing plan) or declines. Notifications are
// best-effort — admins on a new request, the shop on a decision.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { EnrollmentRepository, CampaignBrief } from '../repositories/EnrollmentRepository';
import { BillingPlanRepository, FlatTierName, FLAT_TIER_FEES } from '../repositories/BillingPlanRepository';
import { NotificationRepository } from '../../../repositories/NotificationRepository';
import { shopRepository } from '../../../repositories';

const enrollments = new EnrollmentRepository();
const plans = new BillingPlanRepository();
const notifications = new NotificationRepository();

const shopIdOf = (req: Request): string | undefined => (req as any).user?.shopId;
const adminAddrOf = (req: Request): string => (req as any).user?.address ?? 'admin';

async function notifyAdmins(notificationType: string, message: string, metadata: any): Promise<void> {
  try {
    const addrs = (process.env.ADMIN_ADDRESSES || '')
      .split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
    for (const receiver of addrs) {
      await notifications.create({ senderAddress: 'system', receiverAddress: receiver, notificationType, message, metadata });
    }
  } catch (err) {
    logger.error('EnrollmentController: notifyAdmins failed', err);
  }
}

async function notifyShop(shopId: string, notificationType: string, message: string, metadata: any): Promise<void> {
  try {
    const shop = await shopRepository.getShop(shopId);
    const receiver = (shop as any)?.walletAddress || (shop as any)?.wallet_address;
    if (receiver) await notifications.create({ senderAddress: 'system', receiverAddress: receiver, notificationType, message, metadata });
  } catch (err) {
    logger.error('EnrollmentController: notifyShop failed', err);
  }
}

// POST /shop/enrollment (shop) — request to join the ad program.
export async function requestAds(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  const plan = (req.body?.requestedPlan as FlatTierName) ?? 'growth';
  if (!['starter', 'growth', 'business'].includes(plan)) { res.status(400).json({ success: false, error: "requestedPlan must be 'starter', 'growth' or 'business'" }); return; }

  // Optional campaign brief — validate the bits we constrain in the DB.
  const b = req.body?.brief ?? {};
  if (b.monthlyBudgetCents != null && (!Number.isFinite(b.monthlyBudgetCents) || b.monthlyBudgetCents < 0)) {
    res.status(400).json({ success: false, error: 'brief.monthlyBudgetCents must be a non-negative number' }); return;
  }
  if (b.targetRadiusMiles != null && (!Number.isInteger(b.targetRadiusMiles) || b.targetRadiusMiles < 1 || b.targetRadiusMiles > 100)) {
    res.status(400).json({ success: false, error: 'brief.targetRadiusMiles must be an integer 1–100' }); return;
  }
  if (b.goal != null && !['more_bookings', 'leads', 'awareness', 'promote_service'].includes(b.goal)) {
    res.status(400).json({ success: false, error: "brief.goal must be 'more_bookings', 'leads', 'awareness' or 'promote_service'" }); return;
  }
  const brief: CampaignBrief = {
    promoteServiceIds: Array.isArray(b.promoteServiceIds) ? b.promoteServiceIds.map(String).slice(0, 20) : [],
    monthlyBudgetCents: b.monthlyBudgetCents ?? null,
    offer: b.offer ? String(b.offer).slice(0, 500) : null,
    targetRadiusMiles: b.targetRadiusMiles ?? null,
    goal: b.goal ?? null,
  };

  try {
    const existing = await enrollments.getByShop(shopId);
    if (existing?.status === 'approved') {
      res.json({ success: true, data: existing });   // already enrolled — no-op
      return;
    }
    const message = (req.body?.message || '').toString().slice(0, 1000) || null;
    const enrollment = await enrollments.request(shopId, plan, message, brief);
    await notifyAdmins('ad_enrollment_request', `Shop ${shopId} requested to join the ad program (${plan} tier).`, { shopId, requestedPlan: plan });
    res.status(201).json({ success: true, data: enrollment });
  } catch (err) {
    logger.error('EnrollmentController.requestAds failed', err);
    res.status(500).json({ success: false, error: 'Failed to submit request' });
  }
}

// GET /shop/enrollment (shop) — own enrollment status.
export async function getMyEnrollment(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    res.json({ success: true, data: await enrollments.getByShop(shopId) });
  } catch (err) {
    logger.error('EnrollmentController.getMyEnrollment failed', err);
    res.status(500).json({ success: false, error: 'Failed to load enrollment' });
  }
}

// GET /enrollments (admin) — list requests (optionally by status).
export async function listEnrollments(req: Request, res: Response): Promise<void> {
  try {
    res.json({ success: true, data: await enrollments.list(req.query.status as any) });
  } catch (err) {
    logger.error('EnrollmentController.listEnrollments failed', err);
    res.status(500).json({ success: false, error: 'Failed to list enrollments' });
  }
}

// POST /enrollments/:shopId/decide (admin) — approve (sets billing plan) or decline.
export async function decideEnrollment(req: Request, res: Response): Promise<void> {
  const decision = req.body?.decision;
  if (decision !== 'approved' && decision !== 'declined') {
    res.status(400).json({ success: false, error: "decision must be 'approved' or 'declined'" });
    return;
  }
  const shopId = req.params.shopId;
  try {
    const existing = await enrollments.getByShop(shopId);
    if (!existing) { res.status(404).json({ success: false, error: 'Enrollment request not found' }); return; }

    const updated = await enrollments.decide(shopId, decision, adminAddrOf(req), req.body?.declineReason);

    if (decision === 'approved') {
      // Set the shop's ad-management plan to the requested flat tier (admin can fine-tune
      // in the billing panel). Legacy a/b/c requests fall back to Growth. Admin still
      // builds the campaign.
      const tier = (['starter', 'growth', 'business'].includes(existing.requestedPlan)
        ? existing.requestedPlan : 'growth') as FlatTierName;
      await plans.upsertPlan(shopId, {
        planType: 'flat', flatTierName: tier, flatFeeCents: FLAT_TIER_FEES[tier], active: true,
      });
      await notifyShop(shopId, 'ad_enrollment_approved',
        `You're in! Your ${tier} ad plan is approved — we'll set up your campaign shortly.`,
        { shopId, plan: tier });
    } else {
      await notifyShop(shopId, 'ad_enrollment_declined',
        `Your ad program request was declined.${req.body?.declineReason ? ' Reason: ' + req.body.declineReason : ''}`,
        { shopId });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('EnrollmentController.decideEnrollment failed', err);
    res.status(500).json({ success: false, error: 'Failed to record decision' });
  }
}
