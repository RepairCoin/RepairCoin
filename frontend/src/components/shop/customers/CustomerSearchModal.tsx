"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, User, Loader2 } from "lucide-react";

interface CustomerSearchResult {
  address: string;
  name?: string;
  profile_image_url?: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetime_earnings: number;
  last_transaction_date?: string;
  total_transactions: number;
  isActive: boolean;
  suspended?: boolean;
}

interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (address: string, name?: string) => void;
}

// Helper function to truncate wallet address
const truncateAddress = (address: string): string => {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Helper function to get tier badge styles
const getTierBadgeStyles = (tier: "BRONZE" | "SILVER" | "GOLD") => {
  switch (tier) {
    case "GOLD":
      return "bg-[#F7B500] text-black";
    case "SILVER":
      return "bg-[#6B7280] text-white";
    case "BRONZE":
      return "bg-[#CD7F32] text-white";
    default:
      return "bg-gray-500 text-white";
  }
};

export default function CustomerSearchModal({
  isOpen,
  onClose,
  onSelectCustomer,
}: CustomerSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api";

  // Auto-focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Search customers with debounce
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If search query is empty, reset results
    if (!searchQuery.trim()) {
      setCustomers([]);
      setHasSearched(false);
      return;
    }

    // Debounce search by 300ms
    debounceTimerRef.current = setTimeout(() => {
      searchCustomers(searchQuery);
    }, 300);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const searchCustomers = async (query: string) => {
    setLoading(true);
    setHasSearched(true);

    try {
      const response = await fetch(
        `${API_URL}/customers?search=${encodeURIComponent(query)}&page=1&limit=20`,
        {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to search customers: ${response.status}`);
      }

      const data = await response.json();
      setCustomers(data.data?.customers || []);
    } catch (error) {
      console.error("Error searching customers:", error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = (customer: CustomerSearchResult) => {
    onSelectCustomer(customer.address, customer.name);
    // Reset modal state
    setSearchQuery("");
    setCustomers([]);
    setHasSearched(false);
    onClose();
  };

  const handleClose = () => {
    // Reset modal state
    setSearchQuery("");
    setCustomers([]);
    setHasSearched(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[#212121] border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Search Customers</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-6 border-b border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name..."
              className="w-full pl-10 pr-4 py-3 bg-[#2a2a2a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="space-y-4">
              {/* Loading skeleton cards */}
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-[#2a2a2a] border border-gray-700 rounded-lg p-4 animate-pulse"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-700 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-700 rounded w-1/3" />
                      <div className="h-3 bg-gray-700 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !hasSearched && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="w-16 h-16 text-gray-600 mb-4" />
              <p className="text-gray-400 text-lg">
                Start typing to search for customers
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Search by customer name to find their wallet address
              </p>
            </div>
          )}

          {!loading && hasSearched && customers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="w-16 h-16 text-gray-600 mb-4" />
              <p className="text-gray-400 text-lg">No customers found</p>
              <p className="text-gray-500 text-sm mt-2">
                Try searching with a different name
              </p>
            </div>
          )}

          {!loading && customers.length > 0 && (
            <div className="space-y-3">
              {customers.map((customer) => {
                const customerName = customer.name || "Anonymous Customer";
                const customerInitial = customer.name
                  ? customer.name.charAt(0).toUpperCase()
                  : "?";

                return (
                  <button
                    key={customer.address}
                    onClick={() => handleSelectCustomer(customer)}
                    className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg p-4 hover:border-gray-600 hover:bg-[#323232] transition-all duration-200 text-left group"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                        {customer.profile_image_url ? (
                          <img
                            src={customer.profile_image_url}
                            alt={customerName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                            {customerInitial}
                          </div>
                        )}
                      </div>

                      {/* Customer details */}
                      <div className="flex-1 min-w-0">
                        {/* Name and tier badge */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold text-white text-base truncate">
                            {customerName}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getTierBadgeStyles(
                              customer.tier
                            )}`}
                          >
                            {customer.tier}
                          </span>
                        </div>

                        {/* Wallet address */}
                        <code className="text-gray-400 text-sm font-mono">
                          {truncateAddress(customer.address)}
                        </code>
                      </div>

                      {/* Lifetime earnings */}
                      <div className="flex-shrink-0 text-right">
                        <p className="text-gray-400 text-xs mb-1">
                          Lifetime RCN
                        </p>
                        <p className="text-white font-bold text-lg">
                          {customer.lifetime_earnings.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Hover indicator */}
                    <div className="mt-2 text-blue-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to select customer
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with results count */}
        {customers.length > 0 && !loading && (
          <div className="p-4 border-t border-gray-700 bg-[#1a1a1a]">
            <p className="text-gray-400 text-sm text-center">
              Found {customers.length} customer{customers.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
