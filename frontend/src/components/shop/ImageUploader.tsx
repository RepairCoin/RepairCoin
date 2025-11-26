"use client";

import React, { useState, useRef, ChangeEvent } from "react";
import { toast } from "react-hot-toast";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";

interface ImageUploaderProps {
  /**
   * Current image URL (if any)
   */
  currentImageUrl?: string;

  /**
   * Type of image being uploaded (logo, service, banner)
   */
  imageType: "logo" | "service" | "banner";

  /**
   * Callback when upload succeeds
   */
  onUploadSuccess: (url: string, key: string) => void;

  /**
   * Callback when image is removed
   */
  onRemove?: () => void;

  /**
   * Label for the uploader
   */
  label?: string;

  /**
   * Show preview of current image
   */
  showPreview?: boolean;

  /**
   * Custom className for container
   */
  className?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  currentImageUrl,
  imageType,
  onUploadSuccess,
  onRemove,
  label,
  showPreview = true,
  className = "",
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentImageUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.");
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("File size exceeds 5MB limit.");
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      // Determine endpoint based on image type
      const endpoint = `/api/upload/${
        imageType === "logo"
          ? "shop-logo"
          : imageType === "service"
          ? "service-image"
          : "shop-banner"
      }`;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Upload failed");
      }

      toast.success("Image uploaded successfully!");
      onUploadSuccess(result.url, result.key);
      setPreviewUrl(result.url);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
      setPreviewUrl(currentImageUrl); // Reset to current image
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    setPreviewUrl(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onRemove?.();
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-300">
          {label}
        </label>
      )}

      <div className="relative">
        {/* Preview Area */}
        {showPreview && previewUrl ? (
          <div className="relative group">
            <div
              className={`relative overflow-hidden rounded-lg bg-gray-800 border-2 border-gray-700 ${
                imageType === "banner"
                  ? "w-full h-48"
                  : imageType === "logo"
                  ? "w-32 h-32"
                  : "w-full h-64"
              }`}
            >
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleClick}
                  disabled={uploading}
                  className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700] transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 inline mr-2" />
                      Change
                    </>
                  )}
                </button>

                {onRemove && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={uploading}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4 inline mr-2" />
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Upload Button */
          <button
            type="button"
            onClick={handleClick}
            disabled={uploading}
            className={`relative flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-lg hover:border-[#FFCC00]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              imageType === "banner"
                ? "w-full h-48"
                : imageType === "logo"
                ? "w-32 h-32"
                : "w-full h-64"
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin mb-2" />
                <span className="text-sm text-gray-400">Uploading...</span>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-3">
                  <ImageIcon className="w-8 h-8 text-gray-500" />
                </div>
                <span className="text-sm font-medium text-gray-300 mb-1">
                  Click to upload {imageType}
                </span>
                <span className="text-xs text-gray-500">
                  JPEG, PNG, GIF, WebP (max 5MB)
                </span>
              </>
            )}
          </button>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
      </div>

      {/* File requirements */}
      <p className="text-xs text-gray-500">
        {imageType === "logo" && "Recommended: 200x200px square logo"}
        {imageType === "service" && "Recommended: 800x600px service image"}
        {imageType === "banner" && "Recommended: 1200x400px banner image"}
      </p>
    </div>
  );
};
