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
  /** Origin platform tag stored on imported rows (e.g. 'square', 'csv'). Default 'import'. */
  source?: string;
  /** Explicit column mapping (ourField → source header) from the AI-suggested + confirmed map.
   *  Overrides alias auto-detect; unknown/absent headers are ignored. */
  columnMapping?: Record<string, string>;
  /** Target shop the imported customers belong to → stamped on customers.home_shop_id so the shop
   *  "owns" them (admin picks this; required for the migration to attribute customers to a shop). */
  homeShopId?: string;
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
  /** Sanitized rows that passed validation — the set actually imported. */
  validCustomers: ParsedCustomer[];
}

/** Normalize a phone to its last 10 digits for tolerant dedup/match across formats. '' if too short. */
function phoneDedupKey(phone: string): string {
  const d = (phone || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
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

      // Step 2: Parse file (with the confirmed AI/explicit column mapping, if provided)
      const parsedCustomers = await parseCustomerExcel(fileBuffer, fileType, options.columnMapping);

      if (parsedCustomers.length === 0) {
        throw new Error('File contains no valid customer data');
      }

      if (parsedCustomers.length > 50000) {
        throw new Error('Maximum 50,000 customers per import. Please split into multiple files.');
      }

      // Step 3: Data validation (collects the valid rows; invalid/contactless are skipped + reported)
      const validationReport = await this.validateImportData(parsedCustomers);

      // Hard-fail ONLY when nothing is importable; otherwise skip the invalid rows and import the rest.
      if (validationReport.validCustomers.length === 0) {
        throw new Error(
          'No importable rows: every row was missing a valid wallet AND an email/phone. ' +
          'Make sure the file has an Email or Phone column.'
        );
      }

      // Errors can be huge (e.g. thousands of contactless rows) — store/return a capped sample.
      const errorSample = validationReport.errors.slice(0, 200);

      // If dry run, return validation results without importing.
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
            skipped: validationReport.invalidRows,
            deleted: 0
          },
          errors: errorSample,
          warnings: validationReport.warnings.slice(0, 200),
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

      // Step 4: Process import (only the valid rows)
      const batchResult = await this.processImportBatch(validationReport.validCustomers, options);

      const result: ImportResult = {
        success: true,
        jobId,
        summary: {
          totalRows: validationReport.totalRows,
          validRows: validationReport.validRows,
          invalidRows: validationReport.invalidRows,
          imported: batchResult.imported,
          updated: batchResult.updated,
          skipped: batchResult.skipped + validationReport.invalidRows, // includes contactless/dup rows
          deleted: batchResult.deleted
        },
        errors: errorSample,
        warnings: validationReport.warnings.slice(0, 200),
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
    const validCustomers: ParsedCustomer[] = [];

    // Within-file dedup keys: real wallets by address; wallet-less rows by email/phone (the
    // claim/dedup key) — also avoids the unique-email DB constraint blowing up the batch.
    const seenWallets = new Set<string>();
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();

    for (const customer of customers) {
      const sanitized = sanitizeCustomerData(customer);
      const validation = validateCustomerRow(sanitized, sanitized.walletProvided ? seenWallets : undefined);
      warnings.push(...validation.warnings);

      if (!validation.isValid) {
        errors.push(...validation.errors);
        continue;
      }

      // Wallet-less: skip a later row that repeats an email/phone seen earlier in the file.
      if (!sanitized.walletProvided) {
        const em = sanitized.email?.toLowerCase();
        const ph = sanitized.phone ? phoneDedupKey(sanitized.phone) : undefined;
        if ((em && seenEmails.has(em)) || (ph && seenPhones.has(ph))) {
          errors.push({
            row: sanitized.rowIndex, column: 'Email / Phone', value: em || ph || '',
            message: 'Duplicate contact (email/phone) earlier in the file — skipped',
            severity: 'error', code: 'DUPLICATE_CONTACT'
          });
          continue;
        }
        if (em) seenEmails.add(em);
        if (ph) seenPhones.add(ph);
      } else {
        seenWallets.add(sanitized.walletAddress.toLowerCase());
      }

      validCustomers.push(sanitized);
    }

    return {
      totalRows: customers.length,
      validRows: validCustomers.length,
      invalidRows: customers.length - validCustomers.length,
      errors,
      warnings,
      validCustomers
    };
  }

  /**
   * Process import batch (actual database operations)
   */
  private async processImportBatch(
    customers: ParsedCustomer[],
    options: ImportOptions
  ): Promise<{ imported: number; updated: number; skipped: number; deleted: number }> {
    let imported = 0, updated = 0, skipped = 0, deleted = 0;
    const source = options.source || 'import';
    const homeShopId = options.homeShopId || null; // attribute imported customers to the target shop
    const CHUNK = 500; // chunked transactions: avoids one giant tx timing out on 15k+ rows.

    // 'replace' mode (admin-only, dangerous): wipe all customers first, its own transaction.
    if (options.mode === 'replace') {
      const c = await this.pool.connect();
      try {
        await c.query('BEGIN');
        const r = await c.query('DELETE FROM customers');
        deleted = r.rowCount || 0;
        await c.query('COMMIT');
      } catch (e: any) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    }

    for (let i = 0; i < customers.length; i += CHUNK) {
      const chunk = customers.slice(i, i + CHUNK);
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        for (const customer of chunk) {
          // Real wallet → match by wallet; wallet-less (placeholder) → match by email/phone.
          const existing = customer.walletProvided
            ? await this.findExistingByWallet(client, customer.walletAddress)
            : await this.findExistingByContact(client, customer.email, customer.phone);

          if (existing) {
            if (options.mode === 'merge') { await this.updateCustomer(client, existing.address, customer, source, homeShopId); updated++; }
            else { skipped++; } // 'add' → leave the existing customer alone
          } else {
            await this.insertCustomer(client, customer, source, homeShopId);
            imported++;
          }
        }
        await client.query('COMMIT');
      } catch (error: any) {
        await client.query('ROLLBACK');
        logger.error('Customer import chunk failed, rolled back', { chunkStart: i, error: error.message });
        throw error; // earlier chunks stay committed; re-run skips them ('add' dedups on contact)
      } finally {
        client.release();
      }
    }

    return { imported, updated, skipped, deleted };
  }

  /** Find an existing customer by (real) wallet address. */
  private async findExistingByWallet(client: PoolClient, walletAddress: string): Promise<any> {
    const r = await client.query(
      'SELECT address FROM customers WHERE LOWER(address) = LOWER($1) LIMIT 1',
      [walletAddress]
    );
    return r.rows[0] || null;
  }

  /** Find an existing customer by email or phone (wallet-less dedup/claim key; phone normalized to
   *  its last 10 digits to match across formats). */
  private async findExistingByContact(client: PoolClient, email?: string, phone?: string): Promise<any> {
    const em = email ? email.toLowerCase() : '';
    const tail = phone ? phoneDedupKey(phone) : '';
    if (!em && !tail) return null;
    const r = await client.query(
      `SELECT address FROM customers
        WHERE ($1 <> '' AND LOWER(email) = $1)
           OR ($2 <> '' AND right(regexp_replace(coalesce(phone,''), '\\D', '', 'g'), 10) = $2)
        LIMIT 1`,
      [em, tail]
    );
    return r.rows[0] || null;
  }

  /** Insert a new customer. Sets wallet_address (= address; NOT NULL in schema — the old insert
   *  omitted it and would fail) plus migration/marketing fields (D7/D9). */
  private async insertCustomer(client: PoolClient, customer: ParsedCustomer, source: string, homeShopId: string | null): Promise<void> {
    await client.query(
      `INSERT INTO customers (
        address, wallet_address, name, first_name, last_name, email, phone,
        tier, lifetime_earnings, is_active, referral_code, referred_by,
        import_source, external_ref, marketing_email_consent, lifetime_spend_usd,
        first_visit_at, last_visit_at, visit_count, home_shop_id, created_at
      ) VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19, NOW())`,
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
        customer.referredBy || null,
        source,
        customer.externalRef || null,
        customer.marketingEmailConsent ?? null,
        customer.lifetimeSpendUsd ?? null,
        customer.firstVisitAt || null,
        customer.lastVisitAt || null,
        customer.visitCount ?? null,
        homeShopId
      ]
    );
  }

  /** Update an existing customer (merge mode) — fills gaps + refreshes migration/marketing fields.
   *  home_shop_id is only filled when empty (don't reassign a customer who already has a home shop). */
  private async updateCustomer(client: PoolClient, address: string, customer: ParsedCustomer, source: string, homeShopId: string | null): Promise<void> {
    await client.query(
      `UPDATE customers SET
        name = COALESCE($1, name),
        first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name),
        email = COALESCE($4, email),
        phone = COALESCE($5, phone),
        tier = $6,
        lifetime_earnings = $7,
        is_active = $8,
        referral_code = COALESCE($9, referral_code),
        referred_by = COALESCE($10, referred_by),
        import_source = COALESCE(import_source, $11),
        external_ref = COALESCE($12, external_ref),
        marketing_email_consent = COALESCE($13, marketing_email_consent),
        lifetime_spend_usd = COALESCE($14, lifetime_spend_usd),
        first_visit_at = COALESCE($15, first_visit_at),
        last_visit_at = COALESCE($16, last_visit_at),
        visit_count = COALESCE($17, visit_count),
        home_shop_id = COALESCE(home_shop_id, $19)
      WHERE LOWER(address) = LOWER($18)`,
      [
        customer.name || null,
        customer.firstName || null,
        customer.lastName || null,
        customer.email || null,
        customer.phone || null,
        customer.tier,
        customer.lifetimeEarnings,
        customer.active,
        customer.referralCode || null,
        customer.referredBy || null,
        source,
        customer.externalRef || null,
        customer.marketingEmailConsent ?? null,
        customer.lifetimeSpendUsd ?? null,
        customer.firstVisitAt || null,
        customer.lastVisitAt || null,
        customer.visitCount ?? null,
        address,
        homeShopId
      ]
    );
  }

  /**
   * Get all shop customers: those who have ordered here, plus imported/migrated customers
   * homed here (home_shop_id) with no orders yet — otherwise a shop can't export the very
   * list it just imported.
   */
  private async getShopCustomers(shopId: string): Promise<Customer[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `SELECT DISTINCT c.*
         FROM customers c
         LEFT JOIN service_orders o ON o.customer_address = c.address AND o.shop_id = $1
         WHERE (o.order_id IS NOT NULL OR LOWER(c.home_shop_id) = LOWER($1))
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
          shopId, // null for admin-scoped imports (import_jobs.shop_id is nullable; FK skips null)
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
