"use client";

import React, { useState, useEffect, useRef } from "react";
import { DollarSign, Tag, Plus, XCircle, ChevronDown, Check } from "lucide-react";
import {
  CreateServiceData,
  UpdateServiceData,
  SERVICE_CATEGORIES,
  ShopService,
} from "@/services/api/services";
import { ImageUploader } from "../ImageUploader";

/**
 * ServiceForm
 *
 * Shop service create/edit form fields.
 *
 * This is the page-based replacement for the form half of CreateServiceModal.
 * The modal's chrome (overlay, dialog wrapper, header X button) is dropped.
 * The right-column live preview is split out into ServiceFormPreview (Task 2).
 *
 * Phase 1 scope: existing fields only — name, category, description, price,
 * image, tags, active status. The AI Sales Assistant section ships in Task 3
 * as a separate component composed alongside this one.
 *
 * Parent owns no form state. ServiceForm owns formData internally and
 * optionally calls onFormDataChange on every edit so a sibling preview
 * component can mirror the same state.
 */

const CategoryDropdown: React.FC<{
  value?: string;
  onChange: (value: string | undefined) => void;
  error?: string;
}> = ({ value, onChange, error }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedLabel = SERVICE_CATEGORIES.find(c => c.value === value)?.label;

  return (
    <div ref={dropdownRef} className="relative">
      <label className="block text-sm font-semibold text-white mb-2">
        Category <span className="text-red-500">*</span>
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-auto w-full items-center justify-between rounded-lg border px-4 py-3 text-sm bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent ${
          error ? "border-red-500" : "border-gray-700"
        }`}
      >
        <span className={selectedLabel ? "text-white" : "text-gray-400"}>
          {selectedLabel || "Select a category"}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-700 bg-[#1A1A1A] shadow-lg z-10">
          <div className="p-1">
            {SERVICE_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => {
                  onChange(cat.value);
                  setIsOpen(false);
                }}
                className={`relative flex w-full items-center rounded-lg py-2 pl-8 pr-2 text-sm text-white hover:bg-gray-800 ${
                  value === cat.value ? "bg-gray-800" : ""
                }`}
              >
                {value === cat.value && (
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <Check className="h-4 w-4 text-[#FFCC00]" />
                  </span>
                )}
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
};

export interface ServiceFormProps {
  initialData?: ShopService;
  onSubmit: (data: CreateServiceData | UpdateServiceData) => Promise<void>;
  onCancel: () => void;
  /** Optional. Fires on every formData edit. Used by ServiceFormPreview to mirror state. */
  onFormDataChange?: (data: CreateServiceData) => void;
  isEditing?: boolean;
  /**
   * Extra content rendered AFTER the 5 form sections and BEFORE the action
   * buttons — e.g. the AISalesAssistantSection on create/edit pages. Lives
   * inside the same `<form>` so it submits together but visually sits
   * between fields and Cancel/Submit.
   */
  children?: React.ReactNode;
}

export const ServiceForm: React.FC<ServiceFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  onFormDataChange,
  isEditing = false,
  children,
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
  const [tagError, setTagError] = useState<string | null>(null);

  // Notify parent when formData changes so siblings (e.g. live preview) can mirror state.
  useEffect(() => {
    onFormDataChange?.(formData);
  }, [formData, onFormDataChange]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateServiceData, string>> = {};

    // Basic Info
    if (!formData.serviceName.trim()) {
      newErrors.serviceName = "Service name is required";
    } else if (formData.serviceName.length > 100) {
      newErrors.serviceName = "Service name must be 100 characters or less";
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
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;

    setTagError(null);

    if (tag.length > 20) {
      setTagError("Tag must be 20 characters or less");
      return;
    }

    const currentTags = formData.tags || [];
    if (currentTags.length >= 5) {
      setTagError("Maximum 5 tags allowed");
      return;
    }

    if (currentTags.includes(tag)) {
      setTagError("Tag already exists");
      return;
    }

    handleChange("tags", [...currentTags, tag]);
    setTagInput("");
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. BASIC INFO */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-3 sm:p-5">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <span className="bg-[#FFCC00] text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
          Basic Info
        </h3>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-white mb-2">
            Service Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.serviceName}
            onChange={(e) => handleChange("serviceName", e.target.value)}
            maxLength={100}
            className={`w-full bg-[#1A1A1A] border ${
              errors.serviceName ? "border-red-500" : "border-gray-700"
            } rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors`}
            placeholder="e.g., iPhone Screen Repair, Haircut & Style"
          />
          <p className="mt-1 text-xs text-gray-500">
            {formData.serviceName?.length || 0}/100 characters
          </p>
          {errors.serviceName && (
            <p className="mt-1 text-sm text-red-500">{errors.serviceName}</p>
          )}
        </div>

        <CategoryDropdown
          value={formData.category}
          onChange={(value) => handleChange("category", value)}
          error={errors.category}
        />
      </div>

      {/* 2. DETAILS */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-3 sm:p-5">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <span className="bg-[#FFCC00] text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
          Details
        </h3>

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
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-3 sm:p-5">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <span className="bg-[#FFCC00] text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
          Visuals
        </h3>

        <ImageUploader
          currentImageUrl={formData.imageUrl}
          imageType="service"
          onUploadSuccess={(url) => handleChange("imageUrl", url)}
          onRemove={() => handleChange("imageUrl", "")}
          label="Service Photo"
          showPreview={true}
        />
      </div>

      {/* 4. DISCOVERY */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-3 sm:p-5">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <span className="bg-[#FFCC00] text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</span>
          Discovery
        </h3>

        <div>
          <label className="block text-sm font-semibold text-white mb-2">
            Tags <span className="text-gray-500 text-xs font-normal">(up to 5)</span>
          </label>
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                if (tagError) setTagError(null);
              }}
              onKeyPress={handleKeyPress}
              maxLength={20}
              disabled={(formData.tags?.length || 0) >= 5}
              className={`w-full bg-[#1A1A1A] border ${tagError ? 'border-red-500' : 'border-gray-700'} rounded-lg pl-10 pr-20 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
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
          <div className="flex justify-between mt-1">
            {tagError ? (
              <p className="text-sm text-red-500">{tagError}</p>
            ) : (
              <p className="text-xs text-gray-500">Press Enter or click + to add tags. Great for search!</p>
            )}
            <span className="text-xs text-gray-500">{tagInput.length}/20</span>
          </div>

          {formData.tags && formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {formData.tags.map((tag, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1 bg-[#FFCC00]/10 border border-[#FFCC00]/30 text-[#FFCC00] px-3 py-1.5 rounded-full text-sm font-medium max-w-[150px]"
                  title={tag}
                >
                  <span className="truncate">{tag}</span>
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
        </div>
      </div>

      {/* 5. STATUS */}
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-3 sm:p-5">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <span className="bg-[#FFCC00] text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">5</span>
          Status
        </h3>

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
            className={`relative inline-flex h-6 w-11 sm:h-8 sm:w-14 items-center rounded-full transition-colors flex-shrink-0 ${
              formData.active ? "bg-green-500" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 sm:h-6 sm:w-6 transform rounded-full bg-white transition-transform ${
                formData.active ? "translate-x-5 sm:translate-x-7" : "translate-x-1"
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

      {/* Slot for extra content (e.g. AISalesAssistantSection) between fields and buttons */}
      {children}

      {/* Action buttons */}
      <div className="flex gap-2 sm:gap-3 pt-4 sm:pt-6 border-t border-gray-800">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-800 text-white text-sm sm:text-base font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black text-sm sm:text-base font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
};
