"use client";

import React, { useState, useRef, useCallback } from "react";
import { X, Upload, FileSpreadsheet, FileText, Download, AlertCircle, CheckCircle2, AlertTriangle, FileDown } from "lucide-react";
import { toast } from "react-hot-toast";
import { ImportMode, ImportResult } from "@/types/import";
import { importServices, downloadTemplate, downloadFile, generateFilename } from "@/services/api/serviceImportExport";

interface ServiceImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type ViewState = 'upload' | 'validating' | 'results' | 'success';

export const ServiceImportModal: React.FC<ServiceImportModalProps> = ({ onClose, onSuccess }) => {
  const [viewState, setViewState] = useState<ViewState>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('add');
  const [dryRun, setDryRun] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelection = (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(extension)) {
      toast.error('Invalid file type. Please upload .xlsx, .xls, or .csv file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit');
      return;
    }

    setSelectedFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setImporting(true);
    setViewState('validating');

    try {
      const result = await importServices(selectedFile, {
        mode: importMode,
        dryRun,
        onDuplicateName: 'skip',
      });

      setImportResult(result);
      setViewState('results');

      if (result.success) {
        if (dryRun) {
          toast.success(`Validation successful! ${result.summary.validRows} rows ready to import`, {
            icon: '✅',
          });
        } else {
          toast.success(`Successfully imported ${result.summary.imported} services!`, {
            icon: '🎉',
          });
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        }
      } else {
        toast.error(`Import failed: ${result.summary.invalidRows} validation errors found`, {
          icon: '❌',
        });
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import services');
      setViewState('upload');
    } finally {
      setImporting(false);
    }
  };

  const handleTemplateDownload = async (format: 'xlsx' | 'csv') => {
    try {
      const blob = await downloadTemplate(format);
      const filename = `service_import_template.${format}`;
      downloadFile(blob, filename);
      toast.success('Template downloaded successfully!', { icon: '📥' });
    } catch (error: any) {
      console.error('Template download error:', error);
      toast.error(error.message || 'Failed to download template');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] rounded-2xl shadow-2xl w-full max-w-3xl border border-gray-800 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FFCC00]/10 rounded-lg">
              <Upload className="h-5 w-5 text-[#FFCC00]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Import Services</h2>
              <p className="text-sm text-gray-400 mt-0.5">Upload services from Excel or CSV</p>
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
        <div className="flex-1 overflow-y-auto p-6">
          {viewState === 'upload' && (
            <div className="space-y-6">
              {/* Template Download */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <FileDown className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-400 mb-2">Download Template First</h4>
                    <p className="text-xs text-blue-300/80 mb-3">
                      Start with our template to ensure your data is formatted correctly.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTemplateDownload('xlsx')}
                        className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Excel Template
                      </button>
                      <button
                        onClick={() => handleTemplateDownload('csv')}
                        className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        CSV Template
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-semibold text-white mb-3">
                  Upload File
                </label>
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${
                    dragActive
                      ? 'border-[#FFCC00] bg-[#FFCC00]/5'
                      : selectedFile
                      ? 'border-green-500 bg-green-500/5'
                      : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileInput}
                    className="hidden"
                  />

                  {selectedFile ? (
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-500/10 rounded-lg">
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-white">{selectedFile.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{formatFileSize(selectedFile.size)}</div>
                      </div>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <X className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-white mb-1">
                        Drag & drop your file here
                      </p>
                      <p className="text-xs text-gray-400 mb-4">
                        or click to browse
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-[#FFCC00] text-black text-sm font-semibold rounded-lg hover:bg-[#FFD700] transition-colors"
                      >
                        Browse Files
                      </button>
                      <p className="text-xs text-gray-500 mt-4">
                        Supported formats: .xlsx, .xls, .csv (Max 10MB, 1000 rows)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Import Mode */}
              <div>
                <label className="block text-sm font-semibold text-white mb-3">
                  Import Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-start p-4 bg-gray-800/30 rounded-xl border-2 cursor-pointer transition-all hover:bg-gray-800/50 ${importMode === 'add' ? 'border-[#FFCC00] bg-[#FFCC00]/5' : 'border-gray-700'}">
                    <input
                      type="radio"
                      name="importMode"
                      value="add"
                      checked={importMode === 'add'}
                      onChange={(e) => setImportMode(e.target.value as ImportMode)}
                      className="mt-1 text-[#FFCC00] focus:ring-[#FFCC00] focus:ring-offset-gray-800"
                    />
                    <div className="ml-3 flex-1">
                      <div className="text-sm font-semibold text-white">Add new services only</div>
                      <div className="text-xs text-gray-400 mt-1">Skip services with duplicate names (safest option)</div>
                    </div>
                  </label>

                  <label className={`flex items-start p-4 bg-gray-800/30 rounded-xl border-2 cursor-pointer transition-all hover:bg-gray-800/50 ${importMode === 'merge' ? 'border-[#FFCC00] bg-[#FFCC00]/5' : 'border-gray-700'}`}>
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={(e) => setImportMode(e.target.value as ImportMode)}
                      className="mt-1 text-[#FFCC00] focus:ring-[#FFCC00] focus:ring-offset-gray-800"
                    />
                    <div className="ml-3 flex-1">
                      <div className="text-sm font-semibold text-white">Merge - Update existing + add new</div>
                      <div className="text-xs text-gray-400 mt-1">Update services by name, add new ones (recommended for updates)</div>
                    </div>
                  </label>

                  <label className={`flex items-start p-4 bg-gray-800/30 rounded-xl border-2 cursor-pointer transition-all hover:bg-gray-800/50 ${importMode === 'replace' ? 'border-[#FFCC00] bg-[#FFCC00]/5' : 'border-gray-700'}`}>
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={(e) => setImportMode(e.target.value as ImportMode)}
                      className="mt-1 text-[#FFCC00] focus:ring-[#FFCC00] focus:ring-offset-gray-800"
                    />
                    <div className="ml-3 flex-1">
                      <div className="text-sm font-semibold text-white flex items-center gap-2">
                        Replace all services
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">Destructive</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Delete all existing services and import new ones (use with caution)</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Dry Run Toggle */}
              <label className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-700 cursor-pointer hover:bg-gray-800/50 transition-colors">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    Dry Run - Validate Only
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Recommended</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Check for errors without importing (you can import after validation)</div>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#FFCC00]/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFCC00]"></div>
                </div>
              </label>
            </div>
          )}

          {viewState === 'validating' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 border-4 border-[#FFCC00]/20 border-t-[#FFCC00] rounded-full animate-spin mb-6" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {dryRun ? 'Validating...' : 'Importing...'}
              </h3>
              <p className="text-sm text-gray-400">
                {dryRun
                  ? 'Checking your file for errors. This should only take a few seconds.'
                  : 'Importing your services. Please wait...'}
              </p>
            </div>
          )}

          {viewState === 'results' && importResult && (
            <div className="space-y-6">
              {/* Summary */}
              <div className={`p-6 rounded-xl border-2 ${
                importResult.success
                  ? 'border-green-500 bg-green-500/5'
                  : 'border-red-500 bg-red-500/5'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${
                    importResult.success ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}>
                    {importResult.success ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-lg font-bold mb-2 ${
                      importResult.success ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {importResult.success
                        ? dryRun
                          ? 'Validation Successful!'
                          : 'Import Successful!'
                        : 'Import Failed'}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Total Rows:</span>
                        <span className="text-white font-semibold ml-2">{importResult.summary.totalRows}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Valid:</span>
                        <span className="text-green-500 font-semibold ml-2">{importResult.summary.validRows}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Errors:</span>
                        <span className="text-red-500 font-semibold ml-2">{importResult.summary.invalidRows}</span>
                      </div>
                      {!dryRun && (
                        <>
                          <div>
                            <span className="text-gray-400">Imported:</span>
                            <span className="text-white font-semibold ml-2">{importResult.summary.imported}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    Errors ({importResult.errors.length})
                  </h4>
                  <div className="bg-gray-800/30 rounded-xl border border-gray-700 overflow-hidden">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-800/50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Row</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Column</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.errors.map((error, index) => (
                            <tr key={index} className="border-t border-gray-700/50">
                              <td className="px-4 py-2 text-white">{error.row}</td>
                              <td className="px-4 py-2 text-gray-400">{error.column}</td>
                              <td className="px-4 py-2 text-red-400 text-xs">{error.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {importResult.warnings.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Warnings ({importResult.warnings.length})
                  </h4>
                  <div className="space-y-2">
                    {importResult.warnings.map((warning, index) => (
                      <div key={index} className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-300">
                        Row {warning.row}: {warning.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-800 bg-gray-900/30">
          {viewState === 'upload' && (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-700 text-white font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!selectedFile || importing}
                className="flex-1 px-4 py-3 rounded-xl bg-[#FFCC00] text-black font-semibold hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="h-4 w-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    {dryRun ? 'Validating...' : 'Importing...'}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {dryRun ? 'Validate Import' : 'Import Now'}
                  </>
                )}
              </button>
            </>
          )}

          {viewState === 'results' && importResult && (
            <>
              <button
                type="button"
                onClick={() => {
                  setViewState('upload');
                  setImportResult(null);
                }}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-700 text-white font-semibold hover:bg-gray-800 transition-colors"
              >
                {importResult.success && dryRun ? 'Back' : 'Try Again'}
              </button>
              {importResult.success && dryRun && (
                <button
                  type="button"
                  onClick={() => {
                    setDryRun(false);
                    setViewState('upload');
                    // Auto-trigger import after setting dryRun to false
                    setTimeout(() => handleImport(), 100);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-[#FFCC00] text-black font-semibold hover:bg-[#FFD700] transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Proceed with Import
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
