"use client";

import React from "react";
import { DollarSign, Clock, Image as ImageIcon, Bot } from "lucide-react";
import {
  CreateServiceData,
  SERVICE_CATEGORIES,
} from "@/services/api/services";
import { sanitizeDescription } from "@/utils/sanitize";

/**
 * ServiceFormPreview
 *
 * Right-side "Live Preview" card for the service create/edit page.
 * Matches the design in `sc1.jpeg`: thumbnail, name, description,
 * category badge, price + duration row, optional AI badge.
 *
 * Pure presentational — reads formData from props. Designed to live next
 * to ServiceForm in a 2-column layout (sticky on desktop, stacked on mobile).
 *
 * Phase 1 only renders fields that ServiceForm currently supports. The
 * `aiEnabled` prop is optional and consumed in Task 3 once the AI Sales
 * Assistant section ships — defaults to false here.
 */

export interface ServiceFormPreviewProps {
  formData: CreateServiceData;
  /** Optional. When true, renders a small AI bot indicator on the preview card. */
  aiEnabled?: boolean;
}

export const ServiceFormPreview: React.FC<ServiceFormPreviewProps> = ({
  formData,
  aiEnabled = false,
}) => {
  const categoryLabel = formData.category
    ? SERVICE_CATEGORIES.find((c) => c.value === formData.category)?.label
    : null;

  return (
    <div className="lg:sticky lg:top-6 lg:self-start">
      <div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-3 sm:p-5">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
          Live Preview
        </h3>

        <p className="text-xs text-gray-500 mb-2">Service Thumbnail Image</p>

        {/* Image / placeholder */}
        {formData.imageUrl ? (
          <div className="w-full aspect-video rounded-lg overflow-hidden bg-gray-800 mb-4">
            <img
              src={formData.imageUrl}
              alt={formData.serviceName || "Service preview"}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "";
                (e.target as HTMLImageElement).alt = "Failed to load image";
              }}
            />
          </div>
        ) : (
          <div className="w-full aspect-video rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center mb-4">
            <ImageIcon className="w-10 h-10 sm:w-16 sm:h-16 text-gray-600 mb-2" />
            <p className="text-sm text-gray-500">No image yet</p>
          </div>
        )}

        {/* Card body */}
        <div className="bg-[#1A1A1A] border border-gray-700 rounded-xl p-4 relative">
          {/* AI bot badge — appears when AI Sales Assistant is enabled */}
          {aiEnabled && (
            <div
              className="absolute bottom-3 right-3 bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-full p-1.5"
              title="AI Sales Assistant enabled"
            >
              <Bot className="w-4 h-4 text-[#FFCC00]" />
            </div>
          )}

          {/* Service name */}
          <h4
            className="text-lg font-bold text-white mb-2 break-words"
            title={formData.serviceName || "Service Name"}
          >
            {formData.serviceName || "Service Name"}
          </h4>

          {/* Description */}
          {formData.description ? (
            <p className="text-sm text-gray-400 mb-3 line-clamp-3 whitespace-pre-line">
              {sanitizeDescription(formData.description)}
            </p>
          ) : (
            <p className="text-sm text-gray-600 italic mb-3">
              Description will appear here
            </p>
          )}

          {/* Category badge */}
          {categoryLabel && (
            <div className="mb-3">
              <span className="text-xs bg-[#FFCC00]/10 border border-[#FFCC00]/30 text-[#FFCC00] px-2 py-1 rounded-full">
                {categoryLabel}
              </span>
            </div>
          )}

          {/* Price + duration row */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-green-500">
              <DollarSign className="w-4 h-4" />
              <span className="font-semibold">
                {formData.priceUsd ? formData.priceUsd.toFixed(2) : "0.00"}
              </span>
            </div>
            {formData.durationMinutes ? (
              <div className="flex items-center gap-1 text-gray-400">
                <Clock className="w-4 h-4" />
                <span>{formData.durationMinutes} mins</span>
              </div>
            ) : null}
          </div>

          {/* Tags */}
          {formData.tags && formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full max-w-[100px] truncate"
                  title={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
