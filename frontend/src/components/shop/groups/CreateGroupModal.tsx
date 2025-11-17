"use client";

import { useState } from "react";
import { X } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";

interface CreateGroupModalProps {
  onClose: () => void;
  onSubmit: (data: shopGroupsAPI.CreateGroupData) => Promise<void>;
}

// Popular emojis for shop groups
const POPULAR_ICONS = [
  "🏪", "🔧", "🚗", "🏍️", "🚲", "⚙️", "🛠️", "🔩",
  "💎", "⭐", "🌟", "✨", "🎯", "🎨", "🏆", "👥",
  "🤝", "💼", "🏢", "🏭", "🌍", "🌎", "🌏", "🔰"
];

export default function CreateGroupModal({ onClose, onSubmit }: CreateGroupModalProps) {
  const [formData, setFormData] = useState<shopGroupsAPI.CreateGroupData>({
    groupName: "",
    customTokenName: "",
    customTokenSymbol: "",
    description: "",
    logoUrl: "",
    icon: "🏪", // Default icon
  });
  const [submitting, setSubmitting] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await onSubmit(formData);
    } catch (error) {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white">Create Shop Group</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Group Name *
            </label>
            <input
              type="text"
              required
              value={formData.groupName}
              onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
              placeholder="e.g., Downtown Auto Repair Coalition"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
            />
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Group Icon *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-[#FFCC00] transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{formData.icon}</span>
                  <span className="text-gray-400">Click to change icon</span>
                </div>
                <span className="text-xs text-gray-500">{showIconPicker ? "▲" : "▼"}</span>
              </button>

              {showIconPicker && (
                <div className="absolute z-10 w-full mt-2 p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-xl">
                  <p className="text-xs text-gray-400 mb-3">Select an icon for your group:</p>
                  <div className="grid grid-cols-8 gap-2">
                    {POPULAR_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, icon });
                          setShowIconPicker(false);
                        }}
                        className={`text-3xl p-2 rounded-lg hover:bg-gray-700 transition-colors ${
                          formData.icon === icon ? "bg-[#FFCC00]/20 ring-2 ring-[#FFCC00]" : ""
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Token Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Token Name *
              </label>
              <input
                type="text"
                required
                value={formData.customTokenName}
                onChange={(e) =>
                  setFormData({ ...formData, customTokenName: e.target.value })
                }
                placeholder="e.g., DowntownBucks"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Token Symbol * (Max 10 chars)
              </label>
              <input
                type="text"
                required
                maxLength={10}
                value={formData.customTokenSymbol}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    customTokenSymbol: e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g., DTB"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your shop group and its benefits..."
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
            />
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Logo URL (optional)
            </label>
            <input
              type="url"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              <strong>Requirements:</strong>
            </p>
            <ul className="text-sm text-blue-300 mt-2 space-y-1 list-disc list-inside">
              <li>Active RepairCoin subscription ($500/month)</li>
              <li>Custom tokens require RCN backing (1:2 ratio)</li>
              <li>You will automatically become the admin of this group</li>
              <li>Custom tokens can only be earned and redeemed within member shops</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
