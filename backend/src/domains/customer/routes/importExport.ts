/**
 * Customer Import/Export Routes
 * Handles customer bulk import and export operations
 */

import { Router } from 'express';
import { authMiddleware, requireRole } from '../../../middleware/auth';
import {
  exportCustomers,
  downloadTemplate,
  importCustomers,
  getImportStatus
} from '../controllers/CustomerImportExportController';

const router = Router();

// ==================== IMPORT/EXPORT ROUTES ====================

/**
 * @swagger
 * /api/customers/export:
 *   get:
 *     summary: Export customers to Excel or CSV
 *     description: Export customers (shop exports their customers, admin exports all)
 *     tags: [Customers, Import/Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [xlsx, csv]
 *         description: Export file format - xlsx or csv, defaults to xlsx
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: boolean
 *         description: Export only active customers, defaults to false
 *       - in: query
 *         name: includeMetadata
 *         schema:
 *           type: boolean
 *         description: Include metadata like join date, defaults to false
 *     responses:
 *       200:
 *         description: File download
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized (shop or admin role required)
 */
router.get(
  '/export',
  authMiddleware,
  requireRole(['shop', 'admin']),
  async (req, res) => {
    const { exportRateLimiter } = await import('../../../middleware/importRateLimit');
    exportRateLimiter(req, res, async () => {
      return exportCustomers(req, res);
    });
  }
);

/**
 * @swagger
 * /api/customers/template:
 *   get:
 *     summary: Download customer import template
 *     description: Download blank import template with sample customer data
 *     tags: [Customers, Import/Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [xlsx, csv]
 *         description: Template file format - xlsx or csv, defaults to xlsx
 *       - in: query
 *         name: includeSamples
 *         schema:
 *           type: boolean
 *         description: Include sample data rows, defaults to true
 *     responses:
 *       200:
 *         description: Template file download
 *       401:
 *         description: Authentication required
 */
router.get(
  '/template',
  authMiddleware,
  requireRole(['shop', 'admin']),
  downloadTemplate
);

/**
 * @swagger
 * /api/customers/import:
 *   post:
 *     summary: Import customers from Excel or CSV
 *     description: Import customers in bulk from uploaded file
 *     tags: [Customers, Import/Export]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel or CSV file (max 10MB, max 10,000 rows)
 *               mode:
 *                 type: string
 *                 enum: [add, merge, replace]
 *                 default: add
 *                 description: Import mode (add=new only, merge=update+add, replace=delete all+import - admin only)
 *               dryRun:
 *                 type: boolean
 *                 default: false
 *                 description: Validate only without importing
 *               onDuplicateWallet:
 *                 type: string
 *                 enum: [skip, update, error]
 *                 default: skip
 *                 description: How to handle duplicate wallet addresses
 *     responses:
 *       200:
 *         description: Import completed successfully
 *       400:
 *         description: Validation errors
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized
 *       413:
 *         description: File too large
 *       422:
 *         description: Invalid file format
 *       429:
 *         description: Rate limit exceeded (5 imports per hour)
 */
router.post(
  '/import',
  authMiddleware,
  requireRole(['shop', 'admin']),
  async (req, res) => {
    const { importRateLimiter } = await import('../../../middleware/importRateLimit');
    const { uploadMiddleware } = await import('../../../middleware/fileUpload');

    importRateLimiter(req, res, () => {
      uploadMiddleware.single('file')(req, res, async (err: any) => {
        if (err) {
          return res.status(400).json({
            success: false,
            error: err.message
          });
        }
        return importCustomers(req, res);
      });
    });
  }
);

/**
 * @swagger
 * /api/customers/import/{jobId}:
 *   get:
 *     summary: Get customer import job status
 *     description: Check the status of a customer import job
 *     tags: [Customers, Import/Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Import job ID
 *     responses:
 *       200:
 *         description: Job status retrieved
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Job not found or expired
 */
router.get(
  '/import/:jobId',
  authMiddleware,
  requireRole(['shop', 'admin']),
  getImportStatus
);

export default router;
