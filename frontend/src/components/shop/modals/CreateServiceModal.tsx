"use client";

import React, { useState, useEffect } from "react";
import { X, DollarSign, Tag, Image as ImageIcon, Plus, XCircle } from "lucide-react";
import {
  CreateServiceData,
  UpdateServiceData,
  SERVICE_CATEGORIES,
  ShopService,
} from "@/services/api/services";
import { ImageUploader } from "../ImageUploader";

interface CreateServiceModalProps {
  onClose: () => void;
  onSubmit: (data: CreateServiceData | UpdateServiceData) => Promise<void>;
  initialData?: ShopService;
  isEditing?: boolean;
}

export const CreateServiceModal: React.FC<CreateServiceModalProps> = ({
  onClose,
  onSubmit,
  initialData,
  isEditing = false,
}) => {
  const [formData, setFormData] = useState<CreateServiceData>({
    serviceName: initialData?.serviceName || "",
    category: initialData?.category || undefined,
    description: initialData?.description || "",
    durationMinutes: initialData?.durationMinutes || undefined,
    priceUsd: initialData?.priceUsd || 0,
    imageUrl: initialData?.imageUrl || "",
    tags: initialData?.tags || [],
    active: initialData?.active !== undefined ? initialData.active : true,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreateServiceData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateServiceData, string>> = {};

    // Basic Info
    if (!formData.serviceName.trim()) {
      newErrors.serviceName = "Service name is required";
    }

    if (!formData.category) {
      newErrors.category = "Category is required";
    }

    // Details
    if (!formData.priceUsd || formData.priceUsd <= 0) {
      newErrors.priceUsd = "Price is required and must be greater than 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error("Error submitting service:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    field: keyof CreateServiceData,
    value: string | number | boolean | string[] | undefined
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is modified
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;

    const currentTags = formData.tags || [];
    if (currentTags.length >= 5) {
      return; // Max 5 tags
    }

    if (!currentTags.includes(tag)) {
      handleChange("tags", [...currentTags, tag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = formData.tags || [];
    handleChange("tags", currentTags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-[#1A1A1A] z-10">
          <h2 className="text-2xl font-bold text-white">
            {isEditing ? "Edit Service" : "Create New Service"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Form Fields */}
            <div className="space-y-6">
              {/* 1. BASIC INFO */}
              <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="bg-[#FFCC00] text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
                  Basic Info
                </h3>

                {/* Service Name */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-white mb-2">
                    Service Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.serviceName}
                    onChange={(e) => handleChange("serviceName", e.target.value)}
                    className={`w-full bg-[#1A1A1A] border ${
                      errors.serviceName ? "border-red-500" : "border-gray-700"
                    } rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors`}
                    placeholder="e.g., iPhone Screen Repair, Haircut & Style"
                  />
                  {errors.serviceName && (
                    <p className="mt-1 text-sm text-red-500">{errors.serviceName}</p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category || ""}
                    onChange={(e) => handleChange("category", e.target.value || undefined)}
                    className={`w-full bg-[#1A1A1A] border ${
                      errors.category ? "border-red-500" : "border-gray-700"
                    } rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FFCC00] transition-colors appearance-none cursor-pointer`}
                  >
                    <option value="">Select a category</option>
                    {SERVICE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="mt-1 text-sm text-red-500">{errors.category}</p>
                  )}
                </div>
              </div>

              {/* 2. DETAILS */}
              <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="bg-[#FFCC00] text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
                  Details
                </h3>

                {/* Description */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-white mb-2">
                    Short Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors resize-none"
                    placeholder="Brief description (1-3 lines)"
                    rows={3}
                    maxLength={200}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formData.description?.length || 0}/200 characters
                  </p>
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Price (USD) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.priceUsd || ""}
                      onChange={(e) =>
                        handleChange("priceUsd", parseFloat(e.target.value) || 0)
                      }
                      className={`w-full bg-[#1A1A1A] border ${
                        errors.priceUsd ? "border-red-500" : "border-gray-700"
                      } rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors`}
                      placeholder="49.99"
                    />
                  </div>
                  {errors.priceUsd && (
                    <p className="mt-1 text-sm text-red-500">{errors.priceUsd}</p>
                  )}
                </div>
              </div>

              {/* 3. VISUALS */}
              <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="bg-[#FFCC00] text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
                  Visuals
                </h3>

                {/* Image Upload */}
                <ImageUploader
                  currentImageUrl={formData.imageUrl}
                  imageType="service"
                  onUploadSuccess={(url, key) => handleChange("imageUrl", url)}
                  onRemove={() => handleChange("imageUrl", "")}
                  label="Service Photo"
                  showPreview={true}
                />
              </div>

              {/* 4. DISCOVERY */}
              <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="bg-[#FFCC00] text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</span>
                  Discovery
                </h3>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Tags <span className="text-gray-500 text-xs font-normal">(up to 5)</span>
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={(formData.tags?.length || 0) >= 5}
                      className="w-full bg-[#1A1A1A] border border-gray-700 rounded-lg pl-10 pr-20 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="e.g., iPhone, Screen, Battery"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      disabled={(formData.tags?.length || 0) >= 5 || !tagInput.trim()}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-[#FFCC00] text-black px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Tags Display */}
                  {formData.tags && formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {formData.tags.map((tag, index) => (
                        <div
                          key={index}
                          className="inline-flex items-center gap-1 bg-[#FFCC00]/10 border border-[#FFCC00]/30 text-[#FFCC00] px-3 py-1.5 rounded-full text-sm font-medium"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 hover:text-red-400 transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Press Enter or click + to add tags. Great for search!
                  </p>
                </div>
              </div>

              {/* 5. STATUS */}
              <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="bg-[#FFCC00] text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">5</span>
                  Status
                </h3>

                {/* Active Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-1">
                      Active Status
                    </label>
                    <p className="text-xs text-gray-500">
                      Inactive services won't appear in the marketplace
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleChange("active", !formData.active)}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      formData.active ? "bg-green-500" : "bg-gray-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        formData.active ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                <div className="mt-2">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    formData.active
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                  }`}>
                    {formData.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column - Image Preview */}
            <div className="lg:sticky lg:top-6 lg:self-start">
              <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Live Preview</h3>

                {formData.imageUrl ? (
                  <div className="w-full aspect-video rounded-lg overflow-hidden bg-gray-800 mb-4">
                    <img
                      src={formData.imageUrl}
                      alt="Service preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "";
                        (e.target as HTMLImageElement).alt = "Failed to load image";
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full aspect-video rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center mb-4">
                    <ImageIcon className="w-16 h-16 text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500">No image yet</p>
                  </div>
                )}

                {/* Service Card Preview */}
                <div className="bg-[#1A1A1A] border border-gray-700 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-lg font-bold text-white">
                      {formData.serviceName || "Service Name"}
                    </h4>
                    {formData.category && (
                      <span className="text-xs bg-[#FFCC00]/10 border border-[#FFCC00]/30 text-[#FFCC00] px-2 py-1 rounded-full">
                        {SERVICE_CATEGORIES.find(c => c.value === formData.category)?.label}
                      </span>
                    )}
                  </div>

                  {formData.description && (
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                      {formData.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1 text-green-500">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-semibold">
                        {formData.priceUsd ? formData.priceUsd.toFixed(2) : "0.00"}
                      </span>
                    </div>
                  </div>

                  {formData.tags && formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {formData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 text-white font-semibold px-6 py-3 rounded-xl hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold px-6 py-3 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : isEditing
                ? "Update Service"
                : "Create Service"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
