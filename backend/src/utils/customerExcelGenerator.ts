/**
 * Excel/CSV Generator Utility for Customer Export
 * Handles generation of Excel templates and customer export files
 */

import * as XLSX from 'xlsx';

// Type definitions
export interface Customer {
  address: string;
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
  createdAt?: Date;
}

export interface ExportOptions {
  format: 'xlsx' | 'csv';
  includeMetadata?: boolean;
  includeInactive?: boolean;
}

export interface ExportRow {
  'Wallet Address': string;
  'Name': string;
  'First Name': string;
  'Last Name': string;
  'Email': string;
  'Phone': string;
  'Tier': string;
  'Lifetime Earnings': number | string;
  'Active Status': string;
  'Referral Code': string;
  'Referred By': string;
  // Metadata fields (optional)
  'Join Date'?: string;
}

/**
 * Generate blank customer import template with sample data
 */
export function generateCustomerTemplate(
  format: 'xlsx' | 'csv',
  includeSamples: boolean = true
): Buffer {
  const headers = [
    'Wallet Address',
    'Name',
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Tier',
    'Lifetime Earnings',
    'Active Status',
    'Referral Code',
    'Referred By'
  ];

  const sampleData: any[][] = [];

  if (includeSamples) {
    // Add type hints row
    sampleData.push([
      'Text (Required)',
      'Text (Optional)',
      'Text (Optional)',
      'Text (Optional)',
      'Email (Optional)',
      'Text (Optional)',
      'BRONZE/SILVER/GOLD',
      'Number (Optional)',
      'TRUE/FALSE (Optional)',
      'Text (Optional)',
      'Text (Optional)'
    ]);

    // Add sample data rows
    sampleData.push([
      '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
      'John Doe',
      'John',
      'Doe',
      'john.doe@example.com',
      '+1-555-0100',
      'SILVER',
      250.00,
      'TRUE',
      'JOHN2024',
      ''
    ]);

    sampleData.push([
      '0x8B3c5F7D2E1A9C4B6D8E0F2A5C7E9B1D3F5A7C9E',
      'Jane Smith',
      'Jane',
      'Smith',
      'jane.smith@example.com',
      '+1-555-0200',
      'GOLD',
      500.00,
      'TRUE',
      'JANE2024',
      'JOHN2024'
    ]);

    sampleData.push([
      '0x1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T',
      'Bob Wilson',
      'Bob',
      'Wilson',
      'bob.wilson@example.com',
      '+1-555-0300',
      'BRONZE',
      50.00,
      'TRUE',
      'BOB2024',
      ''
    ]);

    sampleData.push([
      '0x9F8E7D6C5B4A3928171605D4C3B2A1908F7E6D5C',
      'Alice Johnson',
      'Alice',
      'Johnson',
      'alice.j@example.com',
      '',
      'SILVER',
      150.00,
      'TRUE',
      'ALICE2024',
      'JANE2024'
    ]);
  }

  if (format === 'xlsx') {
    return generateExcelTemplate(headers, sampleData);
  } else {
    return generateCSVTemplate(headers, sampleData);
  }
}

/**
 * Generate Excel template with formatting
 */
function generateExcelTemplate(headers: string[], sampleData: any[][]): Buffer {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const wsData = [headers, ...sampleData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 45 }, // Wallet Address
    { wch: 25 }, // Name
    { wch: 20 }, // First Name
    { wch: 20 }, // Last Name
    { wch: 30 }, // Email
    { wch: 18 }, // Phone
    { wch: 15 }, // Tier
    { wch: 18 }, // Lifetime Earnings
    { wch: 15 }, // Active Status
    { wch: 18 }, // Referral Code
    { wch: 20 }  // Referred By
  ];

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  // Add comments/notes to header cells
  const comments: { [key: string]: string } = {
    A1: 'Required: Ethereum wallet address (42 characters starting with 0x)',
    B1: 'Optional: Full name of customer',
    C1: 'Optional: First name',
    D1: 'Optional: Last name',
    E1: 'Optional: Valid email address',
    F1: 'Optional: Phone number (any format)',
    G1: 'Optional: Customer tier - BRONZE (default), SILVER (+2 RCN bonus), or GOLD (+5 RCN bonus)',
    H1: 'Optional: Total RCN earned by customer (default: 0)',
    I1: 'Optional: TRUE or FALSE (default: TRUE)',
    J1: 'Optional: Unique referral code for this customer',
    K1: 'Optional: Referral code or wallet address of who referred this customer'
  };

  for (const [cell, comment] of Object.entries(comments)) {
    if (!ws[cell]) ws[cell] = { v: '', t: 's' };
    ws[cell].c = [{ a: 'System', t: comment }];
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Customers');

  // Write to buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * Generate CSV template
 */
function generateCSVTemplate(headers: string[], sampleData: any[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const wsData = [headers, ...sampleData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  XLSX.utils.book_append_sheet(wb, ws, 'Customers');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'csv' });
  return buffer;
}

/**
 * Generate customer export file from customers
 */
export function generateCustomerExport(
  customers: Customer[],
  options: ExportOptions
): Buffer {
  const rows: ExportRow[] = customers.map(customer => formatCustomerForExport(customer, options));

  if (options.format === 'xlsx') {
    return generateExcelExport(rows, options);
  } else {
    return generateCSVExport(rows);
  }
}

/**
 * Format a single customer for export
 */
export function formatCustomerForExport(
  customer: Customer,
  options: ExportOptions
): ExportRow {
  const row: ExportRow = {
    'Wallet Address': customer.address,
    'Name': customer.name || '',
    'First Name': customer.firstName || '',
    'Last Name': customer.lastName || '',
    'Email': customer.email || '',
    'Phone': customer.phone || '',
    'Tier': customer.tier,
    'Lifetime Earnings': customer.lifetimeEarnings,
    'Active Status': customer.active ? 'TRUE' : 'FALSE',
    'Referral Code': customer.referralCode || '',
    'Referred By': customer.referredBy || ''
  };

  // Add metadata fields if requested
  if (options.includeMetadata) {
    row['Join Date'] = customer.createdAt ? customer.createdAt.toISOString().split('T')[0] : '';
  }

  return row;
}

/**
 * Generate Excel export file
 */
function generateExcelExport(rows: ExportRow[], options: ExportOptions): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  const colWidths: any[] = [
    { wch: 45 }, // Wallet Address
    { wch: 25 }, // Name
    { wch: 20 }, // First Name
    { wch: 20 }, // Last Name
    { wch: 30 }, // Email
    { wch: 18 }, // Phone
    { wch: 15 }, // Tier
    { wch: 18 }, // Lifetime Earnings
    { wch: 15 }, // Active Status
    { wch: 18 }, // Referral Code
    { wch: 20 }  // Referred By
  ];

  if (options.includeMetadata) {
    colWidths.push({ wch: 15 }); // Join Date
  }

  ws['!cols'] = colWidths;

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, 'Customers');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * Generate CSV export file
 */
function generateCSVExport(rows: ExportRow[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  XLSX.utils.book_append_sheet(wb, ws, 'Customers');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'csv' });
  return buffer;
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(prefix: string, format: 'xlsx' | 'csv'): string {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${prefix}_${dateStr}.${format}`;
}
