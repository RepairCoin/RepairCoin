import apiClient from './client';
import { ImportResult, ImportJobStatus, ExportOptions, ImportOptions } from '@/types/import';

// ==================== EXPORT APIs ====================

/**
 * Export shop services to Excel or CSV
 */
export const exportServices = async (options: ExportOptions): Promise<Blob> => {
  try {
    const params = new URLSearchParams();
    params.append('format', options.format);
    if (options.activeOnly !== undefined) {
      params.append('activeOnly', String(options.activeOnly));
    }
    if (options.category) {
      params.append('category', options.category);
    }
    if (options.includeMetadata !== undefined) {
      params.append('includeMetadata', String(options.includeMetadata));
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/services/export?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return await response.blob();
  } catch (error) {
    console.error('Error exporting services:', error);
    throw error;
  }
};

/**
 * Download service import template
 */
export const downloadTemplate = async (format: 'xlsx' | 'csv' = 'xlsx'): Promise<Blob> => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/services/template?format=${format}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
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
 * Import services from Excel or CSV file
 */
export const importServices = async (
  file: File,
  options: ImportOptions
): Promise<ImportResult> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', options.mode);
    formData.append('dryRun', String(options.dryRun));
    if (options.onDuplicateName) {
      formData.append('onDuplicateName', options.onDuplicateName);
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/services/import`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Import failed');
    }

    return data;
  } catch (error) {
    console.error('Error importing services:', error);
    throw error;
  }
};

/**
 * Get import job status
 */
export const getImportStatus = async (jobId: string): Promise<ImportJobStatus> => {
  try {
    const response = await apiClient.get<ImportJobStatus>(`/services/import/${jobId}`);
    return response.data || response as unknown as ImportJobStatus;
  } catch (error) {
    console.error('Error getting import status:', error);
    throw error;
  }
};

/**
 * Send test email with import preview
 */
export const sendTestImport = async (
  file: File,
  recipientEmail: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('recipientEmail', recipientEmail);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/services/import/test`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Test import failed');
    }

    return data;
  } catch (error) {
    console.error('Error sending test import:', error);
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

export const serviceImportExportApi = {
  exportServices,
  downloadTemplate,
  importServices,
  getImportStatus,
  sendTestImport,
  downloadFile,
  generateFilename,
} as const;
