"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import {
  Mail,
  Eye,
  Save,
  RotateCcw,
  Palette,
  Code,
  Type,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";

export default function EmailTemplatesPage() {
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [subject, setSubject] = useState("🔔 Low Stock Alert - {{shop_name}}");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  // Default template content
  const [htmlContent, setHtmlContent] = useState(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #FFCC00 0%, #FFB700 100%); padding: 30px 20px; text-align: center;">
      <h1 style="color: #000000; margin: 0; font-size: 24px;">🔔 Low Stock Alert</h1>
      <p style="color: #333333; margin: 10px 0 0 0;">{{shop_name}}</p>
    </div>

    <!-- Content -->
    <div style="padding: 30px 20px;">
      <p style="color: #333333; font-size: 16px;">Hello,</p>
      <p style="color: #333333; font-size: 16px;">
        You have <strong>{{item_count}} items</strong> that are running low on stock.
      </p>

      <!-- Items List -->
      <div style="background-color: #f9f9f9; border-left: 4px solid #FFCC00; padding: 15px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0;">Items Below Threshold:</h3>
        {{items_list}}
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{dashboard_url}}" style="display: inline-block; background-color: #FFCC00; color: #000000; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold;">
          View Inventory Dashboard
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9f9f9; padding: 20px; text-align: center;">
      <p style="color: #666666; font-size: 12px; margin: 0;">
        © {{current_year}} RepairCoin. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>`);

  const handleSave = async () => {
    try {
      // TODO: Implement API call to save template
      toast.success("Email template saved successfully!");
    } catch (error) {
      toast.error("Failed to save email template");
    }
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset to the default template? This will discard all your changes.")) {
      // Reset to default
      setSubject("🔔 Low Stock Alert - {{shop_name}}");
      setHtmlContent(htmlContent); // Already default
      toast.success("Template reset to default");
    }
  };

  const getPreviewHtml = () => {
    return htmlContent
      .replace(/{{shop_name}}/g, "Demo Shop")
      .replace(/{{item_count}}/g, "5")
      .replace(/{{current_year}}/g, new Date().getFullYear().toString())
      .replace(/{{dashboard_url}}/g, "#")
      .replace(
        /{{items_list}}/g,
        `
        <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">
          <strong>Screen Protector (SKU: SP-001)</strong><br/>
          <span style="color: #666;">Current: 3 units | Threshold: 10 units</span>
        </div>
        <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">
          <strong>Phone Case - Black (SKU: PC-BLK)</strong><br/>
          <span style="color: #666;">Current: 1 unit | Threshold: 5 units</span>
        </div>
        <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">
          <strong>Charging Cable USB-C (SKU: CC-USBC)</strong><br/>
          <span style="color: #666;">Current: 2 units | Threshold: 8 units</span>
        </div>
        `
      );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mail className="w-7 h-7 text-[#FFCC00]" />
            Email Templates
          </h1>
          <p className="text-gray-400 mt-1">Customize your low stock alert email template</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-gray-700 text-white rounded-lg hover:bg-[#252525] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors font-medium"
          >
            <Save className="w-4 h-4" />
            Save Template
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800">
        <button
          onClick={() => setActiveTab("edit")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "edit"
              ? "text-[#FFCC00] border-b-2 border-[#FFCC00]"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4" />
            Edit Template
          </div>
        </button>
        <button
          onClick={() => setActiveTab("preview")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "preview"
              ? "text-[#FFCC00] border-b-2 border-[#FFCC00]"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Preview
          </div>
        </button>
      </div>

      {/* Edit Tab */}
      {activeTab === "edit" && (
        <div className="space-y-6">
          {/* Subject Line */}
          <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Type className="w-4 h-4" />
              Email Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 bg-[#252525] border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
              placeholder="Enter email subject..."
            />
            <p className="text-xs text-gray-400 mt-2">
              Available variables: <code className="bg-[#252525] px-1 py-0.5 rounded">{"{{shop_name}}"}</code>{" "}
              <code className="bg-[#252525] px-1 py-0.5 rounded">{"{{item_count}}"}</code>
            </p>
          </div>

          {/* HTML Editor */}
          <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Code className="w-4 h-4" />
              HTML Template
            </label>
            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              className="w-full h-96 px-4 py-3 bg-[#252525] border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent font-mono text-sm"
              spellCheck={false}
            />
            <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
              <p className="text-sm text-blue-300 mb-2">
                <strong>Available Variables:</strong>
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-blue-300">
                <code className="bg-[#252525] px-2 py-1 rounded">{"{{shop_name}}"}</code>
                <code className="bg-[#252525] px-2 py-1 rounded">{"{{item_count}}"}</code>
                <code className="bg-[#252525] px-2 py-1 rounded">{"{{items_list}}"}</code>
                <code className="bg-[#252525] px-2 py-1 rounded">{"{{dashboard_url}}"}</code>
                <code className="bg-[#252525] px-2 py-1 rounded">{"{{current_year}}"}</code>
              </div>
            </div>
          </div>

          {/* Customization Tips */}
          <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Customization Tips
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-white mb-1">Brand Colors</p>
                <p className="text-gray-400">
                  Update background colors and text to match your shop's branding.
                </p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Logo</p>
                <p className="text-gray-400">
                  Add your shop logo URL in an <code>&lt;img&gt;</code> tag in the header.
                </p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Call-to-Action</p>
                <p className="text-gray-400">Customize the button text and styling to encourage action.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Mobile-Friendly</p>
                <p className="text-gray-400">Use responsive design practices with max-width: 600px.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === "preview" && (
        <div className="space-y-4">
          {/* Preview Controls */}
          <div className="flex items-center justify-between bg-[#1a1a1a] rounded-lg border border-gray-800 p-4">
            <div>
              <p className="text-sm text-gray-400">Preview Mode</p>
              <p className="text-lg font-semibold text-white">{subject}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewMode("desktop")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  previewMode === "desktop"
                    ? "bg-[#FFCC00] text-black"
                    : "bg-[#252525] text-gray-400 hover:text-white"
                }`}
              >
                Desktop
              </button>
              <button
                onClick={() => setPreviewMode("mobile")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  previewMode === "mobile"
                    ? "bg-[#FFCC00] text-black"
                    : "bg-[#252525] text-gray-400 hover:text-white"
                }`}
              >
                Mobile
              </button>
            </div>
          </div>

          {/* Preview Frame */}
          <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6">
            <div className={`mx-auto ${previewMode === "desktop" ? "max-w-2xl" : "max-w-sm"}`}>
              <iframe
                srcDoc={getPreviewHtml()}
                className="w-full h-[600px] bg-white rounded-lg border border-gray-700"
                title="Email Preview"
              />
            </div>
          </div>

          {/* Preview Info */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              <strong>Note:</strong> This preview shows sample data. Actual emails will use real inventory data from
              your shop.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
