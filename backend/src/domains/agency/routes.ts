import { Router } from 'express';
import { authMiddleware, requireAdmin, requireAgency } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { AgencyController } from './controllers/AgencyController';

const router = Router();
const controller = new AgencyController();

// All agency routes require authentication.
router.use(authMiddleware);

// --- Agency-owner endpoints (agency role) ---

// The requesting agency's profile (account + client usage + AM contact).
router.get('/me', requireAgency, asyncHandler(controller.getMyAgency.bind(controller)));

// The requesting agency's active client shops.
router.get('/clients', requireAgency, asyncHandler(controller.getMyClients.bind(controller)));

// --- Admin provisioning (sales-assisted) ---

// Provision a new agency.
router.post('/', requireAdmin, asyncHandler(controller.provisionAgency.bind(controller)));

// List all agencies.
router.get('/', requireAdmin, asyncHandler(controller.listAgencies.bind(controller)));

export default router;
