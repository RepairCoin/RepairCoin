"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Called when page changes */
  onPageChange: (page: number) => void;
  /** Whether pagination is disabled (e.g., during loading) */
  disabled?: boolean;
  /** Maximum number of page buttons to show */
  maxVisiblePages?: number;
  /** Whether to show page numbers or just prev/next */
  showPageNumbers?: boolean;
}

/**
 * Reusable pagination component
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  maxVisiblePages = 5,
  showPageNumbers = true,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Calculate visible page numbers
  const getVisiblePages = (): number[] => {
    const pages: number[] = [];
    const half = Math.floor(maxVisiblePages / 2);

    let start = Math.max(1, currentPage - half);
    const end = Math.min(totalPages, start + maxVisiblePages - 1);

    // Adjust start if we're near the end
    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-800">
      {/* Previous Button */}
      <button
        onClick={handlePrevious}
        disabled={currentPage === 1 || disabled}
        className="flex items-center gap-1 px-3 py-1.5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </button>

      {/* Page Numbers */}
      {showPageNumbers && (
        <div className="flex items-center gap-1">
          {getVisiblePages().map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              disabled={disabled}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-all duration-200 ${
                currentPage === page
                  ? "bg-[#1e1f22] text-white border border-gray-600"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      )}

      {/* Page indicator for non-numbered mode */}
      {!showPageNumbers && (
        <span className="text-gray-400 text-sm">
          Page {currentPage} of {totalPages}
        </span>
      )}

      {/* Next Button */}
      <button
        onClick={handleNext}
        disabled={currentPage === totalPages || disabled}
        className="flex items-center gap-1 px-3 py-1.5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
