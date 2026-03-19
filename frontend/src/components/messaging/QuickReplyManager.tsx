"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Pencil, Trash2, Loader2, MessageSquare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import * as messagingApi from "@/services/api/messaging";
import type { QuickReply } from "@/services/api/messaging";

interface QuickReplyManagerProps {
  onClose: () => void;
  onRepliesUpdated: () => void;
}

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "booking", label: "Booking" },
  { value: "payment", label: "Payment" },
  { value: "greeting", label: "Greeting" },
];

export const QuickReplyManager: React.FC<QuickReplyManagerProps> = ({
  onClose,
  onRepliesUpdated,
}) => {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("general");

  useEffect(() => {
    fetchReplies();
  }, []);

  const fetchReplies = async () => {
    setLoading(true);
    try {
      const data = await messagingApi.getQuickReplies();
      setReplies(data);
    } catch (err) {
      console.error("Error fetching quick replies:", err);
      toast.error("Failed to load quick replies");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
    setFormTitle("");
    setFormContent("");
    setFormCategory("general");
  };

  const handleEdit = (reply: QuickReply) => {
    setEditingId(reply.id);
    setFormTitle(reply.title);
    setFormContent(reply.content);
    setFormCategory(reply.category);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim() || !formContent.trim()) {
      toast.error("Title and content are required");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await messagingApi.updateQuickReply(editingId, {
          title: formTitle.trim(),
          content: formContent.trim(),
          category: formCategory,
        });
        toast.success("Quick reply updated");
      } else {
        await messagingApi.createQuickReply({
          title: formTitle.trim(),
          content: formContent.trim(),
          category: formCategory,
        });
        toast.success("Quick reply created");
      }
      resetForm();
      await fetchReplies();
      onRepliesUpdated();
    } catch (err) {
      console.error("Error saving quick reply:", err);
      toast.error("Failed to save quick reply");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await messagingApi.deleteQuickReply(id);
      toast.success("Quick reply deleted");
      setReplies((prev) => prev.filter((r) => r.id !== id));
      onRepliesUpdated();
      if (editingId === id) resetForm();
    } catch (err) {
      console.error("Error deleting quick reply:", err);
      toast.error("Failed to delete quick reply");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFCC00]/20 rounded-full flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-[#FFCC00]" />
            </div>
            <h2 className="text-xl font-semibold text-white">Quick Replies</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-[#FFCC00] animate-spin" />
            </div>
          ) : (
            <>
              {/* Replies List */}
              {replies.length === 0 && !showForm ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-400 mb-1">No quick replies yet</p>
                  <p className="text-gray-600 text-sm">
                    Create templates for common responses
                  </p>
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        editingId === reply.id
                          ? "border-[#FFCC00]/50 bg-[#FFCC00]/5"
                          : "border-gray-800 bg-[#0D0D0D] hover:border-gray-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-white text-sm font-medium truncate">
                              {reply.title}
                            </p>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                              {reply.category}
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm truncate">
                            {reply.content}
                          </p>
                          {reply.usageCount > 0 && (
                            <p className="text-gray-600 text-xs mt-1">
                              Used {reply.usageCount} time
                              {reply.usageCount !== 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleEdit(reply)}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(reply.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add/Edit Form */}
              {showForm ? (
                <form
                  onSubmit={handleSubmit}
                  className="p-4 bg-[#0D0D0D] border border-gray-800 rounded-lg"
                >
                  <h3 className="text-white font-medium text-sm mb-3">
                    {editingId ? "Edit Quick Reply" : "New Quick Reply"}
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Title
                      </label>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="e.g. Booking Confirmed"
                        maxLength={100}
                        className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Message Content
                      </label>
                      <textarea
                        value={formContent}
                        onChange={(e) => setFormContent(e.target.value)}
                        placeholder="The message that will be sent..."
                        rows={3}
                        maxLength={2000}
                        className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#FFCC00] focus:outline-none resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Category
                      </label>
                      <Select value={formCategory} onValueChange={(value) => setFormCategory(value)}>
                        <SelectTrigger variant="dark" className="w-full px-3 py-2 h-auto bg-[#1A1A1A] border-gray-700 rounded-lg text-white text-sm">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent variant="dark">
                          {CATEGORIES.map((cat) => (
                            <SelectItem variant="dark" key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-gray-300 text-sm hover:border-gray-500 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 px-3 py-2 bg-[#FFCC00] rounded-lg text-black text-sm font-medium hover:bg-[#FFD700] transition-colors disabled:opacity-50"
                    >
                      {saving
                        ? "Saving..."
                        : editingId
                        ? "Update"
                        : "Create"}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full p-3 border border-dashed border-gray-700 rounded-lg text-gray-400 text-sm hover:border-[#FFCC00]/50 hover:text-[#FFCC00] transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Quick Reply
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
