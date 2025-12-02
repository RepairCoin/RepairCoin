"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { SERVICE_CATEGORIES, ServiceCategory } from "@/services/api/services";

export type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'rating_desc' | 'oldest';

export interface FilterState {
  category?: ServiceCategory;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: SortOption;
}

interface ServiceFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onReset: () => void;
}

export const ServiceFilters: React.FC<ServiceFiltersProps> = ({
  filters,
  onFilterChange,
  onReset,
}) => {
  const handleSearchChange = (value: string) => {
    onFilterChange({ ...filters, search: value });
  };

  const handleCategoryChange = (value: string) => {
    onFilterChange({
      ...filters,
      category: value ? (value as ServiceCategory) : undefined,
    });
  };

  const handleMinPriceChange = (value: string) => {
    const numValue = value ? parseFloat(value) : undefined;
    onFilterChange({ ...filters, minPrice: numValue });
  };

  const handleMaxPriceChange = (value: string) => {
    const numValue = value ? parseFloat(value) : undefined;
    onFilterChange({ ...filters, maxPrice: numValue });
  };

  const handleSortChange = (value: string) => {
    onFilterChange({
      ...filters,
      sortBy: value ? (value as SortOption) : undefined,
    });
  };

  const hasActiveFilters = filters.category || filters.search || filters.minPrice || filters.maxPrice || filters.sortBy;

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search Bar */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={filters.search || ""}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search services..."
          className="w-full bg-[#1A1A1A] border border-gray-800 rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50 transition-colors"
        />
      </div>

      {/* Category */}
      <select
        value={filters.category || ""}
        onChange={(e) => handleCategoryChange(e.target.value)}
        className="bg-[#1A1A1A] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFCC00]/50 transition-colors cursor-pointer min-w-[140px]"
      >
        <option value="">All Categories</option>
        {SERVICE_CATEGORIES.map((cat) => (
          <option key={cat.value} value={cat.value}>
            {cat.label}
          </option>
        ))}
      </select>

      {/* Sort By */}
      <select
        value={filters.sortBy || "newest"}
        onChange={(e) => handleSortChange(e.target.value)}
        className="bg-[#1A1A1A] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFCC00]/50 transition-colors cursor-pointer min-w-[150px]"
      >
        <option value="newest">Newest First</option>
        <option value="rating_desc">Highest Rated</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
        <option value="oldest">Oldest First</option>
      </select>

      {/* Price Range */}
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          value={filters.minPrice || ""}
          onChange={(e) => handleMinPriceChange(e.target.value)}
          placeholder="Min $"
          className="w-20 bg-[#1A1A1A] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50 transition-colors"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={filters.maxPrice || ""}
          onChange={(e) => handleMaxPriceChange(e.target.value)}
          placeholder="Max $"
          className="w-20 bg-[#1A1A1A] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50 transition-colors"
        />
      </div>

      {/* Reset Button */}
      {hasActiveFilters && (
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 bg-gray-800 text-gray-300 text-sm px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          title="Clear filters"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      )}
    </div>
  );
};
