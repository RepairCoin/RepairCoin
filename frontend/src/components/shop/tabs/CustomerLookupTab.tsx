"use client";

import { LookupIcon } from "@/components/icon";
import React, { useState, useRef, useEffect } from "react";
import QrScanner from "qr-scanner";
import { Camera, X, ScanLine, Search, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import CustomerCard from "@/components/shop/customers/CustomerCard";

// Search result from API
interface CustomerSearchResult {
  address: string;
  name?: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetime_earnings: number;
  last_transaction_date?: string;
  total_transactions: number;
  isActive: boolean;
  suspended?: boolean;
}

// Search state
interface SearchState {
  query: string;
  results: CustomerSearchResult[];
  totalResults: number;
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
}

interface CustomerLookupTabProps {
  shopId: string;
}

export const CustomerLookupTab: React.FC<CustomerLookupTabProps> = ({
  shopId,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({
    query: "",
    results: [],
    totalResults: 0,
    isLoading: false,
    error: null,
    hasSearched: false,
  });
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const searchCustomers = async (query?: string) => {
    const searchTerm = query ?? searchQuery;

    if (!searchTerm.trim()) {
      setSearchState(prev => ({
        ...prev,
        error: "Please enter a customer name or wallet address",
        hasSearched: true,
      }));
      return;
    }

    setSearchState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Use /api/customers endpoint to search ALL customers (not just shop-specific)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/customers?search=${encodeURIComponent(searchTerm)}&page=1&limit=50`,
        {
          credentials: "include", // Send HTTP-only cookies for auth
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to search customers");
      }

      const data = await response.json();

      // Map the response to our expected format
      const customers = (data.data.customers || []).map((c: {
        address: string;
        name?: string;
        tier?: string;
        lifetimeEarnings?: number;
        currentBalance?: number;
        lastEarnedDate?: string;
        isActive?: boolean;
      }) => ({
        address: c.address,
        name: c.name,
        tier: c.tier || "BRONZE",
        lifetime_earnings: c.lifetimeEarnings || 0,
        last_transaction_date: c.lastEarnedDate,
        total_transactions: 0,
        isActive: c.isActive !== false,
        suspended: false,
      }));

      setSearchState({
        query: searchTerm,
        results: customers,
        totalResults: data.data.pagination?.total || customers.length,
        isLoading: false,
        error: null,
        hasSearched: true,
      });
    } catch (error) {
      console.error("Search error:", error);
      setSearchState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to search customers",
        hasSearched: true,
      }));
    }
  };

  const handleViewProfile = (address: string) => {
    // For now, we could open a modal or navigate to a details view
    // This can be enhanced later with a CustomerDetailsModal
    toast.success(`Viewing profile for ${address.slice(0, 6)}...${address.slice(-4)}`);
    // TODO: Open CustomerDetailsModal or navigate to details page
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Wallet address copied!");
  };

  const startQRScanner = async () => {
    try {
      setShowQRScanner(true);
      if (videoRef.current) {
        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            const scannedText = result.data;
            // Check if it's a valid Ethereum address
            const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
            if (ethAddressRegex.test(scannedText)) {
              setSearchQuery(scannedText);
              stopQRScanner();
              toast.success("Wallet address scanned successfully!");
              // Auto-search with the scanned address
              setTimeout(() => {
                searchCustomers(scannedText);
              }, 500);
            } else {
              toast.error("Invalid wallet address in QR code");
            }
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
          }
        );

        setQrScanner(scanner);
        await scanner.start();
      }
    } catch (error) {
      console.error("Error starting QR scanner:", error);
      toast.error("Failed to start camera. Please check permissions.");
      setShowQRScanner(false);
    }
  };

  const stopQRScanner = () => {
    if (qrScanner) {
      qrScanner.stop();
      qrScanner.destroy();
      setQrScanner(null);
    }
    setShowQRScanner(false);
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
      }
    };
  }, [qrScanner]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchCustomers();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-[#212121] rounded-3xl">
        {/* Header */}
        <div
          className="w-full flex gap-2 px-4 md:px-8 py-4 text-white rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <LookupIcon width={24} height={24} color={"black"} />
          <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
            Customer Lookup
          </p>
        </div>

        {/* Search Input */}
        <div className="flex flex-col sm:flex-row gap-4 px-4 md:px-8 py-6 border-gray-700">
          <div className="w-full flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter customer name or wallet address..."
                className="w-full px-4 py-3 bg-[#2F2F2F] text-white rounded-xl transition-all pl-10 pr-4 focus:ring-2 focus:ring-[#FFCC00] focus:outline-none"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            </div>

            <button
              onClick={startQRScanner}
              disabled={searchState.isLoading}
              className="px-4 py-3 bg-[#2F2F2F] border border-gray-600 text-white hover:bg-[#3F3F3F] font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              title="Scan customer's QR code"
            >
              <Camera className="w-5 h-5" />
              <span className="hidden sm:inline">Scan QR</span>
            </button>
          </div>

          <button
            onClick={() => searchCustomers()}
            disabled={searchState.isLoading || !searchQuery.trim()}
            className="px-8 py-3 bg-[#FFCC00] text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-yellow-500/25 transform hover:scale-105 flex items-center justify-center gap-2"
          >
            {searchState.isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Search
              </>
            )}
          </button>
        </div>

        {/* Error Display */}
        {searchState.error && (
          <div className="px-4 md:px-8 pb-4">
            <div className="bg-red-900 bg-opacity-20 border border-red-500 rounded-xl p-4">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-red-500 mr-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-red-400">{searchState.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        <div className="px-4 md:px-8 pb-6">
          {/* Results Header */}
          {searchState.hasSearched && !searchState.error && (
            <div className="mb-4">
              <h3 className="text-white text-lg font-semibold">Results</h3>
              {searchState.results.length > 0 ? (
                <p className="text-gray-400 text-sm">
                  {searchState.totalResults} match{searchState.totalResults !== 1 ? "es" : ""} for "{searchState.query}"
                </p>
              ) : (
                <p className="text-gray-400 text-sm">
                  No customers found matching "{searchState.query}"
                </p>
              )}
            </div>
          )}

          {/* Loading State */}
          {searchState.isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-[#2a2a2a] border border-gray-700 rounded-lg p-4 animate-pulse"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-700 rounded-full" />
                    <div className="flex-1">
                      <div className="h-5 bg-gray-700 rounded w-1/3 mb-2" />
                      <div className="h-4 bg-gray-700 rounded w-1/4 mb-2" />
                      <div className="h-4 bg-gray-700 rounded w-2/3" />
                    </div>
                    <div className="text-right">
                      <div className="h-4 bg-gray-700 rounded w-16 mb-2" />
                      <div className="h-6 bg-gray-700 rounded w-12" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Customer Cards List */}
          {!searchState.isLoading && searchState.results.length > 0 && (
            <div className="space-y-3">
              {searchState.results.map((customer) => (
                <CustomerCard
                  key={customer.address}
                  customer={customer}
                  onViewProfile={handleViewProfile}
                  onCopyAddress={handleCopyAddress}
                />
              ))}
            </div>
          )}

          {/* Empty State - No Search Yet */}
          {!searchState.hasSearched && !searchState.isLoading && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-600" />
              </div>
              <h3 className="text-white text-lg font-medium mb-2">
                Search for Customers
              </h3>
              <p className="text-gray-400 text-sm max-w-md mx-auto">
                Enter a customer name or wallet address to find their profile and view their RCN balance.
              </p>
            </div>
          )}

          {/* Empty State - No Results */}
          {searchState.hasSearched && !searchState.isLoading && searchState.results.length === 0 && !searchState.error && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-white text-lg font-medium mb-2">
                No Customers Found
              </h3>
              <p className="text-gray-400 text-sm max-w-md mx-auto">
                No customers match your search for "{searchState.query}". Try a different name or wallet address.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] rounded-2xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <ScanLine className="w-6 h-6 text-[#FFCC00]" />
                Scan Customer QR Code
              </h3>
              <button
                onClick={stopQRScanner}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full h-64 bg-black rounded-lg object-cover"
                  playsInline
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-[#FFCC00] rounded-lg opacity-75"></div>
                </div>
              </div>

              <div className="mt-4 text-center">
                <p className="text-gray-300 text-sm mb-2">
                  Point your camera at the customer's QR code
                </p>
                <p className="text-gray-400 text-xs">
                  The QR code should contain their wallet address
                </p>
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  onClick={stopQRScanner}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Export types for use in other components
export type { CustomerSearchResult };
