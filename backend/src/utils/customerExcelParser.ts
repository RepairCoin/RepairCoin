/**
 * Excel/CSV Parser Utility for Customer Import
 * Handles parsing, validation, and sanitization of imported customer data
 */

import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import csvParser from 'csv-parser';

// Type definitions
export interface ParsedCustomer {
  rowIndex: number; // 1-indexed for user-friendly error messages
  walletAddress: string;
  /** false when the wallet was auto-generated (0xMANUAL… placeholder) because the file had none —
   *  a migrated/wallet-less customer keyed on email/phone, not a real on-chain wallet. */
  walletProvided: boolean;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  lifetimeEarnings: number;
  active: boolean;
  referralCode?: string;
  referredBy?: string;
  // Migration / marketing fields (Phase 1, D7/D9)
  externalRef?: string;            // source system's customer id (e.g. Square Customer ID)
  marketingEmailConsent?: boolean; // from "Email Subscription Status"
  lifetimeSpendUsd?: number;       // USD spent at prior POS (NOT RCN)
  firstVisitAt?: string;
  lastVisitAt?: string;
  visitCount?: number;
}

export interface ValidationError {
  row: number;
  column: string;
  value: any;
  message: string;
  severity: 'error' | 'warning';
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ColumnMapping {
  [key: string]: string;
}

// Column name aliases (flexible column name matching)
const COLUMN_ALIASES: { [key: string]: string[] } = {
  // NOTE: 'Address' intentionally removed — it collides with street-address columns (e.g. Square's
  // "Street Address 1") and would mis-map a physical address into the wallet field. Wallet is
  // optional now; rows without one get a 0xMANUAL… placeholder (keyed on email/phone).
  walletAddress: ['Wallet Address', 'wallet_address', 'WalletAddress', 'Wallet', 'Customer Wallet'],
  name: ['Name', 'name', 'Full Name', 'FullName', 'Customer Name'],
  firstName: ['First Name', 'first_name', 'FirstName', 'Given Name'],
  lastName: ['Last Name', 'last_name', 'LastName', 'Surname', 'Family Name'],
  email: ['Email', 'email', 'Email Address', 'E-mail', 'EmailAddress', 'E-mail Address'],
  phone: ['Phone', 'phone', 'Phone Number', 'PhoneNumber', 'Mobile', 'Mobile Number', 'Telephone', 'Contact Number', 'Cell', 'Cell Phone'],
  tier: ['Tier', 'tier', 'Customer Tier', 'Level', 'Membership'],
  lifetimeEarnings: ['Lifetime Earnings', 'lifetime_earnings', 'LifetimeEarnings', 'Total Earnings', 'Earnings'],
  active: ['Active Status', 'Active', 'active', 'Status', 'Enabled', 'IsActive'],
  referralCode: ['Referral Code', 'referral_code', 'ReferralCode', 'Code', 'Promo Code'],
  referredBy: ['Referred By', 'referred_by', 'ReferredBy', 'Referrer', 'Referral Source'],
  // Migration / marketing fields (D7/D9)
  externalRef: ['Square Customer ID', 'Reference ID', 'Customer ID', 'External ID', 'reference_id'],
  marketingEmailConsent: ['Email Subscription Status', 'Email Subscription', 'Subscribed', 'Marketing Consent', 'Email Opt-in'],
  lifetimeSpendUsd: ['Lifetime Spend', 'Total Spend', 'Lifetime Value', 'Amount Spent'],
  firstVisitAt: ['First Visit', 'First Visit Date', 'first_visit'],
  lastVisitAt: ['Last Visit', 'Last Visit Date', 'last_visit'],
  visitCount: ['Transaction Count', 'Visit Count', 'Visits', 'Total Visits', 'Number of Visits']
};

/**
 * Parse Excel (.xlsx, .xls) or CSV file buffer
 */
export async function parseCustomerExcel(
  buffer: Buffer,
  fileType: 'xlsx' | 'xls' | 'csv',
  mappingOverride?: ColumnMapping
): Promise<ParsedCustomer[]> {
  try {
    if (fileType === 'csv') {
      return await parseCSV(buffer, mappingOverride);
    } else {
      return parseExcel(buffer, mappingOverride);
    }
  } catch (error: any) {
    throw new Error(`Failed to parse file: ${error.message}`);
  }
}

/** Lightweight peek for AI mapping: the file's header row + the first `n` sample rows (as
 *  header→value objects). Uses XLSX for both xlsx/xls AND csv (it sniffs delimiters). */
export function extractHeadersAndSamples(
  buffer: Buffer,
  _fileType: 'xlsx' | 'xls' | 'csv',
  n = 5
): { headers: string[]; samples: Record<string, string>[] } {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], samples: [] };
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', blankrows: false }) as any[][];
  if (rows.length === 0) return { headers: [], samples: [] };
  const headers = (rows[0] as any[]).map((h) => String(h).trim());
  const samples: Record<string, string>[] = [];
  for (let i = 1; i < rows.length && samples.length < n; i++) {
    const row = rows[i];
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = row[idx] != null ? String(row[idx]) : ''; });
    samples.push(obj);
  }
  return { headers, samples };
}

/**
 * Parse Excel file (.xlsx, .xls)
 */
function parseExcel(buffer: Buffer, mappingOverride?: ColumnMapping): ParsedCustomer[] {
  // Read workbook from buffer
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // Get first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel file is empty (no sheets found)');
  }

  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON with header row
  const rawData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1, // Return array of arrays
    defval: '', // Default value for empty cells
    blankrows: false // Skip blank rows
  }) as any[][];

  if (rawData.length < 2) {
    throw new Error('Excel file must have at least a header row and one data row');
  }

  // First row is headers
  const headers = rawData[0] as string[];
  const columnMapping = mapColumnHeaders(headers, mappingOverride);

  // Parse data rows (skip header)
  const parsedCustomers: ParsedCustomer[] = [];

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    const rowIndex = i + 1; // 1-indexed (including header)

    try {
      const customer = mapRowToCustomer(row, headers, columnMapping, rowIndex);
      if (customer) {
        parsedCustomers.push(customer);
      }
    } catch (error: any) {
      // Row parsing error - skip and log
      console.warn(`Skipping row ${rowIndex}: ${error.message}`);
    }
  }

  return parsedCustomers;
}

/**
 * Parse CSV file
 */
function parseCSV(buffer: Buffer, mappingOverride?: ColumnMapping): Promise<ParsedCustomer[]> {
  return new Promise((resolve, reject) => {
    const parsedCustomers: ParsedCustomer[] = [];
    const errors: Error[] = [];
    let rowIndex = 1; // Start at 1 (header row)
    let headers: string[] = [];
    let columnMapping: ColumnMapping = {};

    const stream = Readable.from(buffer);

    stream
      .pipe(csvParser())
      .on('headers', (headerRow: string[]) => {
        headers = headerRow;
        columnMapping = mapColumnHeaders(headers, mappingOverride);
        rowIndex++; // Move to first data row
      })
      .on('data', (row: any) => {
        try {
          const rowValues = Object.values(row) as string[];
          const customer = mapRowToCustomer(rowValues, headers, columnMapping, rowIndex);
          if (customer) {
            parsedCustomers.push(customer);
          }
        } catch (error: any) {
          errors.push(new Error(`Row ${rowIndex}: ${error.message}`));
        }
        rowIndex++;
      })
      .on('end', () => {
        if (errors.length > 0 && parsedCustomers.length === 0) {
          reject(new Error(`CSV parsing failed: ${errors[0].message}`));
        } else {
          resolve(parsedCustomers);
        }
      })
      .on('error', (error: Error) => {
        reject(error);
      });
  });
}

/**
 * Map column headers to internal field names
 */
export function mapColumnHeaders(headers: string[], override?: ColumnMapping): ColumnMapping {
  const mapping: ColumnMapping = {};

  for (const [internalName, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const header of headers) {
      const normalizedHeader = header.trim();
      if (aliases.some(alias => alias.toLowerCase() === normalizedHeader.toLowerCase())) {
        mapping[internalName] = normalizedHeader;
        break;
      }
    }
  }

  // Explicit override (e.g. AI-suggested + human-confirmed mapping) wins over alias auto-detect.
  // Only honor entries whose source header actually exists in the file (drop hallucinations).
  if (override) {
    for (const [field, srcHeader] of Object.entries(override)) {
      if (!srcHeader) { delete mapping[field]; continue; }
      const actual = headers.find((h) => String(h).trim().toLowerCase() === String(srcHeader).trim().toLowerCase());
      if (actual) mapping[field] = actual.trim();
    }
  }

  return mapping;
}

/**
 * Map a single row to ParsedCustomer object
 */
function mapRowToCustomer(
  row: any[],
  headers: string[],
  columnMapping: ColumnMapping,
  rowIndex: number
): ParsedCustomer | null {
  // Create object from row values
  const rowObj: any = {};
  headers.forEach((header, index) => {
    rowObj[header] = row[index];
  });

  // Map to internal field names
  const customer: any = {};

  for (const [internalName, headerName] of Object.entries(columnMapping)) {
    customer[internalName] = rowObj[headerName];
  }

  const rawWallet = customer.walletAddress ? String(customer.walletAddress).trim() : '';
  const walletProvided = rawWallet !== '';
  const email = customer.email ? sanitizeEmail(customer.email) : undefined;
  const phone = customer.phone ? sanitizePhone(customer.phone) : undefined;
  const hasContact = walletProvided || !!email || !!phone;
  const hasName = !!(customer.name || customer.firstName || customer.lastName);

  // Truly blank row (no contact AND no name) → skip silently. A named-but-contactless row is kept so
  // validation flags it MISSING_CONTACT and it shows in the skipped report (D6), not vanishes.
  if (!hasContact && !hasName) {
    return null;
  }

  const firstName = customer.firstName ? sanitizeString(customer.firstName) : undefined;
  const lastName = customer.lastName ? sanitizeString(customer.lastName) : undefined;
  // Always populate `name` (the display + search field): use the file's full-name column, else
  // compose from first/last. Without this, imported customers show as "Anonymous" and the admin
  // name search can't find them.
  const fullName = customer.name ? sanitizeString(customer.name)
    : ([firstName, lastName].filter(Boolean).join(' ') || undefined);

  // Wallet-less migration (D1): email/phone present but no real wallet → 0xMANUAL… placeholder
  // (claimable later). Contactless-but-named → empty wallet, flagged + skipped at validation.
  return {
    rowIndex,
    walletAddress: walletProvided ? sanitizeWalletAddress(rawWallet) : (hasContact ? generatePlaceholderWallet() : ''),
    walletProvided,
    name: fullName,
    firstName,
    lastName,
    email,
    phone,
    tier: parseTier(customer.tier),
    lifetimeEarnings: parseLifetimeEarnings(customer.lifetimeEarnings),
    active: parseBoolean(customer.active),
    referralCode: customer.referralCode ? sanitizeString(customer.referralCode) : undefined,
    referredBy: customer.referredBy ? sanitizeString(customer.referredBy) : undefined,
    externalRef: customer.externalRef ? sanitizeString(customer.externalRef) : undefined,
    marketingEmailConsent: parseConsent(customer.marketingEmailConsent),
    lifetimeSpendUsd: parseMoneyOrUndef(customer.lifetimeSpendUsd),
    firstVisitAt: parseDateOrUndef(customer.firstVisitAt),
    lastVisitAt: parseDateOrUndef(customer.lastVisitAt),
    visitCount: parseIntOrUndef(customer.visitCount),
  };
}

/** Placeholder EVM-shaped marker for a wallet-less imported customer (matches the manual-booking
 *  convention). NOT a real wallet — claimable later by email/phone. */
function generatePlaceholderWallet(): string {
  const hex = Array.from({ length: 34 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return ('0xMANUAL' + hex).slice(0, 42);
}

/** True when the wallet is a generated placeholder (skip on-chain-format validation for these). */
export function isPlaceholderWallet(address: string): boolean {
  return !!address && address.toLowerCase().startsWith('0xmanual');
}

/**
 * Validate a single customer row
 */
export function validateCustomerRow(
  customer: ParsedCustomer,
  existingWallets?: Set<string>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (customer.walletProvided) {
    // A real wallet was supplied → it must be a valid on-chain address.
    if (!isValidWalletAddress(customer.walletAddress)) {
      errors.push({
        row: customer.rowIndex,
        column: 'Wallet Address',
        value: customer.walletAddress,
        message: 'Invalid wallet address format. Must be 42 characters starting with 0x',
        severity: 'error',
        code: 'INVALID_WALLET_ADDRESS'
      });
    }
    // Duplicate-wallet check only applies to real wallets (placeholders are unique by design).
    if (existingWallets && existingWallets.has(customer.walletAddress.toLowerCase())) {
      errors.push({
        row: customer.rowIndex,
        column: 'Wallet Address',
        value: customer.walletAddress,
        message: 'Duplicate wallet address found in import file',
        severity: 'error',
        code: 'DUPLICATE_WALLET_ADDRESS'
      });
    }
  } else if (!customer.email && !customer.phone) {
    // Wallet-less row with no contact → can't be keyed/claimed/deduped.
    errors.push({
      row: customer.rowIndex,
      column: 'Email / Phone',
      value: '',
      message: 'A wallet-less customer needs an email or phone to be imported',
      severity: 'error',
      code: 'MISSING_CONTACT'
    });
  }

  // Optional field: Email
  if (customer.email && !isValidEmail(customer.email)) {
    errors.push({
      row: customer.rowIndex,
      column: 'Email',
      value: customer.email,
      message: 'Invalid email format',
      severity: 'error',
      code: 'INVALID_EMAIL'
    });
  }

  // Optional field: Name length
  if (customer.name && customer.name.length > 255) {
    errors.push({
      row: customer.rowIndex,
      column: 'Name',
      value: customer.name,
      message: 'Name must be 255 characters or less',
      severity: 'error',
      code: 'NAME_TOO_LONG'
    });
  }

  // Optional field: Lifetime Earnings
  if (customer.lifetimeEarnings < 0) {
    errors.push({
      row: customer.rowIndex,
      column: 'Lifetime Earnings',
      value: customer.lifetimeEarnings,
      message: 'Lifetime earnings cannot be negative',
      severity: 'error',
      code: 'INVALID_LIFETIME_EARNINGS'
    });
  }

  // Warn if lifetime earnings is unusually high
  if (customer.lifetimeEarnings > 10000) {
    warnings.push({
      row: customer.rowIndex,
      column: 'Lifetime Earnings',
      value: customer.lifetimeEarnings,
      message: 'Lifetime earnings is unusually high (over 10,000 RCN)',
      severity: 'warning',
      code: 'HIGH_LIFETIME_EARNINGS'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Sanitize customer data (XSS prevention, data cleaning)
 */
export function sanitizeCustomerData(customer: ParsedCustomer): ParsedCustomer {
  return {
    ...customer,
    walletAddress: customer.walletAddress.toLowerCase().trim(),
    name: customer.name ? stripHtml(customer.name) : undefined,
    firstName: customer.firstName ? stripHtml(customer.firstName) : undefined,
    lastName: customer.lastName ? stripHtml(customer.lastName) : undefined,
    email: customer.email ? customer.email.toLowerCase().trim() : undefined,
    phone: customer.phone ? customer.phone.trim() : undefined,
    referralCode: customer.referralCode ? stripHtml(customer.referralCode.toUpperCase()) : undefined,
    referredBy: customer.referredBy ? stripHtml(customer.referredBy) : undefined
  };
}

// Helper functions

function sanitizeString(value: any): string {
  if (value === undefined || value === null) return '';
  return stripHtml(String(value).trim());
}

function sanitizeWalletAddress(value: any): string {
  if (!value) return '';
  const addr = String(value).trim();
  // Ensure it starts with 0x
  if (!addr.startsWith('0x') && addr.startsWith('x')) {
    return '0' + addr;
  }
  if (!addr.startsWith('0x')) {
    return '0x' + addr;
  }
  return addr.toLowerCase();
}

function sanitizeEmail(value: any): string | undefined {
  if (!value) return undefined;
  return String(value).toLowerCase().trim();
}

function sanitizePhone(value: any): string | undefined {
  if (!value) return undefined;
  return String(value).trim();
}

function parseTier(value: any): 'BRONZE' | 'SILVER' | 'GOLD' {
  if (!value) return 'BRONZE';

  const normalized = String(value).toUpperCase().trim();

  if (['SILVER', 'GOLD'].includes(normalized)) {
    return normalized as 'SILVER' | 'GOLD';
  }

  return 'BRONZE';
}

function parseLifetimeEarnings(value: any): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  // Remove currency symbols and commas
  const cleanValue = String(value).replace(/[$,]/g, '').trim();
  const num = parseFloat(cleanValue);

  if (isNaN(num)) {
    return 0;
  }

  // Round to 2 decimal places
  return Math.round(num * 100) / 100;
}

function parseBoolean(value: any): boolean {
  if (value === undefined || value === null || value === '') {
    return true; // Default to active
  }

  const normalized = String(value).toLowerCase().trim();
  return ['true', '1', 'yes', 'active', 'enabled'].includes(normalized);
}

/** Marketing-email consent (e.g. Square "Email Subscription Status"). Returns undefined when the
 *  column is absent/blank (unknown — campaigns should treat unknown as NOT consented). Only an
 *  explicit subscribed/opt-in value is `true`; anything else (Unsubscribed/Never/Pending) is `false`. */
function parseConsent(value: any): boolean | undefined {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const n = String(value).toLowerCase().trim();
  if (['subscribed', 'true', '1', 'yes', 'opted in', 'opted-in', 'optin', 'opt-in', 'subscribe'].includes(n)) return true;
  return false;
}

/** Money like "$1,234.56" → 1234.56; undefined when absent/unparseable. */
function parseMoneyOrUndef(value: any): number | undefined {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const n = parseFloat(String(value).replace(/[$,]/g, '').trim());
  return isNaN(n) ? undefined : Math.round(n * 100) / 100;
}

/** Parse a date-ish cell to an ISO string; undefined when absent/unparseable. */
function parseDateOrUndef(value: any): string | undefined {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const d = new Date(String(value).trim());
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function parseIntOrUndef(value: any): number | undefined {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const n = parseInt(String(value).replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? undefined : n;
}

function isValidWalletAddress(address: string): boolean {
  // Ethereum address: 0x followed by 40 hexadecimal characters
  const regex = /^0x[a-fA-F0-9]{40}$/;
  return regex.test(address);
}

function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function stripHtml(str: string): string {
  if (!str) return '';

  // Remove HTML tags
  let clean = str.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  clean = clean.replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#x27;/g, "'")
              .replace(/&#x2F;/g, '/');

  return clean.trim();
}
