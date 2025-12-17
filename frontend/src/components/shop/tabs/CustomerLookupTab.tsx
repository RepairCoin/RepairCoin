"use client";

import React, { useState, useRef, useEffect } from "react";
import QrScanner from "qr-scanner";
import { Camera, X, ScanLine, Search } from "lucide-react";
import toast from "react-hot-toast";

interface CustomerData {
  address: string;
  name?: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetimeEarnings: number;
  availableBalance: number;
  isActive: boolean;
  lastEarnedDate?: string;
  homeShopId?: string;
  earningsByShop: { [shopId: string]: number };
  marketBalance?: number;
  totalBalance?: number;
}

interface CustomerLookupTabProps {
  shopId: string;
}

export const CustomerLookupTab: React.FC<CustomerLookupTabProps> = ({
  shopId,
}) => {
  const [searchAddress, setSearchAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const lookupCustomer = async () => {
    if (!searchAddress) {
      setError("Please enter a customer wallet address");
      return;
    }

    setLoading(true);
    setError(null);
    setCustomerData(null);

    try {
      // Get earned balance
      const earnedResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/earned-balance/${searchAddress}`
      );

      if (!earnedResponse.ok) {
        throw new Error("Customer not found");
      }

      const earnedData = await earnedResponse.json();

      // Get earning sources
      const sourcesResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/earning-sources/${searchAddress}`
      );

      let earningsByShop = {};
      if (sourcesResponse.ok) {
        const sourcesData = await sourcesResponse.json();
        earningsByShop = sourcesData.data.earningsByShop || {};
      }

      // Get customer details
      const customerResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/customers/${searchAddress}`
      );

      let customerInfo = null;
      if (customerResponse.ok) {
        const customerResult = await customerResponse.json();
        customerInfo = customerResult.data;
      }

      setCustomerData({
        address: searchAddress,
        name: customerInfo?.name,
        tier: customerInfo?.tier || "BRONZE",
        lifetimeEarnings:
          customerInfo?.lifetimeEarnings || earnedData.data.availableBalance,
        availableBalance: earnedData.data.availableBalance,
        isActive: customerInfo?.isActive ?? true,
        lastEarnedDate: customerInfo?.lastEarnedDate,
        homeShopId: earnedData.data.homeShopId,
        earningsByShop,
        marketBalance: 0,
        totalBalance: earnedData.data.availableBalance,
      });
    } catch (err) {
      console.error("Lookup error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to lookup customer"
      );
    } finally {
      setLoading(false);
    }
  };

  const getMaxRedeemable = () => {
    if (!customerData) return 0;
    return customerData.availableBalance;
  };

  const startQRScanner = async () => {
    try {
      setShowQRScanner(true);
      if (videoRef.current) {
        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            const scannedText = result.data;
            const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
            if (ethAddressRegex.test(scannedText)) {
              setSearchAddress(scannedText);
              stopQRScanner();
              toast.success("Wallet address scanned successfully!");
              setTimeout(() => {
                lookupCustomer();
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

  useEffect(() => {
    return () => {
      if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
      }
    };
  }, [qrScanner]);

  return (
    <div className="space-y-6">
      {/* Find Customer Container */}
      <div className="bg-[#101010] rounded-[20px] overflow-hidden">
        {/* Header */}
        <div className="px-7 py-6 border-b border-[#303236]">
          <div className="flex items-center gap-3">
            <Search className="w-6 h-6 text-[#FFCC00]" />
            <h2 className="text-base font-semibold text-[#FFCC00]">
              Find Customer
            </h2>
          </div>
        </div>

        {/* Search and Buttons */}
        <div className="px-7 py-5 border-b border-[#303236]">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Search className="w-5 h-5 text-[#979797]" />
              </div>
              <input
                type="text"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                placeholder="Enter customer name or wallet address..."
                onKeyPress={(e) => e.key === "Enter" && lookupCustomer()}
                className="w-full h-[35px] pl-10 pr-4 bg-white border border-[#E2E8F0] rounded text-sm text-[#101010] placeholder:text-[#979797] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent shadow-sm"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {/* Scan QR Button */}
              <button
                onClick={startQRScanner}
                disabled={loading}
                className="h-[32px] px-3 bg-[#00B2FF] text-[#101010] font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Camera className="w-5 h-5" />
                <span>Scan QR</span>
              </button>

              {/* Search Button */}
              <button
                onClick={lookupCustomer}
                disabled={loading || !searchAddress}
                className="h-[32px] px-3 bg-[#FFCC00] text-black font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
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
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-7 py-4">
            <div className="bg-red-900/20 border border-red-500 rounded-xl p-4">
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
                <p className="text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State - shown when no search has been performed */}
        {!customerData && !error && !loading && (
          <div className="px-7 py-16">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-800 rounded-full mb-4">
                <Search className="w-10 h-10 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Search for a customer
              </h3>
              <p className="text-gray-400">
                Enter a customer name or wallet address to view their RCN balance and history
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="px-7 py-16">
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mb-4"></div>
              <p className="text-gray-400">Searching for customer...</p>
            </div>
          </div>
        )}

        {/* Customer Details */}
        {customerData && !loading && (
          <div className="p-6 animate-fadeIn">
            {/* Quick Summary Card */}
            <div className="bg-gradient-to-r from-[#FFCC00] to-[#FFA500] rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-black/70 text-sm">Customer Status</p>
                  <h3 className="text-2xl font-bold text-black mb-1">
                    {customerData.name || "Anonymous Customer"}
                  </h3>
                  <div className="flex items-center gap-3">
                    <div
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                        customerData.tier === "GOLD"
                          ? "bg-black/20 text-black"
                          : customerData.tier === "SILVER"
                          ? "bg-white/30 text-black"
                          : "bg-orange-900/30 text-black"
                      }`}
                    >
                      {customerData.tier === "GOLD" && "👑"} {customerData.tier} TIER
                    </div>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                        customerData.isActive
                          ? "bg-green-900/30 text-black"
                          : "bg-red-900/30 text-black"
                      }`}
                    >
                      {customerData.isActive ? "✓ Active" : "✗ Suspended"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-black/70 text-sm">Max Redeemable</p>
                  <p className="text-3xl font-bold text-black">
                    {getMaxRedeemable()} RCN
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Customer Profile Card */}
              <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl border border-gray-800 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center mb-4 gap-2">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12.0005 2C10.061 2.00369 8.16442 2.57131 6.54177 3.63374C4.91911 4.69617 3.64043 6.20754 2.86148 7.98377C2.08252 9.76 1.83691 11.7244 2.15456 13.6378C2.47221 15.5511 3.33941 17.3308 4.65054 18.76C5.58696 19.775 6.72348 20.5851 7.98847 21.1392C9.25347 21.6933 10.6195 21.9793 12.0005 21.9793C13.3816 21.9793 14.7476 21.6933 16.0126 21.1392C17.2776 20.5851 18.4141 19.775 19.3505 18.76C20.6617 17.3308 21.5289 15.5511 21.8465 13.6378C22.1642 11.7244 21.9186 9.76 21.1396 7.98377C20.3606 6.20754 19.082 4.69617 17.4593 3.63374C15.8367 2.57131 13.9401 2.00369 12.0005 2ZM12.0005 20C9.929 19.9969 7.93945 19.1903 6.45054 17.75C6.90258 16.6495 7.67157 15.7083 8.65979 15.0459C9.64801 14.3835 10.8108 14.0298 12.0005 14.0298C13.1902 14.0298 14.3531 14.3835 15.3413 15.0459C16.3295 15.7083 17.0985 16.6495 17.5505 17.75C16.0616 19.1903 14.0721 19.9969 12.0005 20ZM10.0005 10C10.0005 9.60444 10.1178 9.21776 10.3376 8.88886C10.5574 8.55996 10.8697 8.30362 11.2352 8.15224C11.6006 8.00087 12.0028 7.96126 12.3907 8.03843C12.7787 8.1156 13.135 8.30608 13.4148 8.58579C13.6945 8.86549 13.8849 9.22186 13.9621 9.60982C14.0393 9.99778 13.9997 10.3999 13.8483 10.7654C13.6969 11.1308 13.4406 11.4432 13.1117 11.6629C12.7828 11.8827 12.3961 12 12.0005 12C11.4701 12 10.9614 11.7893 10.5863 11.4142C10.2113 11.0391 10.0005 10.5304 10.0005 10ZM18.9105 16C18.0171 14.4718 16.6419 13.283 15.0005 12.62C15.5097 12.0427 15.8415 11.3307 15.956 10.5694C16.0705 9.80822 15.963 9.03011 15.6463 8.3285C15.3296 7.62688 14.8171 7.03156 14.1704 6.61397C13.5238 6.19637 12.7703 5.97425 12.0005 5.97425C11.2307 5.97425 10.4773 6.19637 9.83063 6.61397C9.18395 7.03156 8.67151 7.62688 8.35479 8.3285C8.03807 9.03011 7.93052 9.80822 8.04507 10.5694C8.15961 11.3307 8.49137 12.0427 9.00054 12.62C7.35914 13.283 5.98401 14.4718 5.09054 16C4.37848 14.7871 4.00226 13.4065 4.00054 12C4.00054 9.87827 4.84339 7.84344 6.34368 6.34315C7.84397 4.84285 9.87881 4 12.0005 4C14.1223 4 16.1571 4.84285 17.6574 6.34315C19.1577 7.84344 20.0005 9.87827 20.0005 12C19.9988 13.4065 19.6226 14.7871 18.9105 16Z"
                        fill="#FFCC00"
                      />
                    </svg>
                    <h3 className="text-lg font-semibold text-white">Profile</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Wallet Address</p>
                      <div className="flex items-center gap-2">
                        <code className="text-white text-sm font-mono bg-[#0D0D0D] px-2 py-1 rounded">
                          {customerData.address.slice(0, 6)}...
                          {customerData.address.slice(-4)}
                        </code>
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(customerData.address)
                          }
                          className="text-gray-400 hover:text-[#FFCC00] transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-gray-400 text-xs mb-1">Lifetime Earnings</p>
                      <p className="text-2xl font-bold text-[#FFCC00]">
                        {customerData.lifetimeEarnings} RCN
                      </p>
                    </div>

                    {customerData.lastEarnedDate && (
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Last Activity</p>
                        <p className="text-white text-sm">
                          {new Date(customerData.lastEarnedDate).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </p>
                      </div>
                    )}

                    <div className="pt-4 border-t border-gray-700">
                      <div
                        className={`rounded-xl p-3 ${
                          customerData.homeShopId === shopId
                            ? "bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/50"
                            : "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                customerData.homeShopId === shopId
                                  ? "bg-green-500/30"
                                  : "bg-yellow-500/30"
                              }`}
                            >
                              {customerData.homeShopId === shopId ? (
                                <svg
                                  className="w-4 h-4 text-green-400"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                                </svg>
                              ) : (
                                <svg
                                  className="w-4 h-4 text-yellow-400"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </div>
                            <div>
                              <p
                                className={`text-sm font-bold ${
                                  customerData.homeShopId === shopId
                                    ? "text-green-400"
                                    : "text-yellow-400"
                                }`}
                              >
                                {customerData.homeShopId === shopId
                                  ? "Home Customer"
                                  : "Cross-Shop"}
                              </p>
                              <p
                                className={`text-xs ${
                                  customerData.homeShopId === shopId
                                    ? "text-green-300"
                                    : "text-yellow-300"
                                }`}
                              >
                                100% redeemable
                              </p>
                            </div>
                          </div>
                          <div
                            className={`text-right ${
                              customerData.homeShopId === shopId
                                ? "text-green-400"
                                : "text-yellow-400"
                            }`}
                          >
                            <p className="text-xs font-medium">Max</p>
                            <p className="text-sm font-bold">{getMaxRedeemable()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Balance Breakdown Card */}
              <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl border border-gray-800 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center mb-4 gap-2">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M11 9H15C15.2652 9 15.5196 8.89464 15.7071 8.70711C15.8946 8.51957 16 8.26522 16 8C16 7.73478 15.8946 7.48043 15.7071 7.29289C15.5196 7.10536 15.2652 7 15 7H13V6C13 5.73478 12.8946 5.48043 12.7071 5.29289C12.5196 5.10536 12.2652 5 12 5C11.7348 5 11.4804 5.10536 11.2929 5.29289C11.1054 5.48043 11 5.73478 11 6V7C10.2044 7 9.44129 7.31607 8.87868 7.87868C8.31607 8.44129 8 9.20435 8 10C8 10.7956 8.31607 11.5587 8.87868 12.1213C9.44129 12.6839 10.2044 13 11 13H13C13.2652 13 13.5196 13.1054 13.7071 13.2929C13.8946 13.4804 14 13.7348 14 14C14 14.2652 13.8946 14.5196 13.7071 14.7071C13.5196 14.8946 13.2652 15 13 15H9C8.73478 15 8.48043 15.1054 8.29289 15.2929C8.10536 15.4804 8 15.7348 8 16C8 16.2652 8.10536 16.5196 8.29289 16.7071C8.48043 16.8946 8.73478 17 9 17H11V18C11 18.2652 11.1054 18.5196 11.2929 18.7071C11.4804 18.8946 11.7348 19 12 19C12.2652 19 12.5196 18.8946 12.7071 18.7071C12.8946 18.5196 13 18.2652 13 18V17C13.7956 17 14.5587 16.6839 15.1213 16.1213C15.6839 15.5587 16 14.7956 16 14C16 13.2044 15.6839 12.4413 15.1213 11.8787C14.5587 11.3161 13.7956 11 13 11H11C10.7348 11 10.4804 10.8946 10.2929 10.7071C10.1054 10.5196 10 10.2652 10 10C10 9.73478 10.1054 9.48043 10.2929 9.29289C10.4804 9.10536 10.7348 9 11 9ZM19 2H5C4.20435 2 3.44129 2.31607 2.87868 2.87868C2.31607 3.44129 2 4.20435 2 5V19C2 19.7956 2.31607 20.5587 2.87868 21.1213C3.44129 21.6839 4.20435 22 5 22H19C19.7956 22 20.5587 21.6839 21.1213 21.1213C21.6839 20.5587 22 19.7956 22 19V5C22 4.20435 21.6839 3.44129 21.1213 2.87868C20.5587 2.31607 19.7956 2 19 2ZM20 19C20 19.2652 19.8946 19.5196 19.7071 19.7071C19.5196 19.8946 19.2652 20 19 20H5C4.73478 20 4.48043 19.8946 4.29289 19.7071C4.10536 19.5196 4 19.2652 4 19V5C4 4.73478 4.10536 4.48043 4.29289 4.29289C4.48043 4.10536 4.73478 4 5 4H19C19.2652 4 19.5196 4.10536 19.7071 4.29289C19.8946 4.48043 20 4.73478 20 5V19Z"
                        fill="#FFCC00"
                      />
                    </svg>
                    <h3 className="text-lg font-semibold text-white">Balances</h3>
                  </div>

                  <div className="space-y-4">
                    {/* Earned Balance */}
                    <div className="p-3 bg-green-900/20 rounded-lg border border-green-500/30">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-green-400 text-xs font-medium">
                            Earned Balance
                          </p>
                          <p className="text-gray-400 text-xs mt-1">Redeemable</p>
                        </div>
                        <p className="text-green-400 text-xl font-bold">
                          {customerData.availableBalance}
                        </p>
                      </div>
                    </div>

                    {/* Market Balance */}
                    <div className="p-3 bg-red-900/20 rounded-lg border border-red-500/30">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-red-400 text-xs font-medium">
                            Market Balance
                          </p>
                          <p className="text-gray-400 text-xs mt-1">Not redeemable</p>
                        </div>
                        <p className="text-red-400 text-xl font-bold">
                          {customerData.marketBalance || 0}
                        </p>
                      </div>
                    </div>

                    {/* Total Balance */}
                    <div className="pt-4 border-t border-gray-700">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-white text-sm font-medium">
                            Total Balance
                          </p>
                          <p className="text-gray-400 text-xs">On blockchain</p>
                        </div>
                        <p className="text-[#FFCC00] text-2xl font-bold">
                          {customerData.totalBalance || customerData.availableBalance}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Earning Sources Card */}
              <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl border border-gray-800 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center mb-4 gap-2">
                    <svg
                      className="w-5 h-5 text-[#FFCC00]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                    <h3 className="text-lg font-semibold text-white">
                      Earning Sources
                    </h3>
                  </div>

                  {Object.keys(customerData.earningsByShop).length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {Object.entries(customerData.earningsByShop)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([shop, amount], index) => (
                          <div
                            key={shop}
                            className="flex items-center justify-between p-3 bg-[#0D0D0D] rounded-lg hover:bg-opacity-70 transition-all"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                  index === 0
                                    ? "bg-[#FFCC00] text-black"
                                    : index === 1
                                    ? "bg-gray-400 text-black"
                                    : index === 2
                                    ? "bg-orange-500 text-white"
                                    : "bg-gray-600 text-white"
                                }`}
                              >
                                {index + 1}
                              </div>
                              <div>
                                <p className="text-white text-sm font-medium">
                                  {shop}
                                </p>
                                <div className="flex gap-1 mt-1">
                                  {shop === shopId && (
                                    <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">
                                      Your Shop
                                    </span>
                                  )}
                                  {shop === customerData.homeShopId && (
                                    <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded">
                                      Home
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[#FFCC00] font-bold">{amount as number}</p>
                              <p className="text-gray-500 text-xs">RCN</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg
                        className="w-12 h-12 text-gray-600 mx-auto mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                        />
                      </svg>
                      <p className="text-gray-500 text-sm">No earning history</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
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
