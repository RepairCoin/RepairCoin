/**
 * Import/Export Service
 * Business logic for service import and export operations
 */

import {
  parseServiceExcel,
  validateServiceRow,
  sanitizeServiceData,
  ParsedService,
  ValidationError
} from '../../../utils/excelParser';
import {
  generateServiceExport,
  generateServiceTemplate,
  generateFilename,
  ShopService,
  ExportOptions
} from '../../../utils/excelGenerator';
import { ServiceRepository } from '../../../repositories/ServiceRepository';
import { ShopRepository } from '../../../repositories/ShopRepository';
import { VALID_CATEGORIES } from '../constants';
import { Pool, PoolClient } from 'pg';
import { getSharedPool } from '../../../utils/database-pool';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../utils/logger';

// Type definitions
export interface ImportOptions {
  mode: 'add' | 'merge' | 'replace';
  dryRun: boolean;
  onDuplicateName?: 'skip' | 'update' | 'rename' | 'error';
}

export interface ImportResult {
  success: boolean;
  jobId: string;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    imported: number;
    updated: number;
    skipped: number;
    deleted: number;
  };
  errors: ValidationError[];
  warnings: ValidationError[];
  metadata: {
    uploadedAt: string;
    uploadedBy: string;
    shopId: string;
    fileName: string;
    fileSize: number;
    processingTime: number;
    mode: string;
    dryRun: boolean;
  };
}

export interface ValidationReport {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * ImportExportService class
 */
export class ImportExportService {
  private serviceRepository: ServiceRepository;
  private shopRepository: ShopRepository;
  private pool: Pool;

  constructor() {
    this.serviceRepository = new ServiceRepository();
    this.shopRepository = new ShopRepository();
    this.pool = getSharedPool();
  }

  /**
   * Export shop services to Excel or CSV
   */
  async exportShopServices(
    shopId: string,
    options: ExportOptions
  ): Promise<Buffer> {
    const startTime = Date.now();

    try {
      // Fetch services from database (get all without pagination)
      const result = await this.serviceRepository.getServicesByShop(shopId, {
        limit: 10000, // Get all services
        activeOnly: !options.includeInactive
      });

      const services = result.items;

      logger.info('Exporting services', {
        shopId,
        count: services.length,
        format: options.format,
        processingTime: Date.now() - startTime
      });

      // Generate export file
      const buffer = generateServiceExport(services, options);

      return buffer;
    } catch (error: any) {
      logger.error('Service export failed', {
        shopId,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Failed to export services: ${error.message}`);
    }
  }

  /**
   * Generate blank import template
   */
  async generateTemplate(format: 'xlsx' | 'csv', includeSamples: boolean = true): Promise<Buffer> {
    try {
      return generateServiceTemplate(format, includeSamples);
    } catch (error: any) {
      logger.error('Template generation failed', {
        format,
        error: error.message
      });
      throw new Error(`Failed to generate template: ${error.message}`);
    }
  }

  /**
   * Import services from file
   */
  async importShopServices(
    shopId: string,
    fileBuffer: Buffer,
    fileName: string,
    fileType: 'xlsx' | 'xls' | 'csv',
    fileSize: number,
    uploadedBy: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const jobId = this.generateJobId();

    logger.info('Import started', {
      jobId,
      shopId,
      uploadedBy,
      fileName,
      fileSize,
      mode: options.mode,
      dryRun: options.dryRun
    });

    try {
      // Step 1: File-level validation
      await this.validateFile(fileBuffer, fileName, fileSize);

      // Step 2: Parse file
      const parsedServices = await parseServiceExcel(fileBuffer, fileType);

      if (parsedServices.length === 0) {
        throw new Error('File contains no valid service data');
      }

      if (parsedServices.length > 1000) {
        throw new Error('Maximum 1000 services per import. Please split into multiple files.');
      }

      // Step 3: Business validation (shop qualification)
      await this.validateShopQualification(shopId);

      // Step 4: Data validation
      const validationReport = await this.validateImportData(parsedServices, shopId);

      // If validation failed, return errors
      if (validationReport.invalidRows > 0) {
        const result: ImportResult = {
          success: false,
          jobId,
          summary: {
            totalRows: validationReport.totalRows,
            validRows: validationReport.validRows,
            invalidRows: validationReport.invalidRows,
            imported: 0,
            updated: 0,
            skipped: 0,
            deleted: 0
          },
          errors: validationReport.errors,
          warnings: validationReport.warnings,
          metadata: {
            uploadedAt: new Date().toISOString(),
            uploadedBy,
            shopId,
            fileName,
            fileSize,
            processingTime: (Date.now() - startTime) / 1000,
            mode: options.mode,
            dryRun: options.dryRun
          }
        };

        // Save import job to database
        await this.saveImportJob(jobId, shopId, result, 'failed');

        return result;
      }

      // If dry run, return validation results without importing
      if (options.dryRun) {
        const result: ImportResult = {
          success: true,
          jobId,
          summary: {
            totalRows: validationReport.totalRows,
            validRows: validationReport.validRows,
            invalidRows: validationReport.invalidRows,
            imported: 0,
            updated: 0,
            skipped: 0,
            deleted: 0
          },
          errors: validationReport.errors,
          warnings: validationReport.warnings,
          metadata: {
            uploadedAt: new Date().toISOString(),
            uploadedBy,
            shopId,
            fileName,
            fileSize,
            processingTime: (Date.now() - startTime) / 1000,
            mode: options.mode,
            dryRun: true
          }
        };

        await this.saveImportJob(jobId, shopId, result, 'completed');

        return result;
      }

      // Step 5: Process import
      const batchResult = await this.processImportBatch(parsedServices, shopId, options);

      const result: ImportResult = {
        success: true,
        jobId,
        summary: {
          totalRows: validationReport.totalRows,
          validRows: validationReport.validRows,
          invalidRows: validationReport.invalidRows,
          imported: batchResult.imported,
          updated: batchResult.updated,
          skipped: batchResult.skipped,
          deleted: batchResult.deleted
        },
        errors: validationReport.errors,
        warnings: validationReport.warnings,
        metadata: {
          uploadedAt: new Date().toISOString(),
          uploadedBy,
          shopId,
          fileName,
          fileSize,
          processingTime: (Date.now() - startTime) / 1000,
          mode: options.mode,
          dryRun: false
        }
      };

      await this.saveImportJob(jobId, shopId, result, 'completed');

      logger.info('Import completed successfully', {
        jobId,
        imported: batchResult.imported,
        updated: batchResult.updated,
        skipped: batchResult.skipped,
        processingTime: (Date.now() - startTime) / 1000
      });

      return result;
    } catch (error: any) {
      logger.error('Import failed', {
        jobId,
        shopId,
        error: error.message,
        stack: error.stack
      });

      // Create failed result
      const failedResult: ImportResult = {
        success: false,
        jobId,
        summary: {
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          imported: 0,
          updated: 0,
          skipped: 0,
          deleted: 0
        },
        errors: [{
          row: 0,
          column: '',
          value: '',
          message: error.message,
          severity: 'error',
          code: 'IMPORT_FAILED'
        }],
        warnings: [],
        metadata: {
          uploadedAt: new Date().toISOString(),
          uploadedBy,
          shopId,
          fileName,
          fileSize,
          processingTime: (Date.now() - startTime) / 1000,
          mode: options.mode,
          dryRun: options.dryRun
        }
      };

      await this.saveImportJob(jobId, shopId, failedResult, 'failed');

      throw error;
    }
  }

  /**
   * Get import job status
   */
  async getImportStatus(jobId: string, shopId: string): Promise<any> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM import_jobs WHERE job_id = $1 AND shop_id = $2`,
        [jobId, shopId]
      );

      if (result.rows.length === 0) {
        throw new Error('Import job not found or expired');
      }

      const job = result.rows[0];

      return {
        jobId: job.job_id,
        status: job.status,
        progress: job.progress,
        result: {
          success: job.status === 'completed',
          summary: {
            totalRows: job.total_rows,
            validRows: job.valid_rows,
            invalidRows: job.invalid_rows,
            imported: job.imported_count,
            updated: job.updated_count,
            skipped: job.skipped_count,
            deleted: job.deleted_count
          },
          errors: job.errors,
          warnings: job.warnings,
          metadata: job.metadata
        },
        createdAt: job.created_at,
        completedAt: job.completed_at,
        processingTime: job.processing_time
      };
    } finally {
      client.release();
    }
  }

  /**
   * Validate file (Layer 1: File-level validation)
   */
  private async validateFile(buffer: Buffer, fileName: string, fileSize: number): Promise<void> {
    // Check file size
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (fileSize > maxSize) {
      throw new Error('File size exceeds 10MB limit');
    }

    // Check file is not empty
    if (buffer.length === 0) {
      throw new Error('File is empty');
    }
  }

  /**
   * Validate shop qualification (Layer 3: Business rules)
   */
  private async validateShopQualification(shopId: string): Promise<void> {
    const shop = await this.shopRepository.getShop(shopId);

    if (!shop) {
      throw new Error('Shop not found');
    }

    if (!shop.verified) {
      throw new Error('Shop must be verified to import services');
    }

    if (!shop.active) {
      throw new Error('Shop must be active to import services');
    }

    // Check qualification: subscription OR 10K+ RCG
    const isSubscriptionActive = shop.subscriptionActive;
    const isRcgQualified = (shop.rcg_balance || 0) >= 10000;

    if (!isSubscriptionActive && !isRcgQualified) {
      throw new Error('Active subscription or 10,000+ RCG tokens required to import services');
    }
  }

  /**
   * Validate import data (Layer 2: Schema validation & Layer 4: Security)
   */
  async validateImportData(
    services: ParsedService[],
    shopId: string
  ): Promise<ValidationReport> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const validRows: number[] = [];

    // Track duplicate service names
    const serviceNames = new Map<string, number>();

    for (const service of services) {
      // Sanitize data (XSS prevention)
      const sanitized = sanitizeServiceData(service);

      // Validate row
      const validation = validateServiceRow(sanitized, shopId, Array.from(VALID_CATEGORIES));

      if (!validation.isValid) {
        errors.push(...validation.errors);
      } else {
        validRows.push(service.rowIndex);
      }

      warnings.push(...validation.warnings);

      // Check for duplicates within file
      const nameKey = sanitized.serviceName.toLowerCase();
      if (serviceNames.has(nameKey)) {
        warnings.push({
          row: service.rowIndex,
          column: 'Service Name',
          value: sanitized.serviceName,
          message: `Duplicate service name found in row ${serviceNames.get(nameKey)}`,
          severity: 'warning',
          code: 'DUPLICATE_SERVICE_NAME'
        });
      } else {
        serviceNames.set(nameKey, service.rowIndex);
      }
    }

    return {
      totalRows: services.length,
      validRows: validRows.length,
      invalidRows: services.length - validRows.length,
      errors,
      warnings
    };
  }

  /**
   * Process import batch (actual database operations)
   */
  private async processImportBatch(
    services: ParsedService[],
    shopId: string,
    options: ImportOptions
  ): Promise<{ imported: number; updated: number; skipped: number; deleted: number }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let deleted = 0;

      // Handle 'replace' mode: delete all existing services
      if (options.mode === 'replace') {
        const deleteResult = await client.query(
          'DELETE FROM shop_services WHERE shop_id = $1',
          [shopId]
        );
        deleted = deleteResult.rowCount || 0;
      }

      // Process each service
      for (const service of services) {
        const sanitized = sanitizeServiceData(service);

        // Check if service exists (by name)
        const existing = await this.findExistingService(client, shopId, sanitized.serviceName);

        if (existing) {
          if (options.mode === 'merge') {
            // Update existing service
            await this.updateService(client, existing.service_id, sanitized);
            updated++;
          } else if (options.mode === 'add') {
            // Skip existing service
            skipped++;
          }
        } else {
          // Insert new service
          await this.insertService(client, shopId, sanitized);
          imported++;
        }
      }

      await client.query('COMMIT');

      return { imported, updated, skipped, deleted };
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Import batch failed, transaction rolled back', {
        shopId,
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find existing service by name
   */
  private async findExistingService(
    client: PoolClient,
    shopId: string,
    serviceName: string
  ): Promise<any> {
    const result = await client.query(
      'SELECT service_id FROM shop_services WHERE shop_id = $1 AND LOWER(service_name) = LOWER($2) LIMIT 1',
      [shopId, serviceName]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Insert new service
   */
  private async insertService(
    client: PoolClient,
    shopId: string,
    service: ParsedService
  ): Promise<void> {
    await client.query(
      `INSERT INTO shop_services (
        shop_id, service_name, description, price_usd, duration_minutes,
        category, image_url, tags, active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [
        shopId,
        service.serviceName,
        service.description || null,
        service.priceUsd,
        service.durationMinutes || null,
        service.category,
        service.imageUrl || null,
        service.tags || [],
        service.active
      ]
    );
  }

  /**
   * Update existing service
   */
  private async updateService(
    client: PoolClient,
    serviceId: string,
    service: ParsedService
  ): Promise<void> {
    await client.query(
      `UPDATE shop_services SET
        description = $1,
        price_usd = $2,
        duration_minutes = $3,
        category = $4,
        image_url = $5,
        tags = $6,
        active = $7,
        updated_at = NOW()
      WHERE service_id = $8`,
      [
        service.description || null,
        service.priceUsd,
        service.durationMinutes || null,
        service.category,
        service.imageUrl || null,
        service.tags || [],
        service.active,
        serviceId
      ]
    );
  }

  /**
   * Save import job to database
   */
  private async saveImportJob(
    jobId: string,
    shopId: string,
    result: ImportResult,
    status: 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(
        `INSERT INTO import_jobs (
          job_id, shop_id, entity_type, status, mode, dry_run,
          file_name, file_size, file_type,
          total_rows, valid_rows, invalid_rows,
          imported_count, updated_count, skipped_count, deleted_count,
          errors, warnings, metadata,
          progress, uploaded_by, created_at, completed_at, processing_time
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
        )
        ON CONFLICT (job_id) DO UPDATE SET
          status = $4,
          total_rows = $10,
          valid_rows = $11,
          invalid_rows = $12,
          imported_count = $13,
          updated_count = $14,
          skipped_count = $15,
          deleted_count = $16,
          errors = $17,
          warnings = $18,
          completed_at = $23,
          processing_time = $24,
          progress = $20
        `,
        [
          jobId,
          shopId,
          'service',
          status,
          result.metadata.mode,
          result.metadata.dryRun,
          result.metadata.fileName,
          result.metadata.fileSize,
          'xlsx', // Default file type
          result.summary.totalRows,
          result.summary.validRows,
          result.summary.invalidRows,
          result.summary.imported,
          result.summary.updated,
          result.summary.skipped,
          result.summary.deleted,
          JSON.stringify(result.errors),
          JSON.stringify(result.warnings),
          JSON.stringify(result.metadata),
          status === 'completed' ? 100 : (status === 'failed' ? 0 : 50),
          result.metadata.uploadedBy,
          new Date().toISOString(),
          status !== 'processing' ? new Date().toISOString() : null,
          result.metadata.processingTime
        ]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    const date = new Date();
    const dateStr = date.toISOString().replace(/[-:]/g, '').split('.')[0]; // YYYYMMDDTHHmmss
    const random = uuidv4().split('-')[0]; // Short random string
    return `import_${dateStr}_${random}`;
  }
}
