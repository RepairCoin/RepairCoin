"use client";

import React, { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  Upload,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import apiClient from "@/services/api/client";

interface ContactImportModalProps {
  open: boolean;
  onClose: (imported: boolean) => void;
  shopId: string;
}

interface ImportContact {
  fullName: string;
  email?: string;
  phone?: string;
  tags?: string[];
  notes?: string;
}

// A row-level problem surfaced during the validation phase
interface RowIssue {
  row: number;
  column: string;
  message: string;
}

interface ValidationResult {
  totalRows: number;
  validContacts: ImportContact[];
  errors: RowIssue[];
  warnings: RowIssue[];
}

// Result returned by the backend after the real import
interface ImportResult {
  created: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

type ViewState = "upload" | "review" | "importing" | "done";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_HEADERS = ["fullname", "name", "full_name"];

export function ContactImportModal({
  open,
  onClose,
  shopId,
}: ContactImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [viewState, setViewState] = useState<ViewState>("upload");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

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
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "text/csv" || droppedFile.name.endsWith(".csv")) {
        setFile(droppedFile);
      } else {
        toast.error("Please upload a CSV file");
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Parse + validate the CSV client-side. Each data row is checked against the
  // same rules the backend expects (name required, at least one contact method,
  // well-formed email) plus in-file duplicate detection. Invalid rows are kept
  // out of validContacts but reported so the user can fix them before importing.
  const validateCsv = (csvText: string): ValidationResult => {
    const errors: RowIssue[] = [];
    const warnings: RowIssue[] = [];
    const validContacts: ImportContact[] = [];

    const lines = csvText.split("\n").filter((line) => line.trim());
    if (lines.length === 0) {
      return { totalRows: 0, validContacts, errors, warnings };
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const hasNameColumn = headers.some((h) => NAME_HEADERS.includes(h));
    const hasContactColumn =
      headers.includes("email") || headers.includes("phone");

    // Structural problems with the header row apply to the whole file
    if (!hasNameColumn) {
      errors.push({
        row: 1,
        column: "header",
        message: "Missing a name column (expected 'fullName', 'name', or 'full_name')",
      });
    }
    if (!hasContactColumn) {
      errors.push({
        row: 1,
        column: "header",
        message: "Missing an 'email' or 'phone' column",
      });
    }
    if (!hasNameColumn || !hasContactColumn) {
      return { totalRows: 0, validContacts, errors, warnings };
    }

    const seenEmails = new Set<string>();
    let totalRows = 0;

    for (let i = 1; i < lines.length; i++) {
      totalRows++;
      const rowNum = i + 1; // 1-based row number including the header row
      const values = lines[i].split(",").map((v) => v.trim());
      const contact: ImportContact = { fullName: "" };

      headers.forEach((header, index) => {
        const value = values[index] || "";
        if (NAME_HEADERS.includes(header)) {
          contact.fullName = value;
        } else if (header === "email") {
          contact.email = value;
        } else if (header === "phone") {
          contact.phone = value;
        } else if (header === "tags") {
          contact.tags = value
            ? value.split(";").map((t) => t.trim()).filter(Boolean)
            : [];
        } else if (header === "notes") {
          contact.notes = value;
        }
      });

      let rowValid = true;

      if (!contact.fullName) {
        errors.push({ row: rowNum, column: "fullName", message: "Name is required" });
        rowValid = false;
      }
      if (!contact.email && !contact.phone) {
        errors.push({
          row: rowNum,
          column: "email/phone",
          message: "An email or phone number is required",
        });
        rowValid = false;
      }
      if (contact.email && !EMAIL_REGEX.test(contact.email)) {
        errors.push({
          row: rowNum,
          column: "email",
          message: `Invalid email format: "${contact.email}"`,
        });
        rowValid = false;
      }

      // Flag duplicate emails within the file (non-blocking)
      if (contact.email && EMAIL_REGEX.test(contact.email)) {
        const key = contact.email.toLowerCase();
        if (seenEmails.has(key)) {
          warnings.push({
            row: rowNum,
            column: "email",
            message: `Duplicate email in file: ${contact.email}`,
          });
        } else {
          seenEmails.add(key);
        }
      }

      if (rowValid) {
        validContacts.push(contact);
      }
    }

    return { totalRows, validContacts, errors, warnings };
  };

  const handleValidate = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    const text = await file.text();
    const validationResult = validateCsv(text);

    if (validationResult.totalRows === 0 && validationResult.errors.length === 0) {
      toast.error("No data rows found in CSV");
      return;
    }

    setValidation(validationResult);
    setViewState("review");
  };

  const handleProceed = async () => {
    if (!validation || validation.validContacts.length === 0) return;

    try {
      setViewState("importing");

      const data = await apiClient.post<{ data: ImportResult }>(
        `/marketing/shops/${shopId}/contacts/import`,
        { contacts: validation.validContacts }
      );

      setResult(data.data);
      setViewState("done");

      if (data.data.created > 0) {
        toast.success(`Successfully imported ${data.data.created} contacts`);
      }
      if (data.data.failed > 0) {
        toast.error(`Failed to import ${data.data.failed} contacts`);
      }
    } catch (error: unknown) {
      console.error("Import error:", error);
      const message =
        error && typeof error === "object" && "message" in error
          ? (error as { message: string }).message
          : "Failed to import contacts";
      toast.error(message);
      setViewState("review");
    }
  };

  const downloadTemplate = () => {
    const template =
      "fullName,email,phone,tags,notes\nJohn Doe,john@example.com,+1234567890,vip;new_lead,Met at trade show\nJane Smith,jane@example.com,+9876543210,newsletter,Email signup";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contact_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetToUpload = () => {
    setValidation(null);
    setResult(null);
    setViewState("upload");
  };

  const handleClose = () => {
    if (viewState === "importing") return;
    const imported = !!result && result.created > 0;
    setFile(null);
    setValidation(null);
    setResult(null);
    setViewState("upload");
    onClose(imported);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a1a1a] border-gray-800 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Contacts
          </DialogTitle>
        </DialogHeader>

        {/* ===================== UPLOAD ===================== */}
        {viewState === "upload" && (
          <div className="space-y-6">
            {/* Instructions */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <h3 className="text-blue-400 font-semibold mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                CSV Format Requirements
              </h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Required columns: <span className="text-white">fullName</span> (or name)</li>
                <li>• At least one contact method: <span className="text-white">email</span> or <span className="text-white">phone</span></li>
                <li>• Optional columns: tags (semicolon-separated), notes</li>
                <li>• First row must be column headers</li>
              </ul>
            </div>

            {/* Download Template */}
            <Button
              variant="outline"
              className="w-full border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
              onClick={downloadTemplate}
            >
              <Download className="w-4 h-4 mr-2" />
              Download CSV Template
            </Button>

            {/* File Upload */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? "border-yellow-500 bg-yellow-500/5"
                  : file
                  ? "border-green-500 bg-green-500/5"
                  : "border-gray-700 hover:border-gray-600"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="flex items-center justify-center gap-4">
                  <FileText className="w-10 h-10 text-yellow-500" />
                  <div className="text-left">
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-sm text-gray-400">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                    className="text-gray-400 hover:bg-gray-700 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-white mb-2">Drag and drop your CSV file here</p>
                  <p className="text-sm text-gray-400 mb-4">or</p>
                  <Label
                    htmlFor="file-upload"
                    className="cursor-pointer inline-flex items-center px-4 py-2 bg-yellow-500 text-black rounded-md hover:bg-yellow-400"
                  >
                    Browse Files
                  </Label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== REVIEW (validation phase) ===================== */}
        {viewState === "review" && validation && (
          <div className="space-y-6">
            {/* Summary */}
            <div
              className={`p-5 rounded-lg border ${
                validation.errors.length === 0
                  ? "border-green-500/40 bg-green-500/5"
                  : "border-orange-500/40 bg-orange-500/5"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    validation.errors.length === 0
                      ? "bg-green-500/10"
                      : "bg-orange-500/10"
                  }`}
                >
                  {validation.errors.length === 0 ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-orange-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h3
                    className={`text-lg font-bold mb-3 ${
                      validation.errors.length === 0
                        ? "text-green-400"
                        : "text-orange-400"
                    }`}
                  >
                    {validation.errors.length === 0
                      ? "Validation Successful!"
                      : "Validation Found Issues"}
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Total Rows:</span>
                      <span className="text-white font-semibold ml-2">
                        {validation.totalRows}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Valid:</span>
                      <span className="text-green-400 font-semibold ml-2">
                        {validation.validContacts.length}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Errors:</span>
                      <span className="text-red-400 font-semibold ml-2">
                        {validation.errors.length}
                      </span>
                    </div>
                  </div>
                  {validation.errors.length > 0 && (
                    <p className="text-xs text-gray-400 mt-3">
                      Only the {validation.validContacts.length} valid contact(s)
                      will be imported. Fix the errors below and re-upload to
                      include the rest.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Errors */}
            {validation.errors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  Errors ({validation.errors.length})
                </h4>
                <div className="bg-gray-800/30 rounded-lg border border-gray-700 overflow-hidden">
                  <div className="max-h-52 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-800/70 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Row</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Column</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validation.errors.map((issue, index) => (
                          <tr key={index} className="border-t border-gray-700/50">
                            <td className="px-4 py-2 text-white">{issue.row}</td>
                            <td className="px-4 py-2 text-gray-400">{issue.column}</td>
                            <td className="px-4 py-2 text-red-400 text-xs">{issue.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Warnings */}
            {validation.warnings.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  Warnings ({validation.warnings.length})
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {validation.warnings.map((issue, index) => (
                    <div
                      key={index}
                      className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-300"
                    >
                      Row {issue.row}: {issue.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== IMPORTING ===================== */}
        {viewState === "importing" && (
          <div className="space-y-4 py-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Importing contacts...</span>
              <span className="text-white">Please wait</span>
            </div>
            <Progress value={undefined} className="h-2" />
          </div>
        )}

        {/* ===================== DONE ===================== */}
        {viewState === "done" && result && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-400">{result.created}</p>
                <p className="text-sm text-gray-400">Imported</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-400">{result.failed}</p>
                <p className="text-sm text-gray-400">Failed</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 max-h-60 overflow-y-auto">
                <h3 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Import Errors
                </h3>
                <div className="space-y-2">
                  {result.errors.map((error, index) => (
                    <div
                      key={index}
                      className="text-sm bg-red-500/10 rounded px-3 py-2 border border-red-500/20"
                    >
                      <span className="text-red-400 font-medium">Row {error.row}:</span>
                      <span className="text-gray-300 ml-2">{error.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {viewState === "upload" && (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleValidate}
                disabled={!file}
                className="bg-yellow-500 hover:bg-yellow-400 text-black"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Validate Import
              </Button>
            </>
          )}

          {viewState === "review" && validation && (
            <>
              <Button
                variant="outline"
                onClick={resetToUpload}
                className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
              >
                Back
              </Button>
              <Button
                onClick={handleProceed}
                disabled={validation.validContacts.length === 0}
                className="bg-yellow-500 hover:bg-yellow-400 text-black"
              >
                <Users className="w-4 h-4 mr-2" />
                Import {validation.validContacts.length} Contact
                {validation.validContacts.length === 1 ? "" : "s"}
              </Button>
            </>
          )}

          {viewState === "done" && (
            <Button
              onClick={handleClose}
              className="bg-yellow-500 hover:bg-yellow-400 text-black"
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
