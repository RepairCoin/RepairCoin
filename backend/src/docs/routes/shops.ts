/**
 * @swagger
 * /api/shops:
 *   get:
 *     summary: Get all active shops
 *     description: Retrieve a list of all active shops with optional filtering
 *     tags: [Shops]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: verified
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: true
 *         description: Filter by verification status
 *       - in: query
 *         name: crossShopEnabled
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by cross-shop redemption status
 *     responses:
 *       200:
 *         description: List of active shops
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
 *                         shops:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Shop'
 *                         count:
 *                           type: integer
 *                           example: 15
 * 
 * /api/shops/{shopId}:
 *   get:
 *     summary: Get shop by ID
 *     description: Retrieve detailed information about a specific shop
 *     tags: [Shops]
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique shop identifier
 *         example: "shop001"
 *     responses:
 *       200:
 *         description: Shop details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Shop'
 *       404:
 *         description: Shop not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   
 *   put:
 *     summary: Update shop information
 *     description: Update shop details (shop owner or admin only)
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique shop identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Shop name
 *                 example: "Updated Shop Name"
 *               address:
 *                 type: string
 *                 description: Physical address
 *                 example: "456 New Street, City, State 12345"
 *               phone:
 *                 type: string
 *                 description: Contact phone number
 *                 example: "+1234567890"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Contact email
 *                 example: "contact@shop.com"
 *               location:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                     example: 40.7128
 *                   lng:
 *                     type: number
 *                     example: -74.0060
 *                   city:
 *                     type: string
 *                     example: "New York"
 *                   state:
 *                     type: string
 *                     example: "NY"
 *                   zipCode:
 *                     type: string
 *                     example: "10001"
 *     responses:
 *       200:
 *         description: Shop updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: Shop not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * 
 * /api/shops/register:
 *   post:
 *     summary: Register a new shop
 *     description: Register a new shop in the system
 *     tags: [Shops]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shopId
 *               - name
 *               - address
 *               - phone
 *               - email
 *               - walletAddress
 *             properties:
 *               shopId:
 *                 type: string
 *                 description: Unique shop identifier
 *                 example: "shop001"
 *               name:
 *                 type: string
 *                 description: Shop name
 *                 example: "Tech Repair Pro"
 *               address:
 *                 type: string
 *                 description: Physical address
 *                 example: "123 Main St, Anytown, ST 12345"
 *               phone:
 *                 type: string
 *                 description: Contact phone number
 *                 example: "+1234567890"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Contact email
 *                 example: "contact@techrepairpro.com"
 *               walletAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 description: Shop wallet address
 *                 example: "0x7890123456789012345678901234567890123456"
 *               reimbursementAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 description: Reimbursement wallet address (optional)
 *                 example: "0x7890123456789012345678901234567890123456"
 *               location:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                     example: 40.7128
 *                   lng:
 *                     type: number
 *                     example: -74.0060
 *                   city:
 *                     type: string
 *                     example: "New York"
 *                   state:
 *                     type: string
 *                     example: "NY"
 *                   zipCode:
 *                     type: string
 *                     example: "10001"
 *     responses:
 *       201:
 *         description: Shop registered successfully
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
 *                         shopId:
 *                           type: string
 *                           example: "shop001"
 *                         name:
 *                           type: string
 *                           example: "Tech Repair Pro"
 *                         verified:
 *                           type: boolean
 *                           example: false
 *                         active:
 *                           type: boolean
 *                           example: false
 *       409:
 *         description: Shop ID already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */