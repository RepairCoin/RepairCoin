/**
 * File Upload Middleware
 * Handles file uploads for import operations using Multer
 */

import multer from 'multer';
import path from 'path';

// File size limit: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv', // .csv
  'application/csv'
];

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

/**
 * File filter function for Multer
 */
const fileFilter = (req: any, file: any, cb: multer.FileFilterCallback) => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only .xlsx, .xls, and .csv files are allowed.'));
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error('Invalid file extension. Only .xlsx, .xls, and .csv files are allowed.'));
  }

  cb(null, true);
};

/**
 * Multer configuration for file uploads
 * Uses memory storage to keep files in memory as buffers
 */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE, // 10MB
    files: 1, // Only one file at a time
    fields: 10, // Max form fields
    parts: 15 // Max multipart parts
  },
  fileFilter: fileFilter
});

/**
 * Validate file signature (magic number)
 * Prevents file type spoofing (e.g., .exe renamed to .xlsx)
 */
export function validateFileSignature(buffer: Buffer, filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();

  // Excel (.xlsx) starts with PK (ZIP file signature: 50 4B 03 04)
  if (ext === '.xlsx') {
    return buffer[0] === 0x50 && buffer[1] === 0x4B;
  }

  // Old Excel (.xls) starts with D0 CF 11 E0 A1 B1 1A E1
  if (ext === '.xls') {
    return buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;
  }

  // CSV is plain text - check for reasonable ASCII characters
  if (ext === '.csv') {
    const sample = buffer.slice(0, 100).toString('utf8');
    // Should contain only printable characters, tabs, newlines
    return /^[\x09\x0A\x0D\x20-\x7E]*$/.test(sample);
  }

  return false;
}

/**
 * Get file type from extension
 */
export function getFileType(filename: string): 'xlsx' | 'xls' | 'csv' | null {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.xlsx') return 'xlsx';
  if (ext === '.xls') return 'xls';
  if (ext === '.csv') return 'csv';

  return null;
}
