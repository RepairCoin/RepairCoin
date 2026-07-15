/**
 * Customer Import/Export Controller
 * Handles HTTP requests for customer import and export operations
 */

import { Request, Response } from 'express';
import { CustomerImportExportService } from '../services/CustomerImportExportService';
import { customerImportMappingService } from '../services/CustomerImportMappingService';
import { extractHeadersAndSamples } from '../../../utils/customerExcelParser';
import { getFileType, validateFileSignature } from '../../../middleware/fileUpload';
import { generateFilename } from '../../../utils/customerExcelGenerator';
import { logger } from '../../../utils/logger';

const importExportService = new CustomerImportExportService();

/** Parse the multipart `columnMapping` field (a JSON string) into a {field: header} object. */
function parseColumnMapping(raw: any): Record<string, string> | undefined {
  if (!raw) return undefined;
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) if (typeof v === 'string' && v.trim()) out[k] = v.trim();
      return Object.keys(out).length ? out : undefined;
    }
  } catch { /* ignore malformed mapping */ }
  return undefined;
}

/**
 * Export customers to Excel or CSV
 * GET /api/customers/export
 */
export async function exportCustomers(req: Request, res: Response): Promise<void> {
  try {
    const { role, shopId } = req.user as any;

    // Parse query parameters
    const format = (req.query.format as 'xlsx' | 'csv') || 'xlsx';
    const activeOnly = req.query.activeOnly === 'true';
    const includeMetadata = req.query.includeMetadata === 'true';

    // Validate format
    if (!['xlsx', 'csv'].includes(format)) {
      res.status(400).json({
        success: false,
        error: 'Invalid format. Must be "xlsx" or "csv"'
      });
      return;
    }

    // Determine if this is admin or shop export
    const exportShopId = role === 'admin' ? null : shopId;

    // Export customers
    const buffer = await importExportService.exportCustomers(exportShopId, {
      format,
      includeInactive: !activeOnly,
      includeMetadata
    });

    // Generate filename
    const filename = generateFilename('customers_export', format);

    // Set response headers
    const contentType = format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Export-Timestamp', new Date().toISOString());

    // Send file
    res.send(buffer);

    logger.info('Customers exported successfully', {
      shopId: exportShopId || 'admin',
      format,
      activeOnly,
      fileSize: buffer.length
    });
  } catch (error: any) {
    logger.error('Export customers failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to export customers',
      message: error.message
    });
  }
}

/**
 * Download import template
 * GET /api/customers/template
 */
export async function downloadTemplate(req: Request, res: Response): Promise<void> {
  try {
    // Parse query parameters
    const format = (req.query.format as 'xlsx' | 'csv') || 'xlsx';
    const includeSamples = req.query.includeSamples !== 'false'; // Default true

    // Validate format
    if (!['xlsx', 'csv'].includes(format)) {
      res.status(400).json({
        success: false,
        error: 'Invalid format. Must be "xlsx" or "csv"'
      });
      return;
    }

    // Generate template
    const buffer = await importExportService.generateTemplate(format, includeSamples);

    // Generate filename
    const filename = `customer_import_template.${format}`;

    // Set response headers
    const contentType = format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    // Send file
    res.send(buffer);

    logger.info('Customer template downloaded', {
      format,
      includeSamples,
      fileSize: buffer.length
    });
  } catch (error: any) {
    logger.error('Download customer template failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate template',
      message: error.message
    });
  }
}

/**
 * Import customers from Excel or CSV file
 * POST /api/customers/import
 */
export async function importCustomers(req: Request, res: Response): Promise<void> {
  try {
    const { role, shopId, address } = req.user as any;

    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Please upload a .xlsx, .xls, or .csv file'
      });
      return;
    }

    const file = req.file;
    const fileBuffer = file.buffer;
    const fileName = file.originalname;
    const fileSize = file.size;

    // Validate file signature (prevent file spoofing)
    if (!validateFileSignature(fileBuffer, fileName)) {
      res.status(422).json({
        success: false,
        error: 'Invalid file format',
        message: 'File signature does not match extension. File may be corrupted or renamed.'
      });
      return;
    }

    // Get file type
    const fileType = getFileType(fileName);
    if (!fileType) {
      res.status(422).json({
        success: false,
        error: 'Invalid file format',
        message: 'File must be .xlsx, .xls, or .csv'
      });
      return;
    }

    // Parse import options
    const mode = (req.body.mode as 'add' | 'merge' | 'replace') || 'add';
    const dryRun = req.body.dryRun === 'true' || req.body.dryRun === true;
    const onDuplicateWallet = (req.body.onDuplicateWallet as 'skip' | 'update' | 'error') || 'skip';

    // Validate mode
    if (!['add', 'merge', 'replace'].includes(mode)) {
      res.status(400).json({
        success: false,
        error: 'Invalid import mode',
        message: 'Mode must be "add", "merge", or "replace"'
      });
      return;
    }

    // Only admin can use 'replace' mode (dangerous!)
    if (mode === 'replace' && role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only administrators can use "replace" mode'
      });
      return;
    }

    // Determine shopId for import (null for admin)
    const importShopId = role === 'admin' ? null : shopId;

    // Import customers
    const result = await importExportService.importCustomers(
      importShopId,
      fileBuffer,
      fileName,
      fileType,
      fileSize,
      address,
      {
        mode,
        dryRun,
        onDuplicateWallet,
        // Origin tag stored on imported rows (e.g. 'square'); defaults to 'import' in the service.
        source: typeof req.body.source === 'string' ? req.body.source.trim().slice(0, 40) : undefined,
        // Confirmed AI/explicit column mapping (JSON string in multipart form).
        columnMapping: parseColumnMapping(req.body.columnMapping),
        // Target shop these customers belong to → stamped on home_shop_id. Admin picks it
        // explicitly; a shop importing its own list defaults to the caller's shop, otherwise
        // the rows have no shop attribution and never show in that shop's customer list.
        homeShopId: (typeof req.body.homeShopId === 'string' && req.body.homeShopId.trim())
          ? req.body.homeShopId.trim()
          : (shopId ?? undefined)
      }
    );

    // Return result
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }

    logger.info('Customer import completed', {
      shopId: importShopId || 'admin',
      jobId: result.jobId,
      success: result.success,
      imported: result.summary.imported,
      updated: result.summary.updated,
      errors: result.summary.invalidRows
    });
  } catch (error: any) {
    logger.error('Import customers failed', {
      error: error.message,
      stack: error.stack
    });

    // Determine appropriate status code
    let statusCode = 500;
    if (error.message.includes('not found')) statusCode = 404;
    if (error.message.includes('forbidden') || error.message.includes('permission')) statusCode = 403;
    if (error.message.includes('exceed') || error.message.includes('invalid')) statusCode = 400;

    res.status(statusCode).json({
      success: false,
      error: 'Import failed',
      message: error.message
    });
  }
}

/**
 * AI-suggest a column mapping for an uploaded file (Phase 2 — "just give the file").
 * POST /api/customers/import/suggest-mapping
 * Reads only the headers + a few sample rows and returns a proposed {field → header} mapping for
 * the human to confirm before the real import. Does NOT import anything.
 */
export async function suggestImportMapping(req: Request, res: Response): Promise<void> {
  try {
    const { role, shopId } = req.user as any;
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded', message: 'Upload a .xlsx, .xls, or .csv file' });
      return;
    }
    const fileName = req.file.originalname;
    if (!validateFileSignature(req.file.buffer, fileName)) {
      res.status(422).json({ success: false, error: 'Invalid file format', message: 'File signature does not match extension.' });
      return;
    }
    const fileType = getFileType(fileName);
    if (!fileType) {
      res.status(422).json({ success: false, error: 'Invalid file format', message: 'File must be .xlsx, .xls, or .csv' });
      return;
    }

    const { headers, samples } = extractHeadersAndSamples(req.file.buffer, fileType, 5);
    if (headers.length === 0) {
      res.status(422).json({ success: false, error: 'Empty file', message: 'No header row found.' });
      return;
    }

    // Spend-cap is per-shop; admin imports (no shopId) skip the cap.
    const suggestion = await customerImportMappingService.suggestMapping(headers, samples, role === 'admin' ? null : shopId);

    res.status(200).json({ success: true, headers, mapping: suggestion.mapping, unmapped: suggestion.unmapped, notes: suggestion.notes });
  } catch (error: any) {
    const status = error.status || 500;
    logger.error('suggestImportMapping failed', { error: error.message });
    res.status(status).json({ success: false, error: 'Mapping suggestion failed', message: error.message });
  }
}

/**
 * Get import job status
 * GET /api/customers/import/:jobId
 */
export async function getImportStatus(req: Request, res: Response): Promise<void> {
  try {
    const { role, shopId } = req.user as any;
    const { jobId } = req.params;

    if (!jobId) {
      res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
      return;
    }

    // Determine shopId for lookup (null for admin)
    const lookupShopId = role === 'admin' ? null : shopId;

    // Get job status
    const status = await importExportService.getImportStatus(jobId, lookupShopId);

    res.status(200).json(status);

    logger.info('Customer import status retrieved', {
      shopId: lookupShopId || 'admin',
      jobId,
      status: status.status
    });
  } catch (error: any) {
    logger.error('Get customer import status failed', {
      error: error.message,
      stack: error.stack
    });

    let statusCode = 500;
    if (error.message.includes('not found') || error.message.includes('expired')) {
      statusCode = 404;
    }

    res.status(statusCode).json({
      success: false,
      error: 'Failed to get import status',
      message: error.message
    });
  }
}
