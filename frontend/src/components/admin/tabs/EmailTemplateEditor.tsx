"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  RefreshCw,
  Send,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Code,
  Type,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  updateEmailTemplate,
  previewEmailTemplate,
  sendTestEmail,
  EmailTemplate,
  EmailTemplatePreview as IEmailTemplatePreview,
} from "@/services/api/admin";

interface EmailTemplateEditorProps {
  template: EmailTemplate;
  onClose: (updated: boolean) => void;
}

export const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({
  template,
  onClose,
}) => {
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.bodyHtml);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<IEmailTemplatePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const changed =
      subject !== template.subject || bodyHtml !== template.bodyHtml;
    setHasChanges(changed);
  }, [subject, bodyHtml, template]);

  const handleSave = async () => {
    if (!subject.trim()) {
      toast.error("Subject line is required");
      return;
    }

    if (!bodyHtml.trim()) {
      toast.error("Email body is required");
      return;
    }

    setSaving(true);
    try {
      const result = await updateEmailTemplate(template.templateKey, {
        subject,
        bodyHtml,
      });

      if (result.success) {
        toast.success("Template updated successfully");
        onClose(true);
      } else {
        toast.error(result.message || "Failed to update template");
      }
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Error saving template");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setLoadingPreview(true);
    try {
      // Generate sample data based on template variables
      const sampleData: Record<string, string> = {};
      template.variables.forEach((variable) => {
        switch (variable) {
          case "customerName":
            sampleData[variable] = "John Doe";
            break;
          case "shopName":
            sampleData[variable] = "RepairShop Pro";
            break;
          case "amount":
            sampleData[variable] = "50.00";
            break;
          case "platformName":
            sampleData[variable] = "RepairCoin";
            break;
          case "walletAddress":
            sampleData[variable] = "0x1234...5678";
            break;
          case "serviceName":
            sampleData[variable] = "Oil Change";
            break;
          case "bookingDate":
            sampleData[variable] = new Date().toLocaleDateString();
            break;
          case "bookingTime":
            sampleData[variable] = "10:00 AM";
            break;
          default:
            sampleData[variable] = `Sample ${variable}`;
        }
      });

      const previewData = await previewEmailTemplate(
        template.templateKey,
        sampleData
      );

      if (previewData) {
        setPreview(previewData);
        setShowPreview(true);
      } else {
        toast.error("Failed to generate preview");
      }
    } catch (error) {
      console.error("Error generating preview:", error);
      toast.error("Error generating preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSendingTest(true);
    try {
      const result = await sendTestEmail(template.templateKey, testEmail);

      if (result.success) {
        toast.success(`Test email sent to ${testEmail}`);
        setTestEmail("");
      } else {
        toast.error(result.message || "Failed to send test email");
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error("Error sending test email");
    } finally {
      setSendingTest(false);
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById("bodyHtml") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = bodyHtml;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const newText = before + `{{${variable}}}` + after;
      setBodyHtml(newText);
      // Set cursor position after inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + variable.length + 4,
          start + variable.length + 4
        );
      }, 0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#101010] rounded-2xl border border-[#303236] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#303236]">
          <div>
            <h2 className="text-xl font-semibold text-[#FFCC00]">
              Edit Email Template
            </h2>
            <p className="text-sm text-gray-400 mt-1">{template.templateName}</p>
          </div>
          <button
            onClick={() => onClose(false)}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Unsaved Changes Warning */}
          {hasChanges && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <p className="text-sm text-yellow-300">
                  You have unsaved changes. Don&apos;t forget to save before closing.
                </p>
              </div>
            </div>
          )}

          {/* Subject Line */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use variables like {`{{customerName}}`} for dynamic content
            </p>
          </div>

          {/* Available Variables */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Available Variables
            </label>
            <div className="flex flex-wrap gap-2">
              {template.variables.map((variable) => (
                <button
                  key={variable}
                  onClick={() => insertVariable(variable)}
                  className="px-3 py-1.5 bg-[#1a1a1a] border border-[#303236] hover:border-[#FFCC00] text-[#FFCC00] rounded text-xs font-mono transition-all duration-200"
                  title="Click to insert"
                >
                  {`{{${variable}}}`}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Click a variable to insert it at cursor position
            </p>
          </div>

          {/* Body Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-400">
                Email Body (HTML)
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1 px-3 py-1 bg-[#1a1a1a] hover:bg-[#252525] text-gray-400 hover:text-white rounded text-xs transition-all duration-200"
                >
                  {showPreview ? (
                    <>
                      <Code className="w-3 h-3" />
                      Code
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" />
                      Preview
                    </>
                  )}
                </button>
              </div>
            </div>

            {showPreview ? (
              <div className="border border-[#303236] rounded-lg p-4 bg-white min-h-[300px]">
                {loadingPreview ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 text-[#FFCC00] animate-spin" />
                  </div>
                ) : preview ? (
                  <div>
                    <div className="border-b border-gray-200 pb-2 mb-4">
                      <p className="text-xs text-gray-500">Subject:</p>
                      <p className="text-sm font-medium text-gray-900">
                        {preview.subject}
                      </p>
                    </div>
                    <div
                      className="prose prose-sm max-w-none text-gray-900"
                      dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <button
                      onClick={handlePreview}
                      className="px-4 py-2 bg-[#FFCC00] hover:bg-[#FFD633] text-black rounded-lg text-sm font-medium transition-all duration-200"
                    >
                      Generate Preview
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <textarea
                id="bodyHtml"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                placeholder="Enter HTML email body..."
                rows={12}
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#303236] rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[#FFCC00] transition-all duration-200 resize-none"
              />
            )}
          </div>

          {/* Test Email */}
          <div className="border-t border-[#303236] pt-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Send Test Email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="flex-1 px-4 py-2 bg-[#1a1a1a] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
              />
              <button
                onClick={handleSendTest}
                disabled={sendingTest}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingTest ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Test
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Send a test email to verify how it looks in your inbox
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-[#303236]">
          <div className="text-sm text-gray-400">
            {hasChanges && (
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onClose(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-4 py-2 bg-[#FFCC00] hover:bg-[#FFD633] text-black rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
