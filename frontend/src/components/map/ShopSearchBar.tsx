"use client";

import { Search, X } from "lucide-react";

interface ShopSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  placeholder?: string;
}

export function ShopSearchBar({
  value,
  onChange,
  resultCount,
  placeholder = "Search shops by name or address...",
}: ShopSearchBarProps) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        <Search className="w-4 h-4 text-gray-500" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl pl-10 pr-10 py-2.5
          text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#FFCC00]/50
          transition-colors"
      />
      {value && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <span className="text-[11px] text-gray-500">{resultCount} found</span>
          <button
            onClick={() => onChange("")}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
