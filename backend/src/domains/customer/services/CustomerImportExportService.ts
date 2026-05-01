/**
 * Customer Import/Export Service
 * Business logic for customer import and export operations
 */

import {
  parseCustomerExcel,
  validateCustomerRow,
  sanitizeCustomerData,
  ParsedCustomer,
  ValidationError
} from '../../../utils/customerExcelParser';
import {
  generateCustomerExport,
  generateCustomerTemplate,
  generateFilename,
  Customer,
  ExportOptions
} from '../../../utils/customerExcelGenerator';
import { CustomerRepository } from '../../../repositories/CustomerRepository';
import { Pool, PoolClient } from 'pg';
import { getSharedPool } from '../../../utils/database-pool';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../utils/logger';

// Type definitions
export interface ImportOptions {
  mode: 'add' | 'merge' | 'replace';
  dryRun: boolean;
  onDuplicateWallet?: 'skip' | 'update' | 'error';
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
    shopId?: string;
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
 * CustomerImportExportService class
 */
export class CustomerImportExportService {
  private customerRepository: CustomerRepository;
  private pool: Pool;

  constructor() {
    this.customerRepository = new CustomerRepository();
    this.pool = getSharedPool();
  }

  /**
   * Export customers to Excel or CSV
   */
  async exportCustomers(
    shopId: string | null, // null for admin (all customers)
    options: ExportOptions
  ): Promise<Buffer> {
    const startTime = Date.now();

    try {
      // Fetch customers from database
      let customers: any[];

      if (shopId) {
        // Shop export: only customers who have interacted with this shop
        customers = await this.getShopCustomers(shopId);
      } else {
        // Admin export: all customers
        customers = await this.getAllCustomers();
      }

      // Filter customers based on options
      let filteredCustomers = customers;

      if (!options.includeInactive) {
        filteredCustomers = filteredCustomers.filter(c => c.active);
      }

      logger.info('Exporting customers', {
        shopId: shopId || 'admin',
        count: filteredCustomers.length,
        format: options.format,
        processingTime: Date.now() - startTime
      });

      // Generate export file
      const buffer = generateCustomerExport(filteredCustomers, options);

      return buffer;
    } catch (error: any) {
      logger.error('Customer export failed', {
        shopId,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Failed to export customers: ${error.message}`);
    }
  }

  /**
   * Generate blank import template
   */
  async generateTemplate(format: 'xlsx' | 'csv', includeSamples: boolean = true): Promise<Buffer> {
    try {
      return generateCustomerTemplate(format, includeSamples);
    } catch (error: any) {
      logger.error('Template generation failed', {
        format,
        error: error.message
      });
      throw new Error(`Failed to generate template: ${error.message}`);
    }
  }

  /**
   * Import customers from file
   */
  async importCustomers(
    shopId: string | null, // null for admin import
    fileBuffer: Buffer,
    fileName: string,
    fileType: 'xlsx' | 'xls' | 'csv',
    fileSize: number,
    uploadedBy: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const jobId = this.generateJobId();

    logger.info('Customer import started', {
      jobId,
      shopId: shopId || 'admin',
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
      const parsedCustomers = await parseCustomerExcel(fileBuffer, fileType);

      if (parsedCustomers.length === 0) {
        throw new Error('File contains no valid customer data');
      }

      if (parsedCustomers.length > 10000) {
        throw new Error('Maximum 10,000 customers per import. Please split into multiple files.');
      }

      // Step 3: Data validation
      const validationReport = await this.validateImportData(parsedCustomers);

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
            shopId: shopId || undefined,
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
            shopId: shopId || undefined,
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

      // Step 4: Process import
      const batchResult = await this.processImportBatch(parsedCustomers, options);

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
          shopId: shopId || undefined,
          fileName,
          fileSize,
          processingTime: (Date.now() - startTime) / 1000,
          mode: options.mode,
          dryRun: false
        }
      };

      await this.saveImportJob(jobId, shopId, result, 'completed');

      logger.info('Customer import completed successfully', {
        jobId,
        imported: batchResult.imported,
        updated: batchResult.updated,
        skipped: batchResult.skipped,
        processingTime: (Date.now() - startTime) / 1000
      });

      return result;
    } catch (error: any) {
      logger.error('Customer import failed', {
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
          shopId: shopId || undefined,
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
  async getImportStatus(jobId: string, shopId: string | null): Promise<any> {
    const client = await this.pool.connect();

    try {
      let query = 'SELECT * FROM import_jobs WHERE job_id = $1';
      const params: any[] = [jobId];

      // If not admin, verify job belongs to shop
      if (shopId) {
        query += ' AND shop_id = $2';
        params.push(shopId);
      }

      const result = await client.query(query, params);

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
   * Validate import data (Layer 2: Schema validation & Layer 3: Business rules)
   */
  async validateImportData(
    customers: ParsedCustomer[]
  ): Promise<ValidationReport> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const validRows: number[] = [];

    // Track duplicate wallet addresses within file
    const walletAddresses = new Set<string>();

    for (const customer of customers) {
      // Sanitize data (XSS prevention)
      const sanitized = sanitizeCustomerData(customer);

      // Check for duplicates within file
      const walletKey = sanitized.walletAddress.toLowerCase();
      const hasDuplicate = walletAddresses.has(walletKey);

      // Validate row
      const validation = validateCustomerRow(sanitized, walletAddresses);

      if (!validation.isValid) {
        errors.push(...validation.errors);
      } else {
        validRows.push(customer.rowIndex);
      }

      warnings.push(...validation.warnings);

      // Add to set after validation
      if (!hasDuplicate) {
        walletAddresses.add(walletKey);
      }
    }

    return {
      totalRows: customers.length,
      validRows: validRows.length,
      invalidRows: customers.length - validRows.length,
      errors,
      warnings
    };
  }

  /**
   * Process import batch (actual database operations)
   */
  private async processImportBatch(
    customers: ParsedCustomer[],
    options: ImportOptions
  ): Promise<{ imported: number; updated: number; skipped: number; deleted: number }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let deleted = 0;

      // Handle 'replace' mode: delete all existing customers (ADMIN ONLY - dangerous!)
      if (options.mode === 'replace') {
        // WARNING: This deletes ALL customers - should only be used by admin in special cases
        const deleteResult = await client.query('DELETE FROM customers');
        deleted = deleteResult.rowCount || 0;
      }

      // Process each customer
      for (const customer of customers) {
        const sanitized = sanitizeCustomerData(customer);

        // Check if customer exists (by wallet address)
        const existing = await this.findExistingCustomer(client, sanitized.walletAddress);

        if (existing) {
          if (options.mode === 'merge') {
            // Update existing customer
            await this.updateCustomer(client, existing.address, sanitized);
            updated++;
          } else if (options.mode === 'add') {
            // Skip existing customer
            skipped++;
          }
        } else {
          // Insert new customer
          await this.insertCustomer(client, sanitized);
          imported++;
        }
      }

      await client.query('COMMIT');

      return { imported, updated, skipped, deleted };
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Customer import batch failed, transaction rolled back', {
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find existing customer by wallet address
   */
  private async findExistingCustomer(
    client: PoolClient,
    walletAddress: string
  ): Promise<any> {
    const result = await client.query(
      'SELECT address FROM customers WHERE LOWER(address) = LOWER($1) LIMIT 1',
      [walletAddress]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Insert new customer
   */
  private async insertCustomer(
    client: PoolClient,
    customer: ParsedCustomer
  ): Promise<void> {
    await client.query(
      `INSERT INTO customers (
        address, name, first_name, last_name, email, phone,
        tier, lifetime_earnings, active, referral_code, referred_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        customer.walletAddress.toLowerCase(),
        customer.name || null,
        customer.firstName || null,
        customer.lastName || null,
        customer.email || null,
        customer.phone || null,
        customer.tier,
        customer.lifetimeEarnings,
        customer.active,
        customer.referralCode || null,
        customer.referredBy || null
      ]
    );
  }

  /**
   * Update existing customer
   */
  private async updateCustomer(
    client: PoolClient,
    walletAddress: string,
    customer: ParsedCustomer
  ): Promise<void> {
    await client.query(
      `UPDATE customers SET
        name = COALESCE($1, name),
        first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name),
        email = COALESCE($4, email),
        phone = COALESCE($5, phone),
        tier = $6,
        lifetime_earnings = $7,
        active = $8,
        referral_code = COALESCE($9, referral_code),
        referred_by = COALESCE($10, referred_by)
      WHERE LOWER(address) = LOWER($11)`,
      [
        customer.name,
        customer.firstName,
        customer.lastName,
        customer.email,
        customer.phone,
        customer.tier,
        customer.lifetimeEarnings,
        customer.active,
        customer.referralCode,
        customer.referredBy,
        walletAddress
      ]
    );
  }

  /**
   * Get all shop customers (customers who have placed orders at this shop)
   */
  private async getShopCustomers(shopId: string): Promise<Customer[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `SELECT DISTINCT c.*
         FROM customers c
         INNER JOIN service_orders o ON o.customer_address = c.address
         WHERE o.shop_id = $1
         ORDER BY c.created_at DESC`,
        [shopId]
      );

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get all customers (admin only)
   */
  private async getAllCustomers(): Promise<Customer[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        'SELECT * FROM customers ORDER BY created_at DESC LIMIT 50000'
      );

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Save import job to database
   */
  private async saveImportJob(
    jobId: string,
    shopId: string | null,
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
          shopId || null,
          'customer',
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
    return `import_customer_${dateStr}_${random}`;
  }
}
