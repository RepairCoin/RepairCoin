/**
 * AI Chat Assistant - Image Uploader
 * Drag-and-drop image upload component
 */

'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
  disabled?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];

        // Validate file type
        if (!file.type.startsWith('image/')) {
          alert('Please upload an image file');
          return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert('Image size must be less than 10MB');
          return;
        }

        onImageUpload(file);
      }
    },
    [onImageUpload, disabled]
  );

  return (
    <div className="px-4 pb-4">
      <motion.div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        animate={{
          borderColor: isDragging ? '#3B82F6' : '#E5E7EB',
          backgroundColor: isDragging ? '#EFF6FF' : '#F9FAFB',
        }}
        className={`
          border-2 border-dashed rounded-lg p-6
          transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div className="text-center">
          <div className="text-4xl mb-2">📷</div>
          <div className="text-sm font-medium text-gray-700 mb-1">
            {isDragging ? 'Drop image here' : 'Click to upload or drag & drop'}
          </div>
          <div className="text-xs text-gray-500">
            For best results, use clear, well-lit photos
          </div>
          <div className="text-xs text-gray-400 mt-1">
            PNG, JPG, GIF up to 10MB
          </div>
        </div>
      </motion.div>
    </div>
  );
};
