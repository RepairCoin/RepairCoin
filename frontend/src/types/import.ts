// Import/Export Types for Services and Customers

export type ImportMode = 'add' | 'merge' | 'replace';

export type ImportStatus = 'processing' | 'completed' | 'failed';

export interface ImportError {
  row: number;
  column: string;
  value: any;
  message: string;
  severity: 'error' | 'warning';
  code: string;
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  imported: number;
  updated: number;
  skipped: number;
  deleted: number;
}

export interface ImportResult {
  success: boolean;
  jobId: string;
  summary: ImportSummary;
  errors: ImportError[];
  warnings: ImportError[];
  metadata: {
    uploadedAt: string;
    uploadedBy: string;
    shopId: string;
    fileName: string;
    fileSize: number;
    processingTime: number;
    mode: ImportMode;
    dryRun: boolean;
  };
  message?: string;
}

export interface ImportJobStatus {
  jobId: string;
  status: ImportStatus;
  progress: number;
  result: ImportResult;
  createdAt: string;
  completedAt?: string;
  processingTime?: number;
}

export interface ExportOptions {
  format: 'xlsx' | 'csv';
  activeOnly?: boolean;
  category?: string;
  includeMetadata?: boolean;
}

export interface ImportOptions {
  mode: ImportMode;
  dryRun: boolean;
  onDuplicateName?: 'skip' | 'update' | 'rename' | 'error';
}
