import { Router } from 'express';
import { authMiddleware, requireAdmin, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { AgencyController } from './controllers/AgencyController';

const router = Router();
const controller = new AgencyController();

// --- Public (no auth) ---

// Validate an invite token for the signup-page banner ("You're joining {Agency}").
router.get('/invite-info/:token', asyncHandler(controller.getInviteInfo.bind(controller)));

// All routes below require authentication.
router.use(authMiddleware);

// Agency owner is a shop that activated the Agency Program add-on.
const requireShop = requireRole(['shop']);

// --- Agency-owner endpoints (the owning shop) ---

// Self-serve activation: start Stripe checkout for the $999/mo Agency Program add-on.
router.post('/activate', requireShop, asyncHandler(controller.activate.bind(controller)));

// Self-serve cancel: schedule the Agency Program to cancel at the end of the billing period.
router.post('/cancel', requireShop, asyncHandler(controller.cancel.bind(controller)));

// The owning shop's agency profile (account + client usage + AM contact).
router.get('/me', requireShop, asyncHandler(controller.getMyAgency.bind(controller)));

// The owning shop's active client shops.
router.get('/clients', requireShop, asyncHandler(controller.getMyClients.bind(controller)));

// Create a new client shop under the agency.
router.post('/clients', requireShop, asyncHandler(controller.createClient.bind(controller)));

// Unlink a client shop from the agency.
router.delete('/clients/:shopId', requireShop, asyncHandler(controller.removeClient.bind(controller)));

// Client invite links — the agency mints a link, the client self-signs-up with their own wallet.
router.post('/invites', requireShop, asyncHandler(controller.createInvite.bind(controller)));
router.get('/invites', requireShop, asyncHandler(controller.listInvites.bind(controller)));
router.delete('/invites/:token', requireShop, asyncHandler(controller.revokeInvite.bind(controller)));

// --- Admin backdoor (self-serve activation is the primary path) ---

// Provision an agency for a shop.
router.post('/', requireAdmin, asyncHandler(controller.provisionAgency.bind(controller)));

// List all agencies.
router.get('/', requireAdmin, asyncHandler(controller.listAgencies.bind(controller)));

// A given agency's client shops.
router.get('/:id/clients', requireAdmin, asyncHandler(controller.getAgencyClients.bind(controller)));

// Assign or clear a given agency's account manager.
router.patch('/:id/account-manager', requireAdmin, asyncHandler(controller.assignAccountManager.bind(controller)));

export default router;
