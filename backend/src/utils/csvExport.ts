// backend/src/utils/csvExport.ts
import { Response } from 'express';

export interface CSVColumn {
  key: string;
  label: string;
  format?: (value: any) => string;
}

export class CSVExportService {
  /**
   * Convert array of objects to CSV string
   */
  static arrayToCSV<T extends Record<string, any>>(
    data: T[],
    columns: CSVColumn[]
  ): string {
    if (data.length === 0) {
      return '';
    }

    // Header row
    const headers = columns.map(col => this.escapeCSV(col.label));
    const headerRow = headers.join(',');

    // Data rows
    const dataRows = data.map(row => {
      return columns.map(col => {
        const value = row[col.key];
        const formattedValue = col.format ? col.format(value) : value;
        return this.escapeCSV(String(formattedValue ?? ''));
      }).join(',');
    });

    return [headerRow, ...dataRows].join('\n');
  }

  /**
   * Escape CSV values (handle commas, quotes, newlines)
   */
  private static escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Send CSV file as HTTP response
   */
  static sendCSV(
    res: Response,
    data: any[],
    columns: CSVColumn[],
    filename: string
  ): void {
    const csv = this.arrayToCSV(data, columns);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  /**
   * Format number with decimals
   */
  static formatNumber(decimals: number = 2): (value: number) => string {
    return (value: number) => {
      if (value === null || value === undefined) return '';
      return Number(value).toFixed(decimals);
    };
  }

  /**
   * Format date
   */
  static formatDate(value: Date | string): string {
    if (!value) return '';
    const date = new Date(value);
    return date.toISOString().split('T')[0];
  }

  /**
   * Format datetime
   */
  static formatDateTime(value: Date | string): string {
    if (!value) return '';
    const date = new Date(value);
    return date.toISOString().replace('T', ' ').split('.')[0];
  }

  /**
   * Format currency
   */
  static formatCurrency(value: number): string {
    if (value === null || value === undefined) return '';
    return `$${Number(value).toFixed(2)}`;
  }

  /**
   * Format percentage
   */
  static formatPercentage(value: number): string {
    if (value === null || value === undefined) return '';
    return `${Number(value).toFixed(2)}%`;
  }
}
