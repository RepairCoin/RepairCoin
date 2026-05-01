'use client';

import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, FileText, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportCustomers, downloadFile, generateFilename } from '@/services/api/customerImportExport';

interface CustomerExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FileFormat = 'xlsx' | 'csv';

export default function CustomerExportModal({ isOpen, onClose }: CustomerExportModalProps) {
  const [format, setFormat] = useState<FileFormat>('xlsx');
  const [activeOnly, setActiveOnly] = useState(false);
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setExporting(true);

    try {
      toast.loading('Exporting customers...', { id: 'export-customers' });

      const blob = await exportCustomers({
        format,
        activeOnly,
        includeMetadata
      });

      const filename = generateFilename('customers_export', format);
      downloadFile(blob, filename);

      toast.success(`Successfully exported customers to ${filename}`, { id: 'export-customers' });

      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || 'Failed to export customers', { id: 'export-customers' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] rounded-xl max-w-2xl w-full border border-gray-800">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">Export Customers</h2>
            <p className="text-sm text-gray-400 mt-1">Download customer data as Excel or CSV file</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={exporting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* File Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* Excel Format */}
              <button
                onClick={() => setFormat('xlsx')}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  format === 'xlsx'
                    ? 'border-[#FFCC00] bg-[#FFCC00]/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
                disabled={exporting}
              >
                <div className="flex items-center justify-between mb-2">
                  <FileSpreadsheet className="w-6 h-6 text-green-500" />
                  {format === 'xlsx' && (
                    <CheckCircle2 className="w-5 h-5 text-[#FFCC00]" />
                  )}
                </div>
                <div className="text-left">
                  <div className="font-medium text-white">Excel (.xlsx)</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Best for viewing and editing
                  </div>
                </div>
              </button>

              {/* CSV Format */}
              <button
                onClick={() => setFormat('csv')}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  format === 'csv'
                    ? 'border-[#FFCC00] bg-[#FFCC00]/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
                disabled={exporting}
              >
                <div className="flex items-center justify-between mb-2">
                  <FileText className="w-6 h-6 text-blue-500" />
                  {format === 'csv' && (
                    <CheckCircle2 className="w-5 h-5 text-[#FFCC00]" />
                  )}
                </div>
                <div className="text-left">
                  <div className="font-medium text-white">CSV (.csv)</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Universal compatibility
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Export Options */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              Export Options
            </label>

            {/* Active Only Toggle */}
            <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-gray-800">
              <div>
                <div className="text-white font-medium">Active Customers Only</div>
                <div className="text-sm text-gray-400">Export only active customers</div>
              </div>
              <button
                onClick={() => setActiveOnly(!activeOnly)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  activeOnly ? 'bg-[#FFCC00]' : 'bg-gray-700'
                }`}
                disabled={exporting}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    activeOnly ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Include Metadata Toggle */}
            <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-gray-800">
              <div>
                <div className="text-white font-medium">Include Metadata</div>
                <div className="text-sm text-gray-400">Add join date and other metadata</div>
              </div>
              <button
                onClick={() => setIncludeMetadata(!includeMetadata)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  includeMetadata ? 'bg-[#FFCC00]' : 'bg-gray-700'
                }`}
                disabled={exporting}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    includeMetadata ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              The export will include all customers from your shop's order history.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
            disabled={exporting}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-6 py-2 bg-[#FFCC00] text-black font-medium rounded-lg hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export Customers
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
