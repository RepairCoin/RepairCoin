/**
 * Excel/CSV Generator Utility for Service Export
 * Handles generation of Excel templates and service export files
 */

import * as XLSX from 'xlsx';

// Import ShopService type from repository
export interface ShopService {
  serviceId: string;
  shopId: string;
  serviceName: string;
  description?: string;
  priceUsd: number;
  durationMinutes?: number;
  category: string;
  imageUrl?: string;
  tags?: string[];
  active: boolean;
  avgRating?: number;
  reviewCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ExportOptions {
  format: 'xlsx' | 'csv';
  includeMetadata?: boolean;
  includeInactive?: boolean;
}

export interface ExportRow {
  'Service Name': string;
  'Description': string;
  'Price (USD)': number;
  'Duration (Minutes)': number | string;
  'Category': string;
  'Image URL': string;
  'Tags': string;
  'Active Status': string;
  // Metadata fields (optional)
  'Average Rating'?: number | string;
  'Review Count'?: number | string;
  'Created Date'?: string;
}

/**
 * Generate blank service import template with sample data
 */
export function generateServiceTemplate(
  format: 'xlsx' | 'csv',
  includeSamples: boolean = true
): Buffer {
  const headers = [
    'Service Name',
    'Description',
    'Price (USD)',
    'Duration (Minutes)',
    'Category',
    'Image URL',
    'Tags',
    'Active Status'
  ];

  const sampleData: any[][] = [];

  if (includeSamples) {
    // Add type hints row
    sampleData.push([
      'Text (Required)',
      'Text (Optional)',
      'Number (Required)',
      'Number (Optional)',
      'Text (Required)',
      'URL (Optional)',
      'Comma-separated (Optional)',
      'TRUE/FALSE (Optional)'
    ]);

    // Add sample data rows
    sampleData.push([
      'Oil Change - Full Synthetic',
      'Complete oil change service with premium synthetic oil and filter replacement',
      89.99,
      45,
      'repairs',
      'https://example.com/images/oil-change.jpg',
      'synthetic, premium, eco-friendly',
      'TRUE'
    ]);

    sampleData.push([
      'Brake Pad Replacement',
      'Replace front or rear brake pads with high-quality components',
      149.99,
      60,
      'repairs',
      '',
      'brakes, safety',
      'TRUE'
    ]);

    sampleData.push([
      'Tire Rotation',
      '4-tire rotation and balancing service',
      29.99,
      30,
      'repairs',
      '',
      'maintenance, tires',
      'TRUE'
    ]);

    sampleData.push([
      'Engine Diagnostic',
      'Comprehensive engine diagnostic scan using professional equipment',
      79.99,
      60,
      'repairs',
      '',
      'diagnostic, check-engine',
      'TRUE'
    ]);

    sampleData.push([
      'Basic Car Wash',
      'Exterior wash, tire shine, and interior vacuum',
      25.00,
      20,
      'beauty_personal_care',
      '',
      'wash, detailing',
      'TRUE'
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
    { wch: 30 }, // Service Name
    { wch: 50 }, // Description
    { wch: 12 }, // Price (USD)
    { wch: 18 }, // Duration (Minutes)
    { wch: 20 }, // Category
    { wch: 40 }, // Image URL
    { wch: 30 }, // Tags
    { wch: 15 }  // Active Status
  ];

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  // Add comments/notes to header cells
  const comments: { [key: string]: string } = {
    A1: 'Required: Name of the service (max 100 characters)',
    B1: 'Optional: Detailed description of the service',
    C1: 'Required: Price in USD (must be greater than 0)',
    D1: 'Optional: Service duration in minutes (1-1440)',
    E1: 'Required: Category - must be one of the predefined categories',
    F1: 'Optional: Full URL to service image (http:// or https://)',
    G1: 'Optional: Comma-separated tags (max 5 tags, each max 20 chars)',
    H1: 'Optional: TRUE or FALSE (default: TRUE)'
  };

  for (const [cell, comment] of Object.entries(comments)) {
    if (!ws[cell]) ws[cell] = { v: '', t: 's' };
    ws[cell].c = [{ a: 'System', t: comment }];
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Services');

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

  XLSX.utils.book_append_sheet(wb, ws, 'Services');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'csv' });
  return buffer;
}

/**
 * Generate service export file from shop services
 */
export function generateServiceExport(
  services: ShopService[],
  options: ExportOptions
): Buffer {
  const rows: ExportRow[] = services.map(service => formatServiceForExport(service, options));

  if (options.format === 'xlsx') {
    return generateExcelExport(rows, options);
  } else {
    return generateCSVExport(rows);
  }
}

/**
 * Format a single service for export
 */
export function formatServiceForExport(
  service: ShopService,
  options: ExportOptions
): ExportRow {
  const row: ExportRow = {
    'Service Name': service.serviceName,
    'Description': service.description || '',
    'Price (USD)': service.priceUsd,
    'Duration (Minutes)': service.durationMinutes !== undefined ? service.durationMinutes : '',
    'Category': service.category,
    'Image URL': service.imageUrl || '',
    'Tags': service.tags ? service.tags.join(', ') : '',
    'Active Status': service.active ? 'TRUE' : 'FALSE'
  };

  // Add metadata fields if requested
  if (options.includeMetadata) {
    row['Average Rating'] = service.avgRating !== undefined ? service.avgRating : '';
    row['Review Count'] = service.reviewCount !== undefined ? service.reviewCount : '';
    row['Created Date'] = service.createdAt ? service.createdAt.toISOString().split('T')[0] : '';
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
    { wch: 30 }, // Service Name
    { wch: 50 }, // Description
    { wch: 12 }, // Price (USD)
    { wch: 18 }, // Duration (Minutes)
    { wch: 20 }, // Category
    { wch: 40 }, // Image URL
    { wch: 30 }, // Tags
    { wch: 15 }  // Active Status
  ];

  if (options.includeMetadata) {
    colWidths.push(
      { wch: 15 }, // Average Rating
      { wch: 15 }, // Review Count
      { wch: 15 }  // Created Date
    );
  }

  ws['!cols'] = colWidths;

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, 'Services');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * Generate CSV export file
 */
function generateCSVExport(rows: ExportRow[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  XLSX.utils.book_append_sheet(wb, ws, 'Services');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'csv' });
  return buffer;
}

/**
 * Get valid service categories (for template generation)
 */
export function getServiceCategories(): string[] {
  return [
    'repairs',
    'beauty_personal_care',
    'health_wellness',
    'fitness_gyms',
    'automotive_services',
    'home_cleaning_services',
    'pets_animal_care',
    'professional_services',
    'education_classes',
    'tech_it_services',
    'food_beverage',
    'other_local_services'
  ];
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(prefix: string, format: 'xlsx' | 'csv'): string {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${prefix}_${dateStr}.${format}`;
}
