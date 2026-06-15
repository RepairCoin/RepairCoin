// backend/src/domains/AdsDomain/controllers/EnrollmentController.ts
//
// Shop "Request ads" opt-in. Shop submits a request (preferred plan + note); admin
// approves (which sets the shop's billing plan) or declines. Notifications are
// best-effort — admins on a new request, the shop on a decision.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { EnrollmentRepository } from '../repositories/EnrollmentRepository';
import { BillingPlanRepository, AdPlanType } from '../repositories/BillingPlanRepository';
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
  const plan = (req.body?.requestedPlan as AdPlanType) ?? 'b';
  if (!['a', 'b', 'c'].includes(plan)) { res.status(400).json({ success: false, error: "requestedPlan must be 'a','b' or 'c'" }); return; }
  try {
    const existing = await enrollments.getByShop(shopId);
    if (existing?.status === 'approved') {
      res.json({ success: true, data: existing });   // already enrolled — no-op
      return;
    }
    const message = (req.body?.message || '').toString().slice(0, 1000) || null;
    const enrollment = await enrollments.request(shopId, plan, message);
    await notifyAdmins('ad_enrollment_request', `Shop ${shopId} requested to join the ad program (Plan ${plan.toUpperCase()}).`, { shopId, requestedPlan: plan });
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
      // Set the shop's ad-management plan to what they requested (admin can fine-tune
      // the terms afterward in the billing panel). Admin still builds the campaign.
      await plans.upsertPlan(shopId, { planType: existing.requestedPlan, active: true });
      await notifyShop(shopId, 'ad_enrollment_approved',
        `You're in! Your ad program (Plan ${existing.requestedPlan.toUpperCase()}) is approved — we'll set up your campaign shortly.`,
        { shopId, plan: existing.requestedPlan });
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
