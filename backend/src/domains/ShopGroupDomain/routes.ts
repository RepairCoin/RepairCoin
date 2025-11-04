// backend/src/domains/ShopGroupDomain/routes.ts
import { Router } from 'express';
import { GroupController } from './controllers/GroupController';
import { MembershipController } from './controllers/MembershipController';
import { GroupTokenController } from './controllers/GroupTokenController';
import { authMiddleware, requireRole } from '../../middleware/auth';

const router = Router();

// Initialize controllers
const groupController = new GroupController();
const membershipController = new MembershipController();
const tokenController = new GroupTokenController();

// ==================== GROUP MANAGEMENT ROUTES ====================

/**
 * @swagger
 * /api/shop-groups:
 *   post:
 *     summary: Create a new shop group
 *     description: Create a new shop coalition with custom tokens. The creating shop becomes the admin.
 *     tags: [Shop Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - groupName
 *               - customTokenName
 *               - customTokenSymbol
 *             properties:
 *               groupName:
 *                 type: string
 *                 example: "Downtown Auto Repair Coalition"
 *               customTokenName:
 *                 type: string
 *                 example: "DowntownBucks"
 *               customTokenSymbol:
 *                 type: string
 *                 maxLength: 10
 *                 example: "DTB"
 *               description:
 *                 type: string
 *                 example: "Coalition of auto repair shops in downtown area"
 *               logoUrl:
 *                 type: string
 *                 format: url
 *                 example: "https://example.com/logo.png"
 *               isPrivate:
 *                 type: boolean
 *                 default: false
 *                 example: false
 *     responses:
 *       201:
 *         description: Group created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ShopGroup'
 *       400:
 *         description: Invalid request or validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Shop role required
 */
router.post(
  '/',
  authMiddleware,
  requireRole(['shop']),
  groupController.createGroup
);

/**
 * @swagger
 * /api/shop-groups:
 *   get:
 *     summary: Get all shop groups
 *     description: Retrieve all public shop groups or filter by criteria
 *     tags: [Shop Groups]
 *     parameters:
 *       - in: query
 *         name: isPrivate
 *         schema:
 *           type: boolean
 *         description: Filter by private/public status
 *     responses:
 *       200:
 *         description: List of shop groups
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ShopGroup'
 */
router.get(
  '/',
  groupController.getAllGroups
);

/**
 * @route   GET /api/shop-groups/my-groups
 * @desc    Get groups for authenticated shop
 * @access  Shop only
 */
router.get(
  '/my-groups',
  authMiddleware,
  requireRole(['shop']),
  groupController.getMyGroups
);

/**
 * @route   GET /api/shop-groups/:groupId
 * @desc    Get group by ID
 * @access  Public
 */
router.get(
  '/:groupId',
  groupController.getGroup
);

/**
 * @route   PUT /api/shop-groups/:groupId
 * @desc    Update group details
 * @access  Shop (admin of group) only
 */
router.put(
  '/:groupId',
  authMiddleware,
  requireRole(['shop']),
  groupController.updateGroup
);

// ==================== MEMBERSHIP ROUTES ====================

/**
 * @route   POST /api/shop-groups/:groupId/join
 * @desc    Request to join a group
 * @access  Shop only
 */
router.post(
  '/:groupId/join',
  authMiddleware,
  requireRole(['shop']),
  membershipController.requestToJoin
);

/**
 * @route   POST /api/shop-groups/join-by-code
 * @desc    Join group by invite code
 * @access  Shop only
 */
router.post(
  '/join-by-code',
  authMiddleware,
  requireRole(['shop']),
  membershipController.joinByInviteCode
);

/**
 * @route   GET /api/shop-groups/:groupId/members
 * @desc    Get group members
 * @access  Public
 */
router.get(
  '/:groupId/members',
  membershipController.getGroupMembers
);

/**
 * @route   POST /api/shop-groups/:groupId/members/:shopIdToApprove/approve
 * @desc    Approve member request
 * @access  Shop (admin of group) only
 */
router.post(
  '/:groupId/members/:shopIdToApprove/approve',
  authMiddleware,
  requireRole(['shop']),
  membershipController.approveMember
);

/**
 * @route   POST /api/shop-groups/:groupId/members/:shopIdToReject/reject
 * @desc    Reject member request
 * @access  Shop (admin of group) only
 */
router.post(
  '/:groupId/members/:shopIdToReject/reject',
  authMiddleware,
  requireRole(['shop']),
  membershipController.rejectMember
);

/**
 * @route   DELETE /api/shop-groups/:groupId/members/:shopIdToRemove
 * @desc    Remove member from group
 * @access  Shop (admin of group) only
 */
router.delete(
  '/:groupId/members/:shopIdToRemove',
  authMiddleware,
  requireRole(['shop']),
  membershipController.removeMember
);

// ==================== GROUP TOKEN ROUTES ====================

/**
 * @swagger
 * /api/shop-groups/{groupId}/tokens/earn:
 *   post:
 *     summary: Issue group tokens to customer
 *     description: Shop members can issue custom group tokens to customers for services/purchases
 *     tags: [Shop Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group identifier
 *         example: "grp_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerAddress
 *               - amount
 *             properties:
 *               customerAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: "0x1234567890123456789012345678901234567890"
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 example: 50
 *               reason:
 *                 type: string
 *                 example: "Oil change service"
 *               metadata:
 *                 type: object
 *                 description: Additional transaction data
 *     responses:
 *       200:
 *         description: Tokens issued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     transaction:
 *                       $ref: '#/components/schemas/GroupTokenTransaction'
 *                     newBalance:
 *                       type: number
 *                       example: 150
 *                     lifetimeEarned:
 *                       type: number
 *                       example: 200
 *       400:
 *         description: Invalid request or shop not member of group
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Shop role required
 */
router.post(
  '/:groupId/tokens/earn',
  authMiddleware,
  requireRole(['shop']),
  tokenController.earnTokens
);

/**
 * @swagger
 * /api/shop-groups/{groupId}/tokens/redeem:
 *   post:
 *     summary: Redeem group tokens
 *     description: Shop members can redeem customer's group tokens for services/purchases
 *     tags: [Shop Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group identifier
 *         example: "grp_1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerAddress
 *               - amount
 *             properties:
 *               customerAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: "0x1234567890123456789012345678901234567890"
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 example: 50
 *               reason:
 *                 type: string
 *                 example: "Discount on brake service"
 *               metadata:
 *                 type: object
 *                 description: Additional transaction data
 *     responses:
 *       200:
 *         description: Tokens redeemed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     transaction:
 *                       $ref: '#/components/schemas/GroupTokenTransaction'
 *                     newBalance:
 *                       type: number
 *                       example: 100
 *                     lifetimeRedeemed:
 *                       type: number
 *                       example: 100
 *       400:
 *         description: Invalid request, insufficient balance, or shop not member of group
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Shop role required
 */
router.post(
  '/:groupId/tokens/redeem',
  authMiddleware,
  requireRole(['shop']),
  tokenController.redeemTokens
);

/**
 * @route   GET /api/shop-groups/:groupId/balance/:customerAddress
 * @desc    Get customer's balance in a group
 * @access  Public
 */
router.get(
  '/:groupId/balance/:customerAddress',
  tokenController.getCustomerBalance
);

/**
 * @route   GET /api/shop-groups/balances/:customerAddress
 * @desc    Get all customer's group balances
 * @access  Public
 */
router.get(
  '/balances/:customerAddress',
  tokenController.getAllCustomerBalances
);

/**
 * @route   GET /api/shop-groups/:groupId/transactions
 * @desc    Get group transaction history
 * @access  Public
 */
router.get(
  '/:groupId/transactions',
  tokenController.getGroupTransactions
);

/**
 * @route   GET /api/shop-groups/:groupId/transactions/:customerAddress
 * @desc    Get customer's transaction history in a group
 * @access  Public
 */
router.get(
  '/:groupId/transactions/:customerAddress',
  tokenController.getCustomerTransactions
);

export default router;
