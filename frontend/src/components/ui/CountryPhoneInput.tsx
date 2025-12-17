"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  Country,
  fetchCountries,
  parsePhoneString,
  validatePhone,
  formatPhoneForStorage,
  findCountryByCode,
} from "@/services/countryService";
import { cn } from "@/lib/utils";

interface CountryPhoneInputProps {
  value: string;
  onChange: (phone: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const CountryPhoneInput: React.FC<CountryPhoneInputProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = "Enter phone number",
  className,
}) => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [localNumber, setLocalNumber] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load countries on mount
  useEffect(() => {
    const loadCountries = async () => {
      setIsLoading(true);
      const data = await fetchCountries();
      setCountries(data);

      // Parse initial value
      if (value && data.length > 0) {
        const parsed = parsePhoneString(value, data);
        setSelectedCountry(parsed.country || findCountryByCode("US", data) || data[0]);
        setLocalNumber(parsed.localNumber);
      } else if (data.length > 0) {
        // Default to US
        setSelectedCountry(findCountryByCode("US", data) || data[0]);
      }

      setIsLoading(false);
    };

    loadCountries();
  }, []);

  // Parse value changes from parent
  useEffect(() => {
    if (countries.length > 0 && value) {
      const parsed = parsePhoneString(value, countries);
      if (parsed.country && parsed.country.code !== selectedCountry?.code) {
        setSelectedCountry(parsed.country);
      }
      if (parsed.localNumber !== localNumber) {
        setLocalNumber(parsed.localNumber);
      }
    }
  }, [value, countries]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchQuery("");

    // Update parent with new formatted phone
    const formatted = formatPhoneForStorage(country.dialCode, localNumber);
    onChange(formatted);
  };

  const handleLocalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Allow only digits, spaces, dashes, and parentheses for formatting
    const cleanValue = inputValue.replace(/[^\d\s\-()]/g, "");
    setLocalNumber(cleanValue);

    // Validate
    const validation = validatePhone(cleanValue);
    setError(validation.error);

    // Update parent
    if (selectedCountry) {
      const formatted = formatPhoneForStorage(selectedCountry.dialCode, cleanValue);
      onChange(formatted);
    }
  };

  const filteredCountries = countries.filter(
    (country) =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      country.dialCode.includes(searchQuery) ||
      country.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className={cn("w-full", className)}>
        <div className="w-full h-[50px] bg-[#2F2F2F] rounded-xl animate-pulse border border-gray-300" />
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Single unified input container - matches neighbor input styling exactly */}
      <div className="relative w-full">
        <div
          className={cn(
            "w-full flex items-center border border-gray-300 bg-[#2F2F2F] text-white rounded-xl transition-all",
            "focus-within:ring-2 focus-within:ring-[#FFCC00] focus-within:border-transparent",
            error && "border-red-500 focus-within:ring-red-500"
          )}
        >
          {/* Country Selector Button */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => !disabled && setIsOpen(!isOpen)}
              disabled={disabled}
              className="flex items-center gap-2 px-4 py-3 text-white border-r border-gray-300 transition-colors"
            >
              {selectedCountry && (
                <>
                  <span className="text-lg">{selectedCountry.flag}</span>
                  <span className="text-sm text-gray-300">{selectedCountry.dialCode}</span>
                </>
              )}
              <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
            </button>

            {/* Dropdown */}
            {isOpen && (
              <div className="absolute left-0 z-50 mt-1 w-72 max-h-80 overflow-hidden bg-[#2F2F2F] border border-gray-300 rounded-xl shadow-lg">
                {/* Search */}
                <div className="p-2 border-b border-gray-300">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search countries..."
                      className="w-full pl-9 pr-3 py-2 bg-[#1a1a1a] text-white text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus-within:ring-[#FFCC00] focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Country List */}
                <div className="max-h-60 overflow-y-auto">
                  {filteredCountries.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400">No countries found</div>
                  ) : (
                    filteredCountries.map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => handleCountrySelect(country)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#3a3a3a] transition-colors",
                          selectedCountry?.code === country.code && "bg-[#3a3a3a]"
                        )}
                      >
                        <span className="text-lg">{country.flag}</span>
                        <span className="flex-1 text-sm text-white truncate">{country.name}</span>
                        <span className="text-sm text-gray-400">{country.dialCode}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Phone Number Input */}
          <input
            type="tel"
            value={localNumber}
            onChange={handleLocalNumberChange}
            disabled={disabled}
            placeholder={placeholder}
            className="flex-1 w-full px-4 py-3 bg-transparent text-white outline-none"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
    </div>
  );
};
