"use client";

import React, { useState, useEffect } from "react";
import {
  Mail,
  Edit2,
  RefreshCw,
  AlertCircle,
  Search,
  Send,
  Eye,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  getEmailTemplates,
  toggleEmailTemplate,
  resetEmailTemplateToDefault,
  EmailTemplate,
} from "@/services/api/admin";
import { EmailTemplateEditor } from "./EmailTemplateEditor";

// Category icons and colors
const CATEGORY_CONFIG = {
  welcome: { icon: "🎉", color: "text-blue-400", bg: "bg-blue-900/20" },
  booking: { icon: "📅", color: "text-green-400", bg: "bg-green-900/20" },
  transaction: { icon: "💰", color: "text-yellow-400", bg: "bg-yellow-900/20" },
  shop: { icon: "🏪", color: "text-purple-400", bg: "bg-purple-900/20" },
  support: { icon: "💬", color: "text-pink-400", bg: "bg-pink-900/20" },
};

export const EmailTemplatesContent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<EmailTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, selectedCategory, searchQuery]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await getEmailTemplates();
      setTemplates(data);
    } catch (error) {
      console.error("Error loading email templates:", error);
      toast.error("Failed to load email templates");
    } finally {
      setLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = templates;

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        t =>
          t.templateName.toLowerCase().includes(query) ||
          t.subject.toLowerCase().includes(query) ||
          t.templateKey.toLowerCase().includes(query)
      );
    }

    setFilteredTemplates(filtered);
  };

  const handleToggleEnabled = async (template: EmailTemplate) => {
    const newEnabled = !template.enabled;
    const result = await toggleEmailTemplate(template.templateKey, newEnabled);

    if (result.success) {
      toast.success(`Template ${newEnabled ? "enabled" : "disabled"}`);
      // Update local state
      setTemplates(templates.map(t =>
        t.id === template.id ? { ...t, enabled: newEnabled } : t
      ));
    } else {
      toast.error(result.message || "Failed to toggle template");
    }
  };

  const handleResetToDefault = async (template: EmailTemplate) => {
    if (!confirm(`Reset "${template.templateName}" to default? This cannot be undone.`)) {
      return;
    }

    const result = await resetEmailTemplateToDefault(template.templateKey);

    if (result.success) {
      toast.success("Template reset to default");
      await loadTemplates();
    } else {
      toast.error(result.message || "Failed to reset template");
    }
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
  };

  const handleEditorClose = (updated: boolean) => {
    setEditingTemplate(null);
    if (updated) {
      loadTemplates();
    }
  };

  const categories = [
    { value: "all", label: "All Templates" },
    { value: "welcome", label: "Welcome" },
    { value: "booking", label: "Booking" },
    { value: "transaction", label: "Transaction" },
    { value: "shop", label: "Shop" },
    { value: "support", label: "Support" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-[#FFCC00] animate-spin" />
        <span className="ml-3 text-gray-400">Loading email templates...</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold text-[#FFCC00]">Email Templates</h2>
          <p className="text-sm text-gray-400 mt-1">
            Customize email notifications sent to customers and shops
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  selectedCategory === cat.value
                    ? "bg-[#FFCC00] text-black"
                    : "bg-[#1a1a1a] text-gray-400 hover:text-white hover:bg-[#252525]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Template List */}
        {filteredTemplates.length === 0 ? (
          <div className="bg-[#1a1a1a] rounded-xl p-12 border border-[#303236] text-center">
            <Mail className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 mb-2">
              No templates found
            </h3>
            <p className="text-sm text-gray-500">
              {searchQuery
                ? "Try adjusting your search query"
                : "No templates available in this category"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={handleEditTemplate}
                onToggle={handleToggleEnabled}
                onReset={handleResetToDefault}
              />
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-blue-400" />
            <div className="text-sm text-blue-300">
              <span className="font-semibold">{filteredTemplates.length}</span> templates
              {selectedCategory !== "all" && ` in ${selectedCategory}`} •{" "}
              <span className="font-semibold">
                {filteredTemplates.filter(t => t.enabled).length}
              </span>{" "}
              enabled
            </div>
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      {editingTemplate && (
        <EmailTemplateEditor
          template={editingTemplate}
          onClose={handleEditorClose}
        />
      )}
    </>
  );
};

// Template Card Component
interface TemplateCardProps {
  template: EmailTemplate;
  onEdit: (template: EmailTemplate) => void;
  onToggle: (template: EmailTemplate) => void;
  onReset: (template: EmailTemplate) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onEdit,
  onToggle,
  onReset,
}) => {
  const config = CATEGORY_CONFIG[template.category];
  const lastModified = template.updatedAt
    ? new Date(template.updatedAt).toLocaleDateString()
    : "Never";

  return (
    <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#303236] hover:border-[#FFCC00]/50 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`text-2xl ${config.bg} p-2 rounded-lg`}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white truncate">
              {template.templateName}
            </h3>
            <p className="text-xs text-gray-400 capitalize">{template.category}</p>
          </div>
        </div>

        {/* Enable/Disable Toggle */}
        <label className="relative inline-flex items-center cursor-pointer ml-2 flex-shrink-0">
          <input
            type="checkbox"
            checked={template.enabled}
            onChange={() => onToggle(template)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FFCC00]"></div>
        </label>
      </div>

      {/* Subject Preview */}
      <div className="mb-3 p-2 bg-[#101010] rounded border border-[#303236]">
        <p className="text-xs text-gray-500 mb-1">Subject:</p>
        <p className="text-sm text-gray-300 truncate">{template.subject}</p>
      </div>

      {/* Variables */}
      {template.variables && template.variables.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">Available Variables:</p>
          <div className="flex flex-wrap gap-1">
            {template.variables.slice(0, 4).map((variable) => (
              <span
                key={variable}
                className="text-xs px-2 py-1 bg-[#101010] text-[#FFCC00] rounded font-mono"
              >
                {`{{${variable}}}`}
              </span>
            ))}
            {template.variables.length > 4 && (
              <span className="text-xs px-2 py-1 text-gray-500">
                +{template.variables.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-[#303236]">
        <div className="text-xs text-gray-500">
          Modified: {lastModified}
          {!template.isDefault && (
            <span className="ml-2 text-blue-400">• Custom</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!template.isDefault && (
            <button
              onClick={() => onReset(template)}
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-all duration-200"
              title="Reset to default"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onEdit(template)}
            className="px-3 py-1.5 bg-[#FFCC00] hover:bg-[#FFD633] text-black rounded text-xs font-medium transition-all duration-200 flex items-center gap-1"
          >
            <Edit2 className="w-3 h-3" />
            Edit
          </button>
        </div>
      </div>
    </div>
  );
};
