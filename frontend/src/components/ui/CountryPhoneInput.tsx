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
  version?: 'UPDATES2';
}

// Style variants
const styles = {
  default: {
    skeleton: "bg-[#2F2F2F] border-gray-300",
    container: "border-gray-300 bg-[#2F2F2F] text-white",
    button: "text-white border-r border-gray-300",
    dialCode: "text-gray-300",
    dropdown: "bg-[#2F2F2F] border-gray-300",
    searchBorder: "border-gray-300",
    searchInput: "bg-[#1a1a1a] text-white border-gray-300",
    searchIcon: "text-gray-400",
    countryHover: "hover:bg-[#3a3a3a]",
    countrySelected: "bg-[#3a3a3a]",
    countryName: "text-white",
    countryDialCode: "text-gray-400",
    noResults: "text-gray-400",
    phoneInput: "text-white placeholder:text-gray-500",
    scrollbar: { scrollbarWidth: 'thin' as const, scrollbarColor: '#4a4a4a #2F2F2F' },
  },
  UPDATES2: {
    skeleton: "bg-[#F6F8FA] border-[#3F3F3F]",
    container: "border-[#3F3F3F] bg-[#F6F8FA] text-[#24292F]",
    button: "text-[#24292F] border-r border-[#3F3F3F]",
    dialCode: "text-[#24292F]",
    dropdown: "bg-[#F6F8FA] border-[#3F3F3F]",
    searchBorder: "border-[#3F3F3F]",
    searchInput: "bg-white text-[#24292F] border-[#3F3F3F]",
    searchIcon: "text-gray-500",
    countryHover: "hover:bg-[#E8EAED]",
    countrySelected: "bg-[#E8EAED]",
    countryName: "text-[#24292F]",
    countryDialCode: "text-gray-500",
    noResults: "text-gray-500",
    phoneInput: "text-[#24292F] placeholder:text-gray-500",
    scrollbar: { scrollbarWidth: 'thin' as const, scrollbarColor: '#D0D7DE #F6F8FA' },
  },
};

export const CountryPhoneInput: React.FC<CountryPhoneInputProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = "Enter phone number",
  className,
  version,
}) => {
  const theme = version ? styles[version] : styles.default;
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [localNumber, setLocalNumber] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Track the previous value to detect external changes
  const prevValueRef = useRef<string | null>(null);

  // Load countries on mount
  useEffect(() => {
    const loadCountries = async () => {
      setIsLoading(true);
      const data = await fetchCountries();
      setCountries(data);
      setIsLoading(false);
    };

    loadCountries();
  }, []);

  // Parse value when countries load or value changes from parent
  useEffect(() => {
    if (countries.length === 0) return;

    // Only parse if:
    // 1. This is the first time (prevValueRef.current is null), OR
    // 2. The value changed externally (different from what we'd generate)
    const shouldParse = prevValueRef.current === null ||
      (value !== prevValueRef.current && value !== formatPhoneForStorage(selectedCountry?.dialCode || "", localNumber));

    if (shouldParse) {
      if (value) {
        const parsed = parsePhoneString(value, countries);
        setSelectedCountry(parsed.country || findCountryByCode("US", countries) || countries[0]);
        setLocalNumber(parsed.localNumber);
        prevValueRef.current = value;
      } else {
        // Default to US when no value
        setSelectedCountry(findCountryByCode("US", countries) || countries[0]);
        setLocalNumber("");
        prevValueRef.current = "";
      }
    }
  }, [countries, value, selectedCountry, localNumber]);

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
        <div className={cn("w-full h-[50px] rounded-xl animate-pulse border", theme.skeleton)} />
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Single unified input container - matches neighbor input styling exactly */}
      <div className="relative w-full">
        <div
          className={cn(
            "w-full flex items-center border rounded-xl transition-all",
            theme.container,
            "focus-within:outline-none focus-within:ring-2 focus-within:ring-[#FFCC00] focus-within:border-transparent",
            error && "border-red-500 focus-within:ring-red-500"
          )}
        >
          {/* Country Selector Button */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => !disabled && setIsOpen(!isOpen)}
              disabled={disabled}
              className={cn("flex items-center gap-2 px-4 py-3 transition-colors", theme.button)}
            >
              {selectedCountry && (
                <>
                  <span className="text-lg">{selectedCountry.flag}</span>
                  <span className={cn("text-sm", theme.dialCode)}>{selectedCountry.dialCode}</span>
                </>
              )}
              <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
            </button>

            {/* Dropdown */}
            {isOpen && (
              <div className={cn("absolute left-0 z-50 mt-1 w-72 max-h-80 overflow-hidden border rounded-xl shadow-lg", theme.dropdown)}>
                {/* Search */}
                <div className={cn("p-2 border-b", theme.searchBorder)}>
                  <div className="relative">
                    <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", theme.searchIcon)} />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search countries..."
                      className={cn("w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent", theme.searchInput)}
                    />
                  </div>
                </div>

                {/* Country List */}
                <div
                  className="max-h-60 overflow-y-auto"
                  style={theme.scrollbar}
                >
                  {filteredCountries.length === 0 ? (
                    <div className={cn("px-4 py-3 text-sm", theme.noResults)}>No countries found</div>
                  ) : (
                    filteredCountries.map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => handleCountrySelect(country)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          theme.countryHover,
                          selectedCountry?.code === country.code && theme.countrySelected
                        )}
                      >
                        <span className="text-lg">{country.flag}</span>
                        <span className={cn("flex-1 text-sm truncate", theme.countryName)}>{country.name}</span>
                        <span className={cn("text-sm", theme.countryDialCode)}>{country.dialCode}</span>
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
            className={cn("flex-1 w-full px-4 py-3 bg-transparent outline-none", theme.phoneInput)}
          />
        </div>
      </div>

      {/* Error Message */}
      {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
    </div>
  );
};
