"use client";

import { LookupIcon } from "@/components/icon";
import React, { useState, useRef, useEffect } from "react";
import QrScanner from "qr-scanner";
import { Camera, X, Search, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import CustomerCard from "@/components/shop/customers/CustomerCard";
import { CustomerProfileView } from "@/components/shop/customers/profile";

// Search result from API
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
  const [cameraLoading, setCameraLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
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
        profile_image_url?: string;
        tier?: string;
        lifetimeEarnings?: number;
        currentBalance?: number;
        lastEarnedDate?: string;
        isActive?: boolean;
      }) => ({
        address: c.address,
        name: c.name,
        profile_image_url: c.profile_image_url,
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
    setSelectedCustomer(address);
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Wallet address copied!");
  };

  const startQRScanner = async () => {
    try {
      setShowQRScanner(true);
      setCameraLoading(true);

      // Wait for video element to be ready in the DOM
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!videoRef.current) {
        throw new Error("Video element not ready");
      }

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const scannedText = result.data;
          console.log("QR scan result:", scannedText);

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
          preferredCamera: "environment", // Use back camera on mobile
        }
      );

      setQrScanner(scanner);

      // Start the scanner with better error handling
      try {
        await scanner.start();
        setCameraLoading(false);
      } catch (startError: unknown) {
        console.error("Scanner start error:", startError);

        // Provide more specific error messages
        const error = startError as { name?: string };
        if (error.name === "NotAllowedError") {
          toast.error(
            "Camera permission denied. Please allow camera access in your browser settings."
          );
        } else if (error.name === "NotFoundError") {
          toast.error("No camera found on this device.");
        } else if (error.name === "NotReadableError") {
          toast.error("Camera is already in use by another application.");
        } else {
          toast.error("Failed to start camera. Please try again.");
        }

        setShowQRScanner(false);
        setQrScanner(null);
        setCameraLoading(false);
      }
    } catch (error) {
      console.error("Error initializing QR scanner:", error);
      toast.error("Failed to initialize camera. Please try again.");
      setShowQRScanner(false);
      setCameraLoading(false);
    }
  };

  const stopQRScanner = () => {
    if (qrScanner) {
      qrScanner.stop();
      qrScanner.destroy();
      setQrScanner(null);
    }

    // Explicitly stop all video tracks to ensure camera is released
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        track.stop();
        console.log("Camera track stopped:", track.kind);
      });
      videoRef.current.srcObject = null;
    }

    setShowQRScanner(false);
    setCameraLoading(false);
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

  // If a customer is selected, show full profile view
  if (selectedCustomer) {
    return (
      <CustomerProfileView
        customerAddress={selectedCustomer}
        shopId={shopId}
        onBack={() => setSelectedCustomer(null)}
      />
    );
  }

  return (
    <div className=" mx-auto rounded-lg">
      <div className="bg-[#101010] rounded-xl border border-gray-800">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
          <div className="text-[#FFCC00]">
            <LookupIcon width={24} height={24} color="#FFCC00" />
          </div>
          <h2 className="text-lg font-semibold text-[#FFCC00]">
            Customer Lookup
          </h2>
        </div>

        {/* Search Input */}
        <div className="flex flex-col sm:flex-row items-center gap-3 px-6 py-5">
          <div className="w-full flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter customer name or wallet address..."
              className="w-full px-4 py-2.5 bg-white text-gray-900 rounded-lg transition-all pl-10 pr-4 focus:ring-2 focus:ring-[#FFCC00] focus:outline-none placeholder:text-gray-500"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={startQRScanner}
              disabled={searchState.isLoading}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-[#1a1a1a] border border-gray-600 text-white hover:bg-[#2a2a2a] font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              title="Scan customer's QR code"
            >
              <Camera className="w-4 h-4" />
              <span>Scan QR</span>
            </button>

            <button
              onClick={() => searchCustomers()}
              disabled={searchState.isLoading || !searchQuery.trim()}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-[#FFCC00] border border-gray-600 text-black hover:bg-[#e6b800] font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {searchState.isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {searchState.error && (
          <div className="px-6 pb-4">
            <div className="bg-red-900 bg-opacity-20 border border-red-500 rounded-lg p-4">
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
        <div className="px-6 pb-6">
          {/* Results Header */}
          {searchState.hasSearched && !searchState.error && (
            <div className="mb-4">
              <h3 className="text-white text-lg font-semibold">Results</h3>
              {searchState.results.length > 0 ? (
                <p className="text-gray-400 text-sm">
                  {searchState.totalResults} match{searchState.totalResults !== 1 ? "es" : ""} for &quot;{searchState.query}&quot;
                </p>
              ) : (
                <p className="text-gray-400 text-sm">
                  No customers found matching &quot;{searchState.query}&quot;
                </p>
              )}
            </div>
          )}

          {/* Loading State */}
          {searchState.isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-[#212121] border border-gray-800 rounded-lg p-4 animate-pulse"
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
                No customers match your search for &quot;{searchState.query}&quot;. Try a different name or wallet address.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#101010] rounded-xl p-6 max-w-md w-full border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Camera className="w-6 h-6 text-[#FFCC00]" />
                Scan Customer QR Code
              </h3>
              <button
                onClick={stopQRScanner}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden bg-black">
              <video
                ref={videoRef}
                className="w-full h-64 object-cover rounded-xl"
                playsInline
                muted
              />
              {cameraLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
                  <div className="text-center">
                    <svg
                      className="animate-spin h-12 w-12 text-[#FFCC00] mx-auto mb-3"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <p className="text-white text-sm">Starting camera...</p>
                  </div>
                </div>
              )}
              {!cameraLoading && (
                <div className="absolute inset-0 border-2 border-[#FFCC00] rounded-xl">
                  <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#FFCC00]"></div>
                  <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#FFCC00]"></div>
                  <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#FFCC00]"></div>
                  <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#FFCC00]"></div>
                </div>
              )}
            </div>

            <p className="text-gray-400 text-sm mt-4 text-center">
              Position the customer&apos;s QR code within the frame to scan
              their wallet address
            </p>

            <button
              onClick={stopQRScanner}
              className="w-full mt-4 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
            >
              Cancel Scan
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

// Export types for use in other components
export type { CustomerSearchResult };
