/**
 * @swagger
 * tags:
 *   - name: Customers
 *     description: Customer management and operations. Implements role exclusivity - wallets can only be registered as either a shop, customer, or admin, not multiple roles.
 * 
 * /api/customers/{address}:
 *   get:
 *     summary: Get customer by wallet address
 *     description: Retrieve customer information by wallet address
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Ethereum wallet address
 *         example: "0x1234567890123456789012345678901234567890"
 *     responses:
 *       200:
 *         description: Customer found
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         customer:
 *                           $ref: '#/components/schemas/Customer'
 *                         blockchainBalance:
 *                           type: number
 *                           example: 150.5
 *                         tierBenefits:
 *                           $ref: '#/components/schemas/TierBenefits'
 *                         earningCapacity:
 *                           type: object
 *                         tierProgression:
 *                           type: object
 *       404:
 *         description: Customer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * 
 * /api/customers/register:
 *   post:
 *     summary: Register a new customer
 *     description: Register a new customer in the system. Enforces role exclusivity - wallet addresses already registered as shops or admins cannot register as customers.
 *     tags: [Customers]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 description: Customer wallet address
 *                 example: "0x1234567890123456789012345678901234567890"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Customer email (optional)
 *                 example: "customer@example.com"
 *               phone:
 *                 type: string
 *                 description: Customer phone (optional)
 *                 example: "+1234567890"
 *               fixflowCustomerId:
 *                 type: string
 *                 description: FixFlow customer ID (optional)
 *                 example: "customer_123"
 *     responses:
 *       201:
 *         description: Customer registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Customer'
 *       409:
 *         description: Conflict - Customer already registered or wallet has role conflict
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiError'
 *                 - type: object
 *                   properties:
 *                     conflictingRole:
 *                       type: string
 *                       enum: [admin, customer, shop]
 *                       description: The existing role that prevents registration
 *                       example: shop
 *             examples:
 *               customerExists:
 *                 summary: Customer already registered
 *                 value:
 *                   success: false
 *                   error: "Customer already registered"
 *               shopRoleConflict:
 *                 summary: Wallet is already a shop
 *                 value:
 *                   success: false
 *                   error: "This wallet address is already registered as a shop (Shop Name) and cannot be used for customer registration"
 *                   conflictingRole: "shop"
 *               adminRoleConflict:
 *                 summary: Wallet is an admin
 *                 value:
 *                   success: false
 *                   error: "This wallet address is already registered as an admin and cannot be used for customer registration"
 *                   conflictingRole: "admin"
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * 
 * components:
 *   schemas:
 *     Customer:
 *       type: object
 *       properties:
 *         address:
 *           type: string
 *           example: "0x1234567890123456789012345678901234567890"
 *         email:
 *           type: string
 *           example: "customer@example.com"
 *         name:
 *           type: string
 *           example: "John Doe"
 *         lifetimeEarnings:
 *           type: number
 *           example: 1250.5
 *         tier:
 *           type: string
 *           enum: [BRONZE, SILVER, GOLD]
 *           example: "SILVER"
 *         joinDate:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00Z"
 *         isActive:
 *           type: boolean
 *           example: true
 *         referralCount:
 *           type: integer
 *           example: 5
 *     
 *     TierBenefits:
 *       type: object
 *       properties:
 *         earningMultiplier:
 *           type: number
 *           example: 1.5
 *         redemptionRate:
 *           type: number
 *           example: 1.0
 *         crossShopRedemption:
 *           type: boolean
 *           example: true
 *         tierBonus:
 *           type: integer
 *           example: 20
 *         features:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Cross-shop redemption", "Priority support", "Exclusive offers"]
 */