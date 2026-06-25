'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileSpreadsheet, FileText, CheckCircle2, AlertCircle, Download, Info, Sparkles, Loader2, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { importCustomers, suggestImportMapping, downloadTemplate, downloadFile, generateFilename } from '@/services/api/customerImportExport';
import { getAdminShops } from '@/services/api/admin';
import { ImportResult, ImportMode } from '@/types/import';

// Target fields the user can map source columns onto (label → our field name).
const MAPPABLE_FIELDS: { field: string; label: string }[] = [
  { field: 'firstName', label: 'First name' },
  { field: 'lastName', label: 'Last name' },
  { field: 'name', label: 'Full name' },
  { field: 'email', label: 'Email' },
  { field: 'phone', label: 'Phone' },
  { field: 'marketingEmailConsent', label: 'Email consent' },
  { field: 'lifetimeSpendUsd', label: 'Lifetime spend ($)' },
  { field: 'firstVisitAt', label: 'First visit' },
  { field: 'lastVisitAt', label: 'Last visit' },
  { field: 'visitCount', label: 'Visit count' },
  { field: 'externalRef', label: 'Source customer ID' },
  { field: 'tier', label: 'Tier' },
  { field: 'walletAddress', label: 'Wallet (optional)' },
];

interface CustomerImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type ViewState = 'upload' | 'validating' | 'results';

export default function CustomerImportModal({ isOpen, onClose, onImportComplete }: CustomerImportModalProps) {
  const [viewState, setViewState] = useState<ViewState>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('add');
  const [dryRun, setDryRun] = useState(true);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  // AI column-mapping (Phase 2)
  const [mappingHeaders, setMappingHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mappingNotes, setMappingNotes] = useState<string>('');
  const [suggesting, setSuggesting] = useState(false);
  // Target shop: imported customers are stamped onto this shop's home_shop_id (admin picks it).
  const [shops, setShops] = useState<{ shopId: string; name: string }[]>([]);
  const [homeShopId, setHomeShopId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    getAdminShops({ active: true } as any)
      .then((list: any[]) => setShops((list || []).map((s) => ({ shopId: s.shopId || s.shop_id, name: s.name }))))
      .catch(() => setShops([]));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSuggestMapping = async () => {
    if (!selectedFile) return;
    setSuggesting(true);
    try {
      toast.loading('Reading your file…', { id: 'suggest-map' });
      const res = await suggestImportMapping(selectedFile);
      setMappingHeaders(res.headers);
      setMapping(res.mapping || {});
      setMappingNotes(res.notes || '');
      toast.success('Mapping suggested — review & adjust below.', { id: 'suggest-map' });
    } catch (e: any) {
      toast.error(e.message || 'Could not suggest a mapping', { id: 'suggest-map' });
    } finally {
      setSuggesting(false);
    }
  };

  const importExtra = () => ({
    columnMapping: Object.keys(mapping).length ? mapping : undefined,
    source: 'import',
    homeShopId: homeShopId || undefined,
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv'
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Invalid file type. Please upload .xlsx, .xls, or .csv files only.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit.');
      return;
    }

    setSelectedFile(file);
    toast.success(`File selected: ${file.name}`);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to import');
      return;
    }

    setImporting(true);
    setViewState('validating');

    try {
      toast.loading('Processing import...', { id: 'import-customers' });

      const result = await importCustomers(selectedFile, {
        mode: importMode,
        dryRun,
        onDuplicateName: 'skip'
      }, importExtra());

      setImportResult(result);
      setViewState('results');

      if (result.success) {
        if (dryRun) {
          toast.success(`Validation successful! ${result.summary.validRows} customers ready to import.`, {
            id: 'import-customers'
          });
        } else {
          toast.success(`Successfully imported ${result.summary.imported} customers!`, {
            id: 'import-customers'
          });

          if (onImportComplete) {
            onImportComplete();
          }

          // Close modal after delay if import was successful
          setTimeout(() => {
            handleClose();
          }, 2000);
        }
      } else {
        toast.error(`Import failed: ${result.summary.invalidRows} errors found`, {
          id: 'import-customers'
        });
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import customers', { id: 'import-customers' });
      setViewState('upload');
    } finally {
      setImporting(false);
    }
  };

  const handleProceedWithImport = async () => {
    if (!selectedFile) return;

    setDryRun(false);
    setViewState('validating');
    setImporting(true);

    try {
      toast.loading('Importing customers...', { id: 'import-actual' });

      const result = await importCustomers(selectedFile, {
        mode: importMode,
        dryRun: false,
        onDuplicateName: 'skip'
      }, importExtra());

      setImportResult(result);
      setViewState('results');

      if (result.success) {
        toast.success(`Successfully imported ${result.summary.imported} customers!`, {
          id: 'import-actual'
        });

        if (onImportComplete) {
          onImportComplete();
        }

        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        toast.error('Import failed', { id: 'import-actual' });
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import customers', { id: 'import-actual' });
    } finally {
      setImporting(false);
    }
  };

  const resetMapping = () => { setMapping({}); setMappingHeaders([]); setMappingNotes(''); };

  const handleTryAgain = () => {
    setViewState('upload');
    setSelectedFile(null);
    setImportResult(null);
    setDryRun(true);
    resetMapping();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    setViewState('upload');
    setSelectedFile(null);
    setImportResult(null);
    setDryRun(true);
    setImportMode('add');
    setHomeShopId('');
    resetMapping();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleDownloadTemplate = async (format: 'xlsx' | 'csv') => {
    try {
      toast.loading(`Downloading ${format.toUpperCase()} template...`, { id: 'download-template' });

      const blob = await downloadTemplate(format);
      const filename = `customer_import_template.${format}`;
      downloadFile(blob, filename);

      toast.success(`Template downloaded: ${filename}`, { id: 'download-template' });
    } catch (error: any) {
      console.error('Template download error:', error);
      toast.error('Failed to download template', { id: 'download-template' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#1A1A1A] rounded-xl max-w-4xl w-full border border-gray-800 my-8">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">Import Customers</h2>
            <p className="text-sm text-gray-400 mt-1">
              {viewState === 'upload' && 'Upload Excel or CSV file with customer data'}
              {viewState === 'validating' && 'Processing your import...'}
              {viewState === 'results' && 'Import Results'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={importing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Upload View */}
          {viewState === 'upload' && (
            <div className="space-y-6">
              {/* Target shop — imported customers are attributed to this shop (home_shop_id) */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <Store className="w-4 h-4 text-[#FFCC00]" /> Import into shop
                </label>
                <select
                  value={homeShopId}
                  onChange={(e) => setHomeShopId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#101010] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00]"
                >
                  <option value="">— Select the shop these customers belong to —</option>
                  {shops.map((s) => <option key={s.shopId} value={s.shopId}>{s.name} ({s.shopId})</option>)}
                </select>
                <p className={`text-xs mt-1 ${homeShopId ? 'text-gray-500' : 'text-amber-400'}`}>
                  {homeShopId
                    ? 'Imported customers will be attributed to this shop (their home shop).'
                    : '⚠ Pick a shop, or imported customers won’t be attributed to any shop (orphaned/global).'}
                </p>
              </div>

              {/* Template Download Section */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-blue-300 mb-3">
                      First time importing? Download our template to see the required format.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownloadTemplate('xlsx')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        Download Excel Template
                      </button>
                      <button
                        onClick={() => handleDownloadTemplate('csv')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Download CSV Template
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Upload File
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? 'border-[#FFCC00] bg-[#FFCC00]/10'
                      : selectedFile
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />

                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                      <div className="text-left">
                        <div className="text-white font-medium">{selectedFile.name}</div>
                        <div className="text-sm text-gray-400">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="ml-4 text-red-500 hover:text-red-400"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                      <p className="text-gray-300 mb-2">
                        Drag and drop your file here, or{' '}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[#FFCC00] hover:underline"
                        >
                          browse
                        </button>
                      </p>
                      <p className="text-sm text-gray-500">
                        Supports .xlsx, .xls, and .csv files (max 10MB, up to 50,000 rows — no wallet column required)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* AI column mapping (Phase 2) — appears once a file is chosen */}
              {selectedFile && (
                <div className="bg-[#101010] border border-gray-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#FFCC00]" />
                      <span className="text-sm font-medium text-gray-200">Column mapping</span>
                      <span className="text-xs text-gray-500">— match your file&apos;s columns to ours</span>
                    </div>
                    <button
                      onClick={handleSuggestMapping}
                      disabled={suggesting}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#FFCC00]/10 text-[#FFCC00] hover:bg-[#FFCC00]/20 disabled:opacity-50"
                    >
                      {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {mappingHeaders.length ? 'Re-suggest with AI' : 'Suggest mapping with AI'}
                    </button>
                  </div>
                  {mappingNotes && <p className="text-[11px] text-gray-500 italic">{mappingNotes}</p>}
                  {mappingHeaders.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {MAPPABLE_FIELDS.map(({ field, label }) => (
                        <div key={field} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-32 shrink-0">{label}</span>
                          <select
                            value={mapping[field] || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setMapping((prev) => {
                                const next = { ...prev };
                                if (v) next[field] = v; else delete next[field];
                                return next;
                              });
                            }}
                            className="flex-1 px-2 py-1.5 bg-[#0F0F0F] border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-[#FFCC00]"
                          >
                            <option value="">— ignore —</option>
                            {mappingHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Optional. Click <span className="text-[#FFCC00]">Suggest mapping with AI</span> to auto-map a Square (or other) export — or skip and we&apos;ll auto-detect common column names.
                    </p>
                  )}
                </div>
              )}

              {/* Import Mode Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Import Mode
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => setImportMode('add')}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      importMode === 'add'
                        ? 'border-[#FFCC00] bg-[#FFCC00]/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">Add Only</div>
                        <div className="text-sm text-gray-400">Import new customers, skip duplicates</div>
                      </div>
                      {importMode === 'add' && <CheckCircle2 className="w-5 h-5 text-[#FFCC00]" />}
                    </div>
                  </button>

                  <button
                    onClick={() => setImportMode('merge')}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      importMode === 'merge'
                        ? 'border-[#FFCC00] bg-[#FFCC00]/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">Merge</div>
                        <div className="text-sm text-gray-400">Update existing customers and add new ones</div>
                      </div>
                      {importMode === 'merge' && <CheckCircle2 className="w-5 h-5 text-[#FFCC00]" />}
                    </div>
                  </button>
                </div>
              </div>

              {/* Dry Run Toggle */}
              <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-gray-800">
                <div>
                  <div className="text-white font-medium">Dry Run (Recommended)</div>
                  <div className="text-sm text-gray-400">Validate data without importing</div>
                </div>
                <button
                  onClick={() => setDryRun(!dryRun)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    dryRun ? 'bg-[#FFCC00]' : 'bg-gray-700'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      dryRun ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Validating View */}
          {viewState === 'validating' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 border-4 border-[#FFCC00] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-white text-lg font-medium">Processing Import...</p>
              <p className="text-gray-400 text-sm mt-2">This may take a moment</p>
            </div>
          )}

          {/* Results View */}
          {viewState === 'results' && importResult && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#101010] p-4 rounded-lg border border-gray-800">
                  <div className="text-2xl font-bold text-white">{importResult.summary.totalRows}</div>
                  <div className="text-sm text-gray-400">Total Rows</div>
                </div>
                <div className="bg-[#101010] p-4 rounded-lg border border-green-500/20">
                  <div className="text-2xl font-bold text-green-500">{importResult.summary.validRows}</div>
                  <div className="text-sm text-gray-400">Valid</div>
                </div>
                <div className="bg-[#101010] p-4 rounded-lg border border-red-500/20">
                  <div className="text-2xl font-bold text-red-500">{importResult.summary.invalidRows}</div>
                  <div className="text-sm text-gray-400">Errors</div>
                </div>
                <div className="bg-[#101010] p-4 rounded-lg border border-blue-500/20">
                  <div className="text-2xl font-bold text-blue-500">{importResult.summary.imported}</div>
                  <div className="text-sm text-gray-400">Imported</div>
                </div>
              </div>

              {/* Errors Table */}
              {importResult.errors.length > 0 && (
                <div>
                  <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    Errors ({importResult.errors.length})
                  </h3>
                  <div className="bg-[#101010] rounded-lg border border-gray-800 overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full">
                        <thead className="bg-gray-900 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-400">Row</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-400">Column</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-400">Message</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.errors.slice(0, 50).map((error, index) => (
                            <tr key={index} className="border-t border-gray-800">
                              <td className="px-4 py-2 text-sm text-white">{error.row}</td>
                              <td className="px-4 py-2 text-sm text-gray-400">{error.column}</td>
                              <td className="px-4 py-2 text-sm text-red-400">{error.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importResult.errors.length > 50 && (
                        <div className="p-4 text-center text-sm text-gray-400">
                          Showing first 50 of {importResult.errors.length} errors
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {importResult.warnings.length > 0 && (
                <div>
                  <h3 className="text-white font-medium mb-3">
                    Warnings ({importResult.warnings.length})
                  </h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {importResult.warnings.slice(0, 10).map((warning, index) => (
                      <div key={index} className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 text-sm text-yellow-300">
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
        <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
          {viewState === 'upload' && (
            <>
              <button
                onClick={handleClose}
                className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
                disabled={importing}
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!selectedFile || importing}
                className="px-6 py-2 bg-[#FFCC00] text-black font-medium rounded-lg hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {dryRun ? 'Validate Import' : 'Import Now'}
                  </>
                )}
              </button>
            </>
          )}

          {viewState === 'results' && importResult && (
            <>
              <button
                onClick={handleTryAgain}
                className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Try Again
              </button>
              {dryRun && importResult.success && (
                <button
                  onClick={handleProceedWithImport}
                  disabled={importing}
                  className="px-6 py-2 bg-[#FFCC00] text-black font-medium rounded-lg hover:bg-[#FFD700] transition-colors disabled:opacity-50"
                >
                  Proceed with Import
                </button>
              )}
              {!dryRun && (
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-[#FFCC00] text-black font-medium rounded-lg hover:bg-[#FFD700] transition-colors"
                >
                  Close
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
