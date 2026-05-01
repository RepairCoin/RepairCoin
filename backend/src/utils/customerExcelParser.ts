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
  walletAddress: ['Wallet Address', 'wallet_address', 'WalletAddress', 'Address', 'Wallet', 'Customer Address'],
  name: ['Name', 'name', 'Full Name', 'FullName', 'Customer Name'],
  firstName: ['First Name', 'first_name', 'FirstName', 'Given Name'],
  lastName: ['Last Name', 'last_name', 'LastName', 'Surname', 'Family Name'],
  email: ['Email', 'email', 'Email Address', 'E-mail', 'EmailAddress'],
  phone: ['Phone', 'phone', 'Phone Number', 'PhoneNumber', 'Mobile', 'Telephone'],
  tier: ['Tier', 'tier', 'Customer Tier', 'Level', 'Membership'],
  lifetimeEarnings: ['Lifetime Earnings', 'lifetime_earnings', 'LifetimeEarnings', 'Total Earnings', 'Earnings'],
  active: ['Active Status', 'Active', 'active', 'Status', 'Enabled', 'IsActive'],
  referralCode: ['Referral Code', 'referral_code', 'ReferralCode', 'Code', 'Promo Code'],
  referredBy: ['Referred By', 'referred_by', 'ReferredBy', 'Referrer', 'Referral Source']
};

/**
 * Parse Excel (.xlsx, .xls) or CSV file buffer
 */
export async function parseCustomerExcel(
  buffer: Buffer,
  fileType: 'xlsx' | 'xls' | 'csv'
): Promise<ParsedCustomer[]> {
  try {
    if (fileType === 'csv') {
      return await parseCSV(buffer);
    } else {
      return parseExcel(buffer);
    }
  } catch (error: any) {
    throw new Error(`Failed to parse file: ${error.message}`);
  }
}

/**
 * Parse Excel file (.xlsx, .xls)
 */
function parseExcel(buffer: Buffer): ParsedCustomer[] {
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
  const columnMapping = mapColumnHeaders(headers);

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
function parseCSV(buffer: Buffer): Promise<ParsedCustomer[]> {
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
        columnMapping = mapColumnHeaders(headers);
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
export function mapColumnHeaders(headers: string[]): ColumnMapping {
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

  // Skip empty rows (no wallet address)
  if (!customer.walletAddress || String(customer.walletAddress).trim() === '') {
    return null;
  }

  // Parse and sanitize data
  return {
    rowIndex,
    walletAddress: sanitizeWalletAddress(customer.walletAddress),
    name: customer.name ? sanitizeString(customer.name) : undefined,
    firstName: customer.firstName ? sanitizeString(customer.firstName) : undefined,
    lastName: customer.lastName ? sanitizeString(customer.lastName) : undefined,
    email: customer.email ? sanitizeEmail(customer.email) : undefined,
    phone: customer.phone ? sanitizePhone(customer.phone) : undefined,
    tier: parseTier(customer.tier),
    lifetimeEarnings: parseLifetimeEarnings(customer.lifetimeEarnings),
    active: parseBoolean(customer.active),
    referralCode: customer.referralCode ? sanitizeString(customer.referralCode) : undefined,
    referredBy: customer.referredBy ? sanitizeString(customer.referredBy) : undefined
  };
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

  // Required field: Wallet Address
  if (!customer.walletAddress || customer.walletAddress.trim() === '') {
    errors.push({
      row: customer.rowIndex,
      column: 'Wallet Address',
      value: customer.walletAddress,
      message: 'Wallet address is required',
      severity: 'error',
      code: 'MISSING_REQUIRED_FIELD'
    });
  } else if (!isValidWalletAddress(customer.walletAddress)) {
    errors.push({
      row: customer.rowIndex,
      column: 'Wallet Address',
      value: customer.walletAddress,
      message: 'Invalid wallet address format. Must be 42 characters starting with 0x',
      severity: 'error',
      code: 'INVALID_WALLET_ADDRESS'
    });
  }

  // Check for duplicate wallet in import file
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
