import apiClient from './client';
import { ImportResult, ImportJobStatus, ExportOptions, ImportOptions } from '@/types/import';

// ==================== EXPORT APIs ====================

/**
 * Export customers to Excel or CSV
 */
export const exportCustomers = async (options: ExportOptions): Promise<Blob> => {
  try {
    const params = new URLSearchParams();
    params.append('format', options.format);
    if (options.activeOnly !== undefined) {
      params.append('activeOnly', String(options.activeOnly));
    }
    if (options.includeMetadata !== undefined) {
      params.append('includeMetadata', String(options.includeMetadata));
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/customers/export?${params.toString()}`,
      {
        method: 'GET',
        credentials: 'include', // Send httpOnly cookies
      }
    );

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return await response.blob();
  } catch (error) {
    console.error('Error exporting customers:', error);
    throw error;
  }
};

/**
 * Download customer import template
 */
export const downloadTemplate = async (format: 'xlsx' | 'csv' = 'xlsx'): Promise<Blob> => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/customers/template?format=${format}`,
      {
        method: 'GET',
        credentials: 'include', // Send httpOnly cookies
      }
    );

    if (!response.ok) {
      throw new Error(`Template download failed: ${response.statusText}`);
    }

    return await response.blob();
  } catch (error) {
    console.error('Error downloading template:', error);
    throw error;
  }
};

// ==================== IMPORT APIs ====================

/**
 * Import customers from Excel or CSV file
 */
export const importCustomers = async (
  file: File,
  options: ImportOptions
): Promise<ImportResult> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', options.mode);
    formData.append('dryRun', String(options.dryRun));
    if (options.onDuplicateName) {
      formData.append('onDuplicateWallet', options.onDuplicateName);
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/customers/import`,
      {
        method: 'POST',
        credentials: 'include', // Send httpOnly cookies
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Import failed');
    }

    return data;
  } catch (error) {
    console.error('Error importing customers:', error);
    throw error;
  }
};

/**
 * Get import job status
 */
export const getImportStatus = async (jobId: string): Promise<ImportJobStatus> => {
  try {
    const response = await apiClient.get<ImportJobStatus>(`/customers/import/${jobId}`);
    return response.data || response as unknown as ImportJobStatus;
  } catch (error) {
    console.error('Error getting import status:', error);
    throw error;
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Trigger file download from blob
 */
export const downloadFile = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Generate filename with timestamp
 */
export const generateFilename = (prefix: string, extension: string): string => {
  const now = new Date();
  const timestamp = now.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${prefix}_${timestamp}.${extension}`;
};

// ==================== NAMESPACE EXPORT ====================

export const customerImportExportApi = {
  exportCustomers,
  downloadTemplate,
  importCustomers,
  getImportStatus,
  downloadFile,
  generateFilename,
} as const;
