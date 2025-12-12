"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, TrendingUp } from "lucide-react";
import { autocompleteSearch, AutocompleteSuggestion } from "@/services/api/services";
import Image from "next/image";

interface AutocompleteSearchProps {
  onSelectService: (serviceId: string) => void;
  placeholder?: string;
}

export const AutocompleteSearch: React.FC<AutocompleteSearchProps> = ({
  onSelectService,
  placeholder = "Search services, shops..."
}) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length >= 2) {
      setLoading(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await autocompleteSearch(query);
          console.log('Autocomplete results:', results); // Debug log
          setSuggestions(results);
          setLoading(false);
          setShowDropdown(results.length > 0); // Only show if there are results
          setHighlightedIndex(-1);
        } catch (error) {
          console.error('Autocomplete error:', error);
          setLoading(false);
          setShowDropdown(false);
        }
      }, 300);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const handleSelectSuggestion = (suggestion: AutocompleteSuggestion) => {
    setQuery(suggestion.serviceName);
    setShowDropdown(false);
    onSelectService(suggestion.serviceId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        break;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
          {loading ? (
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full bg-[#1A1A1A] border border-gray-800 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50 transition-colors"
        />
      </div>

      {/* Dropdown Suggestions */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-[9999] w-full mt-2 bg-[#1A1A1A] border border-gray-800 rounded-xl shadow-2xl max-h-96 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.serviceId}
              onClick={() => handleSelectSuggestion(suggestion)}
              className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800/50 transition-colors ${
                index === highlightedIndex ? "bg-gray-800/50" : ""
              } ${index === 0 ? "rounded-t-xl" : ""} ${
                index === suggestions.length - 1 ? "rounded-b-xl" : ""
              }`}
            >
              {/* Service Image */}
              {suggestion.imageUrl ? (
                <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                  <Image
                    src={suggestion.imageUrl}
                    alt={suggestion.serviceName}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-gray-600" />
                </div>
              )}

              {/* Service Info */}
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium line-clamp-1">
                    {suggestion.serviceName}
                  </p>
                  <span className="text-[#FFCC00] font-semibold text-sm">
                    {formatPrice(suggestion.priceUsd)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                  <span>{suggestion.shopName}</span>
                  {suggestion.location && (
                    <>
                      <span>•</span>
                      <span>{suggestion.location}</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {showDropdown && !loading && query.length >= 2 && suggestions.length === 0 && (
        <div className="absolute z-[9999] w-full mt-2 bg-[#1A1A1A] border border-gray-800 rounded-xl shadow-2xl p-4">
          <p className="text-gray-400 text-center text-sm">
            No services found for "{query}"
          </p>
        </div>
      )}
    </div>
  );
};
