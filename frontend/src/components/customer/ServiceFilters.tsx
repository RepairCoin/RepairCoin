"use client";

import React, { useState } from "react";
import { X, MapPin, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { SERVICE_CATEGORIES, ServiceCategory } from "@/services/api/services";
import { AutocompleteSearch } from "./AutocompleteSearch";

export type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'rating_desc' | 'oldest';

export interface FilterState {
  category?: ServiceCategory;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: SortOption;
  city?: string;
  state?: string;
  zipCode?: string;
  distance?: number; // in miles
  shopId?: string; // For filtering by specific shop
}

interface ServiceFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onReset: () => void;
  onSelectService?: (serviceId: string) => void;
}

export const ServiceFilters: React.FC<ServiceFiltersProps> = ({
  filters,
  onFilterChange,
  onReset,
  onSelectService,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Local state for slider - synced with filters
  const [priceRange, setPriceRange] = useState<[number, number]>([
    filters.minPrice || 0,
    filters.maxPrice || 500
  ]);

  // Sync priceRange when filters change externally (e.g., reset)
  React.useEffect(() => {
    setPriceRange([
      filters.minPrice || 0,
      filters.maxPrice || 500
    ]);
  }, [filters.minPrice, filters.maxPrice]);

  const handleCategoryChange = (value: string) => {
    onFilterChange({
      ...filters,
      category: value ? (value as ServiceCategory) : undefined,
    });
  };

  const handlePriceRangeChange = (min: number, max: number) => {
    setPriceRange([min, max]);
    onFilterChange({
      ...filters,
      // Always send the values - let backend handle filtering
      minPrice: min > 0 ? min : undefined,
      maxPrice: max // Always send maxPrice, don't skip at 500
    });
  };

  const handleMinPriceChange = (value: string) => {
    const numValue = value ? parseFloat(value) : undefined;
    // Update both filter state and slider state
    const newMin = numValue || 0;
    setPriceRange([newMin, priceRange[1]]);
    onFilterChange({ ...filters, minPrice: numValue });
  };

  const handleMaxPriceChange = (value: string) => {
    const numValue = value ? parseFloat(value) : undefined;
    // Update both filter state and slider state
    const newMax = numValue || 500;
    setPriceRange([priceRange[0], newMax]);
    onFilterChange({ ...filters, maxPrice: numValue });
  };

  const handleSortChange = (value: string) => {
    onFilterChange({
      ...filters,
      sortBy: value ? (value as SortOption) : undefined,
    });
  };

  const handleCityChange = (value: string) => {
    onFilterChange({ ...filters, city: value || undefined });
  };

  const handleStateChange = (value: string) => {
    onFilterChange({ ...filters, state: value || undefined });
  };

  const hasActiveFilters = filters.category || filters.search || filters.minPrice || filters.maxPrice || filters.sortBy || filters.city || filters.state;

  return (
    <div className="flex flex-col gap-4">
      {/* Main Filter Row */}
      <div className="flex flex-col gap-3">
        {/* Search - full width on all screens */}
        <div className="w-full">
          <AutocompleteSearch
            onSelectService={onSelectService || (() => {})}
            placeholder="Search services or shops..."
          />
        </div>

        {/* Dropdowns + Buttons Row */}
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3">
          {/* Category */}
          <select
            value={filters.category || ""}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="bg-[#1A1A1A] border border-gray-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#FFCC00] appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10 cursor-pointer transition-colors w-full sm:min-w-[140px]"
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
            className="bg-[#1A1A1A] border border-gray-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#FFCC00] appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10 cursor-pointer transition-colors w-full sm:min-w-[150px]"
          >
            <option value="newest">Newest First</option>
            <option value="rating_desc">Highest Rated</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="oldest">Oldest First</option>
          </select>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-center gap-2 bg-[#1A1A1A] border border-gray-800 text-white text-sm px-4 py-3 rounded-lg hover:border-[#FFCC00]/50 transition-colors"
          >
            <span>Filters</span>
            <span className="flex-1" />
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Reset Button */}
          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="flex items-center justify-center gap-1.5 bg-[#1A1A1A] border border-gray-800 text-white text-sm px-3 py-3 rounded-lg hover:bg-gray-700 transition-colors"
              title="Clear filters"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4 sm:p-6 space-y-5 sm:space-y-6 animate-slideDown">
          {/* Price Range Slider */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-[#FFCC00]" />
              <label className="text-sm font-semibold text-white">Price Range</label>
            </div>
            <div className="space-y-3">
              {/* Price Range Display */}
              <div className="flex items-center justify-between text-sm text-gray-400">
                <span>${priceRange[0]}</span>
                <span>${priceRange[1]}{priceRange[1] >= 500 ? '+' : ''}</span>
              </div>
              {/* Dual Range Slider - stacked on mobile, side-by-side on desktop */}
              <div className="relative pt-1">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block sm:hidden">Min Price</label>
                    <input
                      type="range"
                      min="0"
                      max="500"
                      step="10"
                      value={priceRange[0]}
                      onChange={(e) => {
                        const newMin = parseInt(e.target.value);
                        if (newMin <= priceRange[1]) {
                          handlePriceRangeChange(newMin, priceRange[1]);
                        }
                      }}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#FFCC00]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block sm:hidden">Max Price</label>
                    <input
                      type="range"
                      min="0"
                      max="500"
                      step="10"
                      value={priceRange[1]}
                      onChange={(e) => {
                        const newMax = parseInt(e.target.value);
                        if (newMax >= priceRange[0]) {
                          handlePriceRangeChange(priceRange[0], newMax);
                        }
                      }}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#FFCC00]"
                    />
                  </div>
                </div>
              </div>
              {/* Manual Price Inputs */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 items-center">
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={filters.minPrice || ""}
                  onChange={(e) => handleMinPriceChange(e.target.value)}
                  placeholder="Min $"
                  className="w-full bg-[#111] border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-gray-600 text-sm px-1">to</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={filters.maxPrice || ""}
                  onChange={(e) => handleMaxPriceChange(e.target.value)}
                  placeholder="Max $"
                  className="w-full bg-[#111] border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
          </div>

          {/* Location Filters */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-[#FFCC00]" />
              <label className="text-sm font-semibold text-white">Location</label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={filters.city || ""}
                onChange={(e) => handleCityChange(e.target.value)}
                placeholder="City"
                className="bg-[#111] border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50 transition-colors"
              />
              <input
                type="text"
                value={filters.state || ""}
                onChange={(e) => handleStateChange(e.target.value)}
                placeholder="State"
                className="bg-[#111] border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50 transition-colors"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
