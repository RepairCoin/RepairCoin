"use client";

import React, { useState } from "react";
import { X, Download, FileText, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { ExportOptions } from "@/types/import";
import { SERVICE_CATEGORIES } from "@/services/api/services";
import { exportServices, downloadFile, generateFilename } from "@/services/api/serviceImportExport";

interface ServiceExportModalProps {
  onClose: () => void;
}

export const ServiceExportModal: React.FC<ServiceExportModalProps> = ({ onClose }) => {
  const [exporting, setExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'xlsx',
    activeOnly: false,
    category: undefined,
    includeMetadata: false,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportServices(exportOptions);

      const extension = exportOptions.format === 'xlsx' ? 'xlsx' : 'csv';
      const filename = generateFilename('services_export', extension);

      downloadFile(blob, filename);

      toast.success('Services exported successfully!', {
        icon: '📥',
        duration: 3000,
      });

      onClose();
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || 'Failed to export services');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] rounded-2xl shadow-2xl w-full max-w-md border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FFCC00]/10 rounded-lg">
              <Download className="h-5 w-5 text-[#FFCC00]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Export Services</h2>
              <p className="text-sm text-gray-400 mt-0.5">Download your services data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* File Format Selection */}
          <div>
            <label className="block text-sm font-semibold text-white mb-3">
              File Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportOptions({ ...exportOptions, format: 'xlsx' })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  exportOptions.format === 'xlsx'
                    ? 'border-[#FFCC00] bg-[#FFCC00]/5'
                    : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                }`}
              >
                <FileSpreadsheet className={`h-5 w-5 ${
                  exportOptions.format === 'xlsx' ? 'text-[#FFCC00]' : 'text-gray-400'
                }`} />
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold text-white">Excel</div>
                  <div className="text-xs text-gray-400">.xlsx</div>
                </div>
                {exportOptions.format === 'xlsx' && (
                  <CheckCircle2 className="h-4 w-4 text-[#FFCC00]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setExportOptions({ ...exportOptions, format: 'csv' })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  exportOptions.format === 'csv'
                    ? 'border-[#FFCC00] bg-[#FFCC00]/5'
                    : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                }`}
              >
                <FileText className={`h-5 w-5 ${
                  exportOptions.format === 'csv' ? 'text-[#FFCC00]' : 'text-gray-400'
                }`} />
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold text-white">CSV</div>
                  <div className="text-xs text-gray-400">.csv</div>
                </div>
                {exportOptions.format === 'csv' && (
                  <CheckCircle2 className="h-4 w-4 text-[#FFCC00]" />
                )}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-white mb-3">
              Filter Options
            </label>

            {/* Active Only Toggle */}
            <label className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-700 cursor-pointer hover:bg-gray-800/50 transition-colors">
              <div className="flex-1">
                <div className="text-sm font-medium text-white">Active services only</div>
                <div className="text-xs text-gray-400 mt-1">Exclude inactive services from export</div>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={exportOptions.activeOnly}
                  onChange={(e) =>
                    setExportOptions({ ...exportOptions, activeOnly: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#FFCC00]/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
              </div>
            </label>

            {/* Include Metadata Toggle */}
            <label className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-700 cursor-pointer hover:bg-gray-800/50 transition-colors">
              <div className="flex-1">
                <div className="text-sm font-medium text-white">Include metadata</div>
                <div className="text-xs text-gray-400 mt-1">Include ratings, reviews, and group info</div>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={exportOptions.includeMetadata}
                  onChange={(e) =>
                    setExportOptions({ ...exportOptions, includeMetadata: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#FFCC00]/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
              </div>
            </label>

            {/* Category Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Filter by category (optional)
              </label>
              <select
                value={exportOptions.category || ''}
                onChange={(e) =>
                  setExportOptions({
                    ...exportOptions,
                    category: e.target.value || undefined,
                  })
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
              >
                <option value="">All categories</option>
                {SERVICE_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-400 mb-1">Export Information</h4>
                <p className="text-xs text-blue-300/80">
                  Your services will be downloaded as a {exportOptions.format.toUpperCase()} file.
                  You can open this file in Excel, Google Sheets, or any spreadsheet application.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-800 bg-gray-900/30">
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-700 text-white font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 px-4 py-3 rounded-xl bg-[#FFCC00] text-black font-semibold hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {exporting ? (
              <>
                <div className="h-4 w-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export Services
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
