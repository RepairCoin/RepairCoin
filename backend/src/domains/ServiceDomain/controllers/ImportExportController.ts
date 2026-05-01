/**
 * Import/Export Controller
 * Handles HTTP requests for service import and export operations
 */

import { Request, Response } from 'express';
import { ImportExportService } from '../services/ImportExportService';
import { getFileType, validateFileSignature } from '../../../middleware/fileUpload';
import { generateFilename } from '../../../utils/excelGenerator';
import { logger } from '../../../utils/logger';

const importExportService = new ImportExportService();

/**
 * Export services to Excel or CSV
 * GET /api/services/export
 */
export async function exportServices(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.user as any;

    // Parse query parameters
    const format = (req.query.format as 'xlsx' | 'csv') || 'xlsx';
    const activeOnly = req.query.activeOnly === 'true';
    const includeMetadata = req.query.includeMetadata === 'true';
    const category = req.query.category as string | undefined;

    // Validate format
    if (!['xlsx', 'csv'].includes(format)) {
      res.status(400).json({
        success: false,
        error: 'Invalid format. Must be "xlsx" or "csv"'
      });
      return;
    }

    // Export services
    const buffer = await importExportService.exportShopServices(shopId, {
      format,
      includeInactive: !activeOnly,
      includeMetadata
    });

    // Generate filename
    const filename = generateFilename('services_export', format);

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

    logger.info('Services exported successfully', {
      shopId,
      format,
      activeOnly,
      fileSize: buffer.length
    });
  } catch (error: any) {
    logger.error('Export services failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to export services',
      message: error.message
    });
  }
}

/**
 * Download import template
 * GET /api/services/template
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
    const filename = `service_import_template.${format}`;

    // Set response headers
    const contentType = format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    // Send file
    res.send(buffer);

    logger.info('Template downloaded', {
      format,
      includeSamples,
      fileSize: buffer.length
    });
  } catch (error: any) {
    logger.error('Download template failed', {
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
 * Import services from Excel or CSV file
 * POST /api/services/import
 */
export async function importServices(req: Request, res: Response): Promise<void> {
  try {
    const { shopId, address } = req.user as any;

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
    const onDuplicateName = (req.body.onDuplicateName as 'skip' | 'update' | 'rename' | 'error') || 'skip';

    // Validate mode
    if (!['add', 'merge', 'replace'].includes(mode)) {
      res.status(400).json({
        success: false,
        error: 'Invalid import mode',
        message: 'Mode must be "add", "merge", or "replace"'
      });
      return;
    }

    // Import services
    const result = await importExportService.importShopServices(
      shopId,
      fileBuffer,
      fileName,
      fileType,
      fileSize,
      address,
      {
        mode,
        dryRun,
        onDuplicateName
      }
    );

    // Return result
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }

    logger.info('Import completed', {
      shopId,
      jobId: result.jobId,
      success: result.success,
      imported: result.summary.imported,
      updated: result.summary.updated,
      errors: result.summary.invalidRows
    });
  } catch (error: any) {
    logger.error('Import services failed', {
      error: error.message,
      stack: error.stack
    });

    // Determine appropriate status code
    let statusCode = 500;
    if (error.message.includes('not found')) statusCode = 404;
    if (error.message.includes('not qualified') || error.message.includes('required')) statusCode = 403;
    if (error.message.includes('exceed') || error.message.includes('invalid')) statusCode = 400;

    res.status(statusCode).json({
      success: false,
      error: 'Import failed',
      message: error.message
    });
  }
}

/**
 * Get import job status
 * GET /api/services/import/:jobId
 */
export async function getImportStatus(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.user as any;
    const { jobId } = req.params;

    if (!jobId) {
      res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
      return;
    }

    // Get job status
    const status = await importExportService.getImportStatus(jobId, shopId);

    res.status(200).json(status);

    logger.info('Import status retrieved', {
      shopId,
      jobId,
      status: status.status
    });
  } catch (error: any) {
    logger.error('Get import status failed', {
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
