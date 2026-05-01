/**
 * Excel/CSV Parser Utility for Service Import
 * Handles parsing, validation, and sanitization of imported service data
 */

import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import csvParser from 'csv-parser';

// Type definitions
export interface ParsedService {
  rowIndex: number; // 1-indexed for user-friendly error messages
  serviceName: string;
  description?: string;
  priceUsd: number;
  durationMinutes?: number;
  category: string;
  imageUrl?: string;
  tags?: string[];
  active: boolean;
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
  serviceName: ['Service Name', 'service_name', 'ServiceName', 'name', 'Name', 'Item Name', 'Title'],
  description: ['Description', 'description', 'Desc', 'Details', 'Info', 'Notes'],
  priceUsd: ['Price (USD)', 'Price', 'price', 'price_usd', 'Cost', 'Amount', 'Price USD'],
  durationMinutes: ['Duration (Minutes)', 'duration', 'Duration', 'Time', 'Length', 'Duration Minutes'],
  category: ['Category', 'category', 'Type', 'Service Type', 'Item Category'],
  imageUrl: ['Image URL', 'image', 'Image', 'Photo', 'Picture', 'Image Link', 'ImageURL'],
  tags: ['Tags', 'tags', 'Keywords', 'Labels'],
  active: ['Active Status', 'Active', 'active', 'Status', 'Enabled', 'IsActive']
};

/**
 * Parse Excel (.xlsx, .xls) or CSV file buffer
 */
export async function parseServiceExcel(
  buffer: Buffer,
  fileType: 'xlsx' | 'xls' | 'csv'
): Promise<ParsedService[]> {
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
function parseExcel(buffer: Buffer): ParsedService[] {
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
  const parsedServices: ParsedService[] = [];

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    const rowIndex = i + 1; // 1-indexed (including header)

    try {
      const service = mapRowToService(row, headers, columnMapping, rowIndex);
      if (service) {
        parsedServices.push(service);
      }
    } catch (error: any) {
      // Row parsing error - skip and log
      console.warn(`Skipping row ${rowIndex}: ${error.message}`);
    }
  }

  return parsedServices;
}

/**
 * Parse CSV file
 */
function parseCSV(buffer: Buffer): Promise<ParsedService[]> {
  return new Promise((resolve, reject) => {
    const parsedServices: ParsedService[] = [];
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
          const service = mapRowToService(rowValues, headers, columnMapping, rowIndex);
          if (service) {
            parsedServices.push(service);
          }
        } catch (error: any) {
          errors.push(new Error(`Row ${rowIndex}: ${error.message}`));
        }
        rowIndex++;
      })
      .on('end', () => {
        if (errors.length > 0 && parsedServices.length === 0) {
          reject(new Error(`CSV parsing failed: ${errors[0].message}`));
        } else {
          resolve(parsedServices);
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
 * Map a single row to ParsedService object
 */
function mapRowToService(
  row: any[],
  headers: string[],
  columnMapping: ColumnMapping,
  rowIndex: number
): ParsedService | null {
  // Create object from row values
  const rowObj: any = {};
  headers.forEach((header, index) => {
    rowObj[header] = row[index];
  });

  // Map to internal field names
  const service: any = {};

  for (const [internalName, headerName] of Object.entries(columnMapping)) {
    service[internalName] = rowObj[headerName];
  }

  // Skip empty rows (no service name)
  if (!service.serviceName || String(service.serviceName).trim() === '') {
    return null;
  }

  // Parse and sanitize data
  return {
    rowIndex,
    serviceName: sanitizeString(service.serviceName),
    description: service.description ? sanitizeString(service.description) : undefined,
    priceUsd: parsePrice(service.priceUsd),
    durationMinutes: service.durationMinutes ? parseDuration(service.durationMinutes) : undefined,
    category: sanitizeCategory(service.category),
    imageUrl: service.imageUrl ? sanitizeUrl(service.imageUrl) : undefined,
    tags: service.tags ? parseTags(service.tags) : undefined,
    active: parseBoolean(service.active)
  };
}

/**
 * Validate a single service row
 */
export function validateServiceRow(
  service: ParsedService,
  shopId: string,
  validCategories: string[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Required field: Service Name
  if (!service.serviceName || service.serviceName.trim() === '') {
    errors.push({
      row: service.rowIndex,
      column: 'Service Name',
      value: service.serviceName,
      message: 'Service name is required',
      severity: 'error',
      code: 'MISSING_REQUIRED_FIELD'
    });
  } else if (service.serviceName.length > 100) {
    errors.push({
      row: service.rowIndex,
      column: 'Service Name',
      value: service.serviceName,
      message: 'Service name must be 100 characters or less',
      severity: 'error',
      code: 'SERVICE_NAME_TOO_LONG'
    });
  }

  // Required field: Price
  if (service.priceUsd === undefined || service.priceUsd === null) {
    errors.push({
      row: service.rowIndex,
      column: 'Price (USD)',
      value: service.priceUsd,
      message: 'Price is required',
      severity: 'error',
      code: 'MISSING_REQUIRED_FIELD'
    });
  } else if (service.priceUsd <= 0) {
    errors.push({
      row: service.rowIndex,
      column: 'Price (USD)',
      value: service.priceUsd,
      message: 'Price must be greater than 0',
      severity: 'error',
      code: 'INVALID_PRICE'
    });
  } else if (service.priceUsd > 10000) {
    warnings.push({
      row: service.rowIndex,
      column: 'Price (USD)',
      value: service.priceUsd,
      message: 'Price is unusually high (over $10,000)',
      severity: 'warning',
      code: 'HIGH_PRICE'
    });
  }

  // Required field: Category
  if (!service.category || service.category.trim() === '') {
    errors.push({
      row: service.rowIndex,
      column: 'Category',
      value: service.category,
      message: 'Category is required',
      severity: 'error',
      code: 'MISSING_REQUIRED_FIELD'
    });
  } else if (!validCategories.includes(service.category)) {
    errors.push({
      row: service.rowIndex,
      column: 'Category',
      value: service.category,
      message: `Category must be one of: ${validCategories.join(', ')}`,
      severity: 'error',
      code: 'INVALID_CATEGORY'
    });
  }

  // Optional field: Duration
  if (service.durationMinutes !== undefined) {
    if (service.durationMinutes <= 0) {
      errors.push({
        row: service.rowIndex,
        column: 'Duration (Minutes)',
        value: service.durationMinutes,
        message: 'Duration must be greater than 0 if provided',
        severity: 'error',
        code: 'INVALID_DURATION'
      });
    } else if (service.durationMinutes > 1440) {
      errors.push({
        row: service.rowIndex,
        column: 'Duration (Minutes)',
        value: service.durationMinutes,
        message: 'Duration cannot exceed 1440 minutes (24 hours)',
        severity: 'error',
        code: 'INVALID_DURATION'
      });
    }
  }

  // Optional field: Image URL
  if (service.imageUrl) {
    try {
      const url = new URL(service.imageUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push({
          row: service.rowIndex,
          column: 'Image URL',
          value: service.imageUrl,
          message: 'Image URL must use http:// or https:// protocol',
          severity: 'error',
          code: 'INVALID_URL'
        });
      }
    } catch {
      errors.push({
        row: service.rowIndex,
        column: 'Image URL',
        value: service.imageUrl,
        message: 'Image URL is not a valid URL',
        severity: 'error',
        code: 'INVALID_URL'
      });
    }
  }

  // Optional field: Tags
  if (service.tags && service.tags.length > 5) {
    errors.push({
      row: service.rowIndex,
      column: 'Tags',
      value: service.tags.join(', '),
      message: 'Maximum 5 tags allowed',
      severity: 'error',
      code: 'TOO_MANY_TAGS'
    });
  }

  if (service.tags) {
    for (const tag of service.tags) {
      if (tag.length > 20) {
        errors.push({
          row: service.rowIndex,
          column: 'Tags',
          value: tag,
          message: `Tag "${tag}" exceeds 20 characters`,
          severity: 'error',
          code: 'TAG_TOO_LONG'
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Sanitize service data (XSS prevention, data cleaning)
 */
export function sanitizeServiceData(service: ParsedService): ParsedService {
  return {
    ...service,
    serviceName: stripHtml(service.serviceName),
    description: service.description ? stripHtml(service.description) : undefined,
    category: service.category.toLowerCase().trim(),
    tags: service.tags ? service.tags.map(tag => stripHtml(tag)) : undefined
  };
}

// Helper functions

function sanitizeString(value: any): string {
  if (value === undefined || value === null) return '';
  return stripHtml(String(value).trim());
}

function sanitizeCategory(value: any): string {
  if (value === undefined || value === null) return '';
  return String(value).toLowerCase().trim().replace(/\s+/g, '_');
}

function sanitizeUrl(value: any): string | undefined {
  if (!value) return undefined;
  const urlStr = String(value).trim();
  try {
    const url = new URL(urlStr);
    return url.href;
  } catch {
    return undefined;
  }
}

function parsePrice(value: any): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  // Remove currency symbols and commas
  const cleanValue = String(value).replace(/[$,]/g, '').trim();
  const num = parseFloat(cleanValue);

  if (isNaN(num)) {
    throw new Error(`Invalid price: ${value}`);
  }

  // Round to 2 decimal places
  return Math.round(num * 100) / 100;
}

function parseDuration(value: any): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const num = parseInt(String(value), 10);

  if (isNaN(num)) {
    throw new Error(`Invalid duration: ${value}`);
  }

  return num;
}

function parseTags(value: any): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(tag => stripHtml(String(tag).trim())).filter(tag => tag.length > 0);
  }

  // Assume comma-separated string
  return String(value)
    .split(',')
    .map(tag => stripHtml(tag.trim()))
    .filter(tag => tag.length > 0)
    .slice(0, 5); // Max 5 tags
}

function parseBoolean(value: any): boolean {
  if (value === undefined || value === null || value === '') {
    return true; // Default to active
  }

  const normalized = String(value).toLowerCase().trim();
  return ['true', '1', 'yes', 'active', 'enabled'].includes(normalized);
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
