"use client";

import React, { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  Upload,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
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
import { Badge } from "@/components/ui/badge";

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

interface ImportResult {
  created: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export function ContactImportModal({
  open,
  onClose,
  shopId,
}: ContactImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
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

  const parseCSV = (csvText: string): ImportContact[] => {
    const lines = csvText.split("\n").filter((line) => line.trim());
    if (lines.length === 0) return [];

    // Parse header
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const contacts: ImportContact[] = [];

    // Parse rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const contact: ImportContact = {
        fullName: "",
      };

      headers.forEach((header, index) => {
        const value = values[index] || "";
        if (header === "fullname" || header === "name" || header === "full_name") {
          contact.fullName = value;
        } else if (header === "email") {
          contact.email = value;
        } else if (header === "phone") {
          contact.phone = value;
        } else if (header === "tags") {
          contact.tags = value ? value.split(";").map((t) => t.trim()) : [];
        } else if (header === "notes") {
          contact.notes = value;
        }
      });

      if (contact.fullName && (contact.email || contact.phone)) {
        contacts.push(contact);
      }
    }

    return contacts;
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    try {
      setImporting(true);

      // Read file
      const text = await file.text();
      const contacts = parseCSV(text);

      if (contacts.length === 0) {
        toast.error("No valid contacts found in CSV");
        setImporting(false);
        return;
      }

      // Import contacts
      const response = await fetch(`/api/marketing/shops/${shopId}/contacts/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contacts }),
      });

      if (!response.ok) {
        throw new Error("Import failed");
      }

      const data = await response.json();
      setResult(data.data);

      if (data.data.created > 0) {
        toast.success(`Successfully imported ${data.data.created} contacts`);
      }

      if (data.data.failed > 0) {
        toast.error(`Failed to import ${data.data.failed} contacts`);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import contacts");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = "fullName,email,phone,tags,notes\nJohn Doe,john@example.com,+1234567890,vip;new_lead,Met at trade show\nJane Smith,jane@example.com,+9876543210,newsletter,Email signup";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contact_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    if (!importing) {
      setFile(null);
      setResult(null);
      onClose(!!result && result.created > 0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a1a1a] border-gray-800 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Contacts
          </DialogTitle>
        </DialogHeader>

        {!result ? (
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
              className="w-full border-gray-700 hover:bg-gray-800"
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
                    disabled={importing}
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
                    disabled={importing}
                  />
                </div>
              )}
            </div>

            {importing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Importing contacts...</span>
                  <span className="text-white">Please wait</span>
                </div>
                <Progress value={undefined} className="h-2" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Success Summary */}
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

            {/* Errors List */}
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
          {!result ? (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={importing}
                className="border-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!file || importing}
                className="bg-yellow-500 hover:bg-yellow-400 text-black"
              >
                <Users className="w-4 h-4 mr-2" />
                Import Contacts
              </Button>
            </>
          ) : (
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
