/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: System health check
 *     description: Returns the health status of the API and its dependencies
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: System is healthy
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
 *                         status:
 *                           type: string
 *                           example: "healthy"
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                         uptime:
 *                           type: number
 *                           example: 12345.67
 *                         services:
 *                           type: object
 *                           properties:
 *                             database:
 *                               type: object
 *                               properties:
 *                                 status:
 *                                   type: string
 *                                   example: "healthy"
 *                                 responseTime:
 *                                   type: string
 *                                   example: "<1000ms"
 *                             blockchain:
 *                               type: object
 *                               properties:
 *                                 status:
 *                                   type: string
 *                                   example: "healthy"
 *                                 network:
 *                                   type: string
 *                                   example: "Base Sepolia"
 *                             contract:
 *                               type: object
 *                               properties:
 *                                 status:
 *                                   type: string
 *                                   example: "healthy"
 *                                 contractAddress:
 *                                   type: string
 *                                   example: "0x1234..."
 *       503:
 *         description: System is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * 
 * /api/health/detailed:
 *   get:
 *     summary: Detailed system health information
 *     description: Returns comprehensive system health information including memory usage
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Detailed system health information
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
 *                         system:
 *                           type: object
 *                           properties:
 *                             nodeVersion:
 *                               type: string
 *                               example: "v18.17.0"
 *                             platform:
 *                               type: string
 *                               example: "darwin"
 *                             memory:
 *                               type: object
 *                               properties:
 *                                 used:
 *                                   type: number
 *                                   example: 45
 *                                 total:
 *                                   type: number
 *                                   example: 128
 *                         environment:
 *                           type: object
 *                           properties:
 *                             nodeEnv:
 *                               type: string
 *                               example: "development"
 *                             hasThirdwebConfig:
 *                               type: boolean
 *                               example: true
 */