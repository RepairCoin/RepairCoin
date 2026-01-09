"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import {
  Camera,
  X,
  HelpCircle,
  Wrench,
  Wallet,
  Search,
  User,
  Check,
  Sparkles,
} from "lucide-react";
import QrScanner from "qr-scanner";
import apiClient from "@/services/api/client";
import { Separator } from "@radix-ui/react-select";

// Customer search result interface
interface CustomerSearchResult {
  address: string;
  name?: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetimeEarnings?: number;
}

// Tier badge styles for dropdown
const TIER_BADGE_STYLES = {
  GOLD: "bg-[#F7B500] text-black",
  SILVER: "bg-[#6B7280] text-white",
  BRONZE: "bg-[#CD7F32] text-white",
} as const;

interface ShopData {
  purchasedRcnBalance: number;
  walletAddress?: string;
}

interface IssueRewardsTabProps {
  shopId: string;
  shopData: ShopData | null;
  onRewardIssued: () => void;
  isBlocked?: boolean;
  blockReason?: string;
}

type RepairType = "minor" | "small" | "large" | "custom";

interface CustomerInfo {
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetimeEarnings: number;
  isActive?: boolean;
  suspended?: boolean;
  suspensionReason?: string;
  // dailyEarnings and monthlyEarnings removed - no limits
}

interface RepairOption {
  type: RepairType;
  label: string;
  rcn: string | number;
  description: string;
}

const TIER_BONUSES = {
  BRONZE: 0, // No bonus for Bronze
  SILVER: 2, // +2 RCN per repair
  GOLD: 5, // +5 RCN per repair
} as const;

const TIER_STYLES = {
  GOLD: "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white",
  SILVER: "bg-gradient-to-r from-gray-400 to-gray-500 text-white",
  BRONZE: "bg-gradient-to-r from-orange-500 to-orange-600 text-white",
} as const;

// No earning limits - removed per new requirements
const MINOR_REPAIR_RCN = 5;
const SMALL_REPAIR_RCN = 10;
const LARGE_REPAIR_RCN = 15;
const MINOR_REPAIR_VALUE = 30;
const SMALL_REPAIR_VALUE = 75;
const LARGE_REPAIR_VALUE = 100;

export const IssueRewardsTab: React.FC<IssueRewardsTabProps> = ({
  shopId,
  shopData,
  onRewardIssued,
  isBlocked = false,
  blockReason = "This action is currently blocked",
}) => {
  const [customerAddress, setCustomerAddress] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [repairType, setRepairType] = useState<RepairType>("small");
  const [customAmount, setCustomAmount] = useState("");
  const [customRcn, setCustomRcn] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [fetchingCustomer, setFetchingCustomer] = useState(false);
  const [customerFetchCompleted, setCustomerFetchCompleted] = useState(false);
  const [promoBonus, setPromoBonus] = useState<number>(0);
  const [fetchingPromo, setFetchingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [availablePromoCodes, setAvailablePromoCodes] = useState<any[]>([]);
  const [showPromoDropdown, setShowPromoDropdown] = useState(false);

  // QR Scanner states
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Customer Search Dropdown states
  const [customerSearchResults, setCustomerSearchResults] = useState<
    CustomerSearchResult[]
  >([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const customerSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // How it works tooltip state
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showCalculatorInfo, setShowCalculatorInfo] = useState(false);

  const calculateBaseReward = () => {
    if (repairType === "custom") {
      const rcn = parseFloat(customRcn);
      return isNaN(rcn) ? 0 : rcn;
    }
    switch (repairType) {
      case "minor":
        return MINOR_REPAIR_RCN;
      case "small":
        return SMALL_REPAIR_RCN;
      case "large":
        return LARGE_REPAIR_RCN;
      default:
        return 0;
    }
  };

  const getRepairAmount = () => {
    if (repairType === "custom") {
      return parseFloat(customAmount) || 0;
    }
    switch (repairType) {
      case "minor":
        return MINOR_REPAIR_VALUE;
      case "small":
        return SMALL_REPAIR_VALUE;
      case "large":
        return LARGE_REPAIR_VALUE;
      default:
        return 0;
    }
  };

  const getTierBonus = (tier: string) => {
    return (
      TIER_BONUSES[tier as keyof typeof TIER_BONUSES] || TIER_BONUSES.BRONZE
    );
  };

  const baseReward = calculateBaseReward();
  const tierBonus = customerInfo ? getTierBonus(customerInfo.tier) : 0;
  const totalReward = baseReward + tierBonus + promoBonus;
  const hasSufficientBalance =
    (shopData?.purchasedRcnBalance || 0) >= totalReward;

  // No earning limits - customers can earn unlimited RCN
  const canIssueReward = true;

  // Fetch available promo codes on mount
  useEffect(() => {
    const fetchPromoCodes = async () => {
      if (!shopId) return;

      try {
        const response = await apiClient.get(`/shops/${shopId}/promo-codes`);

        if (response.success && response.data) {
          setAvailablePromoCodes(response.data);
        }
      } catch (err) {
        console.error("Error fetching promo codes:", err);
      }
    };

    fetchPromoCodes();
  }, [shopId]);

  useEffect(() => {
    // Track if this effect instance is still valid (for cleanup/race condition handling)
    let isCancelled = false;

    if (customerAddress && customerAddress.length === 42) {
      // Reset fetch completed flag and set fetching to true
      setCustomerFetchCompleted(false);
      setFetchingCustomer(true);

      // Inline fetch to avoid stale closure issues with customerAddress
      const fetchCustomer = async () => {
        setError(null);

        // Check if shop is trying to issue rewards to themselves
        if (
          shopData?.walletAddress &&
          customerAddress.toLowerCase() === shopData.walletAddress.toLowerCase()
        ) {
          if (!isCancelled) {
            setCustomerInfo(null);
            setError("You cannot issue rewards to your own wallet address");
            setFetchingCustomer(false);
            setCustomerFetchCompleted(true);
          }
          return;
        }

        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/customers/${customerAddress}`
          );

          // Don't update state if this effect was cancelled
          if (isCancelled) return;

          if (response.ok) {
            const result = await response.json();
            const customerData = result.data.customer || result.data;
            setCustomerInfo({
              tier: customerData.tier || "BRONZE",
              lifetimeEarnings: customerData.lifetimeEarnings || 0,
              isActive: customerData.isActive !== false,
              suspended:
                customerData.suspended || customerData.isActive === false,
              suspensionReason: customerData.suspensionReason,
            });

            // Show error if customer is suspended
            if (customerData.isActive === false || customerData.suspended) {
              setError(
                `Cannot issue rewards to suspended customer${
                  customerData.suspensionReason
                    ? ": " + customerData.suspensionReason
                    : ""
                }`
              );
            }
          } else {
            // Customer not found - set to null instead of default values
            setCustomerInfo(null);
          }
        } catch (err) {
          console.error("Error fetching customer:", err);
          // Network error or other issue - set to null
          if (!isCancelled) {
            setCustomerInfo(null);
          }
        } finally {
          if (!isCancelled) {
            setFetchingCustomer(false);
            setCustomerFetchCompleted(true);
          }
        }
      };

      fetchCustomer();
    } else {
      setCustomerInfo(null);
      setFetchingCustomer(false);
      setCustomerFetchCompleted(false);
    }

    // Cleanup function to cancel outdated requests
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerAddress]);

  // Fetch promo bonus when promo code changes
  useEffect(() => {
    const fetchPromoBonus = async () => {
      if (!promoCode || !promoCode.trim() || !shopId || !customerAddress) {
        setPromoBonus(0);
        setPromoError(null);
        return;
      }

      setFetchingPromo(true);
      setPromoError(null);
      try {
        const result = await apiClient.post(
          `/shops/${shopId}/promo-codes/validate`,
          {
            code: promoCode.trim(),
            customer_address: customerAddress,
          }
        );

        console.log("Promo validation result:", result);
        if (result.success && result.data.is_valid) {
          // Calculate bonus based on validation result
          // Round to 2 decimal places to avoid floating point precision issues
          const rewardBeforePromo = baseReward + tierBonus;
          let bonusAmount = 0;

          if (result.data.bonus_type === "fixed") {
            bonusAmount =
              Math.round((parseFloat(result.data.bonus_value) || 0) * 100) /
              100;
          } else if (result.data.bonus_type === "percentage") {
            bonusAmount =
              Math.round(
                ((rewardBeforePromo *
                  (parseFloat(result.data.bonus_value) || 0)) /
                  100) *
                  100
              ) / 100;
          }

          // Apply max_bonus cap if it exists
          if (result.data.max_bonus) {
            const maxBonus = parseFloat(result.data.max_bonus);
            if (!isNaN(maxBonus) && bonusAmount > maxBonus) {
              bonusAmount = Math.round(maxBonus * 100) / 100;
            }
          }

          console.log("Calculated promo bonus:", bonusAmount);
          setPromoBonus(bonusAmount);
          setPromoError(null);
        } else {
          console.log("Promo invalid:", result.data?.error_message);
          setPromoBonus(0);
          setPromoError(result.data?.error_message || "Invalid promo code");
        }
      } catch (err) {
        console.error("Error fetching promo bonus:", err);
        setPromoBonus(0);
        setPromoError("Failed to validate promo code");
      } finally {
        setFetchingPromo(false);
      }
    };

    // Debounce the fetch to avoid too many requests
    const timeoutId = setTimeout(fetchPromoBonus, 500);
    return () => clearTimeout(timeoutId);
  }, [promoCode, shopId, customerAddress, baseReward, tierBonus]);

  const issueReward = async () => {
    // Check if shop is blocked first
    if (isBlocked) {
      setError(blockReason);
      toast.error(blockReason, {
        duration: 5000,
        position: "top-right",
        style: {
          background: "#EF4444",
          color: "white",
          fontWeight: "bold",
        },
        icon: "🚫",
      });
      return;
    }

    if (!customerAddress) {
      setError("Please enter a valid customer address");
      return;
    }

    // Prevent shop from issuing rewards to themselves
    if (
      shopData?.walletAddress &&
      customerAddress.toLowerCase() === shopData.walletAddress.toLowerCase()
    ) {
      setError("You cannot issue rewards to your own wallet address");
      return;
    }

    if (!customerInfo) {
      setError(
        "Customer not found. Customer must be registered before receiving rewards."
      );
      return;
    }

    // Check if customer is suspended
    if (customerInfo.isActive === false || customerInfo.suspended) {
      setError(
        `Cannot issue rewards to suspended customer${
          customerInfo.suspensionReason
            ? ": " + customerInfo.suspensionReason
            : ""
        }`
      );
      return;
    }

    if (repairType === "custom") {
      const amount = parseFloat(customAmount);
      if (!customAmount || isNaN(amount) || amount <= 0) {
        setError("Please enter a valid repair amount");
        return;
      }
    }

    if (!hasSufficientBalance) {
      setError(
        `Insufficient RCN balance. Need ${totalReward} RCN but only have ${
          shopData?.purchasedRcnBalance || 0
        } RCN`
      );
      return;
    }

    setProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const requestBody: any = {
        customerAddress,
        repairAmount: getRepairAmount(),
        skipTierBonus: false,
        promoCode: promoCode.trim() || undefined,
      };

      // If using custom repair type, send the custom base reward
      if (repairType === "custom") {
        const customBase = parseFloat(customRcn);
        if (!isNaN(customBase) && customBase >= 0) {
          requestBody.customBaseReward = customBase;
        }
      }

      console.log("Issuing reward with request body:", requestBody);
      console.log("Frontend balance check:", {
        shopBalance: shopData?.purchasedRcnBalance,
        totalReward,
        baseReward,
        tierBonus,
        promoBonus,
        hasSufficientBalance,
      });

      const result = await apiClient.post(
        `/shops/${shopId}/issue-reward`,
        requestBody
      );

      // Show success toast notification
      toast.success(
        `Successfully issued ${result.data.totalReward} RCN to customer!`,
        {
          duration: 5000,
          position: "top-right",
          style: {
            background: "#10B981",
            color: "white",
            fontWeight: "bold",
            fontSize: "16px",
            padding: "16px",
          },
          icon: "🎉",
        }
      );

      setSuccess(
        `Successfully issued ${result.data.totalReward} RCN to customer!`
      );

      // Update customer info with new earnings
      if (customerInfo) {
        setCustomerInfo({
          ...customerInfo,
          lifetimeEarnings: customerInfo.lifetimeEarnings + totalReward,
          // dailyEarnings and monthlyEarnings removed - no limits
        });
      }

      // Clear form but keep customer address for convenience
      setRepairType("small");
      setCustomAmount("");
      setCustomRcn("");
      setPromoCode("");

      onRewardIssued();
    } catch (err) {
      console.error("Error issuing reward:", err);
      let errorMessage: string;

      if (err instanceof Error && err.message.includes("Failed to fetch")) {
        errorMessage =
          "Network error. Please check your connection and try again. If the problem persists, try refreshing the page.";
      } else {
        errorMessage =
          err instanceof Error ? err.message : "Failed to issue reward";
      }

      setError(errorMessage);

      // Show error toast notification
      toast.error(errorMessage, {
        duration: 5000,
        position: "top-right",
        style: {
          background: "#EF4444",
          color: "white",
          fontWeight: "bold",
          fontSize: "16px",
          padding: "16px",
        },
      });
    } finally {
      setProcessing(false);
    }
  };

  // Customer Search Dropdown - search when input changes (if not a wallet address)
  const searchCustomersByName = async (query: string) => {
    if (!query || query.startsWith("0x") || query.length < 2) {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
      return;
    }

    setSearchingCustomers(true);
    setShowCustomerDropdown(true);

    try {
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL
        }/customers?search=${encodeURIComponent(query)}&page=1&limit=10`,
        {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const customers = (data.data?.customers || []).map((c: any) => ({
          address: c.address,
          name: c.name,
          tier: c.tier || "BRONZE",
          lifetimeEarnings: c.lifetimeEarnings || 0,
        }));
        setCustomerSearchResults(customers);
      } else {
        setCustomerSearchResults([]);
      }
    } catch (error) {
      console.error("Error searching customers:", error);
      setCustomerSearchResults([]);
    } finally {
      setSearchingCustomers(false);
    }
  };

  // Handle customer address input change with debounced search
  const handleCustomerAddressChange = (value: string) => {
    setCustomerAddress(value);

    // Clear existing timeout
    if (customerSearchTimeoutRef.current) {
      clearTimeout(customerSearchTimeoutRef.current);
    }

    // If it looks like a wallet address, don't search
    if (value.startsWith("0x")) {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
      return;
    }

    // Debounce search by 300ms
    customerSearchTimeoutRef.current = setTimeout(() => {
      searchCustomersByName(value);
    }, 300);
  };

  // Handle customer selection from dropdown
  const handleSelectCustomerFromDropdown = (customer: CustomerSearchResult) => {
    setCustomerAddress(customer.address);
    setShowCustomerDropdown(false);
    setCustomerSearchResults([]);
    toast.success(`Selected: ${customer.name || "Customer"}`);
  };

  // QR Scanner functions
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

          // Validate if it's an Ethereum address
          const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
          if (ethAddressRegex.test(scannedText)) {
            setCustomerAddress(scannedText);
            stopQRScanner();
            toast.success("Customer wallet address scanned successfully!");
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
      } catch (startError: any) {
        console.error("Scanner start error:", startError);

        // Provide more specific error messages
        if (startError.name === "NotAllowedError") {
          toast.error(
            "Camera permission denied. Please allow camera access in your browser settings."
          );
        } else if (startError.name === "NotFoundError") {
          toast.error("No camera found on this device.");
        } else if (startError.name === "NotReadableError") {
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

  const repairOptions: RepairOption[] = [
    {
      type: "minor",
      label: "Small Reward",
      rcn: MINOR_REPAIR_RCN,
      description: "$30 - $50 purchase value",
    },
    {
      type: "small",
      label: "Medium Reward",
      rcn: SMALL_REPAIR_RCN,
      description: "$50 - $99 purchase value",
    },
    {
      type: "large",
      label: "Large Reward",
      rcn: LARGE_REPAIR_RCN,
      description: "$100+ purchase value",
    },
  ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Customer Details & Repair Type */}
        <div className="lg:col-span-2">
          {/* Customer Details Card */}
          <div className="bg-[#101010] rounded-t-xl border border-gray-800">
            <div className="px-6 py-4 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FFCC00]/20 flex items-center justify-center">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z"
                        stroke="#FFCC00"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <h3 className="text-[#FFCC00] font-semibold text-lg">
                    Customer Details
                  </h3>
                </div>
                <div className="relative">
                  <button
                    className="text-gray-500 hover:text-gray-400 transition-colors"
                    onMouseEnter={() => setShowHowItWorks(true)}
                    onMouseLeave={() => setShowHowItWorks(false)}
                    onClick={() => setShowHowItWorks(!showHowItWorks)}
                  >
                    <HelpCircle className="w-5 h-5" />
                  </button>

                  {/* How it works tooltip */}
                  {showHowItWorks && (
                    <div
                      className="absolute right-0 top-full mt-2 w-72 bg-[#1A1A1A] border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden"
                      onMouseEnter={() => setShowHowItWorks(true)}
                      onMouseLeave={() => setShowHowItWorks(false)}
                    >
                      {/* Header */}
                      <div className="px-4 py-3 border-b border-gray-700">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#FFCC00]" />
                          <span className="text-[#FFCC00] font-semibold text-sm">How it works</span>
                        </div>
                      </div>

                      {/* Steps */}
                      <div className="p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-[#FFCC00] flex items-center justify-center flex-shrink-0 text-xs font-bold text-black">
                            1
                          </div>
                          <p className="text-gray-300 text-sm">
                            Enter customer&apos;s wallet address to check their tier and earnings
                          </p>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-[#FFCC00] flex items-center justify-center flex-shrink-0 text-xs font-bold text-black">
                            2
                          </div>
                          <p className="text-gray-300 text-sm">
                            Choose repair type or enter custom amount and RCN reward
                          </p>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-[#FFCC00] flex items-center justify-center flex-shrink-0 text-xs font-bold text-black">
                            3
                          </div>
                          <p className="text-gray-300 text-sm">
                            Tier bonuses are automatically added (Silver +2, Gold +5 RCN)
                          </p>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-[#FFCC00] flex items-center justify-center flex-shrink-0 text-xs font-bold text-black">
                            4
                          </div>
                          <p className="text-gray-300 text-sm">
                            RCN tokens are instantly transferred to customer&apos;s wallet
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Wallet Address */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Customer Name or Wallet Address
                </label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={customerAddress}
                      onChange={(e) => handleCustomerAddressChange(e.target.value)}
                      onFocus={() => {
                        if (customerSearchResults.length > 0) {
                          setShowCustomerDropdown(true);
                        }
                      }}
                      onBlur={() => {
                        // Delay to allow click on dropdown item
                        setTimeout(() => setShowCustomerDropdown(false), 200);
                      }}
                      placeholder="Enter Customer Wallet Address.."
                      disabled={isBlocked}
                      className={`w-full pl-10 px-4 py-3 bg-white border border-gray-700 text-black rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all placeholder:text-gray-600 ${
                        isBlocked ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    />
                    {(fetchingCustomer || searchingCustomers) && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg
                          className="animate-spin h-5 w-5 text-[#FFCC00]"
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
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      </div>
                    )}

                    {/* Customer Search Dropdown */}
                    {showCustomerDropdown && (
                      <div className="absolute z-20 w-full mt-2 bg-[#1A1A1A] border border-gray-700 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                        {searchingCustomers && (
                          <div className="px-4 py-3 text-center text-gray-400 flex items-center justify-center gap-2">
                            <svg
                              className="animate-spin h-4 w-4"
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
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Searching...
                          </div>
                        )}

                        {!searchingCustomers &&
                          customerSearchResults.length === 0 &&
                          customerAddress &&
                          !customerAddress.startsWith("0x") && (
                            <div className="px-4 py-3 text-center text-gray-500 flex flex-col items-center gap-2">
                              <User className="w-8 h-8 text-gray-600" />
                              <span>No customers found</span>
                            </div>
                          )}

                        {!searchingCustomers &&
                          customerSearchResults.map((customer) => (
                            <div
                              key={customer.address}
                              onClick={() =>
                                handleSelectCustomerFromDropdown(customer)
                              }
                              className="px-4 py-3 hover:bg-[#2F2F2F] cursor-pointer transition-colors border-b border-gray-800 last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {customer.name
                                      ? customer.name.charAt(0).toUpperCase()
                                      : "?"}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-white">
                                        {customer.name || "Anonymous Customer"}
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                                          TIER_BADGE_STYLES[customer.tier]
                                        }`}
                                      >
                                        {customer.tier}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                                      {customer.address.slice(0, 6)}...
                                      {customer.address.slice(-4)}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-400">
                                    Lifetime
                                  </p>
                                  <p className="text-sm font-semibold text-[#FFCC00]">
                                    {customer.lifetimeEarnings?.toLocaleString() ||
                                      0}{" "}
                                    RCN
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={startQRScanner}
                    className="px-4 py-3 bg-[#FFCC00] text-black hover:bg-[#FFD700] font-semibold rounded-lg transition-all flex items-center gap-2"
                    title="Scan customer's QR code"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Scan QR</span>
                  </button>
                </div>
              </div>

              {/* Promo Code */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Promo Code (Optional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => {
                      const newValue = e.target.value.toUpperCase();
                      setPromoCode(newValue);
                      setShowPromoDropdown(true);
                      if (!newValue.trim()) {
                        setPromoBonus(0);
                      }
                    }}
                    onFocus={() => setShowPromoDropdown(true)}
                    onBlur={() =>
                      setTimeout(() => setShowPromoDropdown(false), 200)
                    }
                    placeholder="Enter or Select Promo Code.."
                    className={`w-full px-4 py-3 bg-white border text-black rounded-lg focus:ring-2 focus:border-transparent transition-all placeholder:text-gray-600 ${
                      promoBonus > 0
                        ? "border-[#FFCC00] focus:ring-[#FFCC00]"
                        : "border-gray-700 focus:ring-[#FFCC00]"
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    {promoBonus > 0 && (
                      <span className="text-xs font-bold px-2 py-1 bg-[#FFCC00] text-black rounded">
                        +{promoBonus} RCN
                      </span>
                    )}
                    {fetchingPromo && (
                      <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-[#FFCC00] rounded-full"></div>
                    )}
                    {/* Clear button */}
                    {promoCode && !fetchingPromo && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPromoCode("");
                          setPromoBonus(0);
                          setPromoError(null);
                        }}
                        className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                        title="Clear promo code"
                      >
                        <X className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                      </button>
                    )}
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        showPromoDropdown ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>

                  {/* Dropdown */}
                  {showPromoDropdown && availablePromoCodes.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-[#101010] border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                      {availablePromoCodes
                        .filter((code) =>
                          code.code
                            .toUpperCase()
                            .includes(promoCode.toUpperCase())
                        )
                        .map((code) => (
                          <div
                            key={code.id}
                            onClick={() => {
                              setPromoCode(code.code);
                              setShowPromoDropdown(false);
                            }}
                            className="px-4 py-3 hover:bg-[#2F2F2F] cursor-pointer transition-colors border-b border-gray-800 last:border-b-0"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-white">
                                    {code.code}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 text-xs rounded ${
                                      code.is_active
                                        ? "bg-green-500/20 text-green-400"
                                        : "bg-gray-500/20 text-gray-400"
                                    }`}
                                  >
                                    {code.is_active ? "Active" : "Inactive"}
                                  </span>
                                </div>
                                {code.name && (
                                  <p className="text-sm text-gray-400 mt-1">
                                    {code.name}
                                  </p>
                                )}
                              </div>
                              <div className="text-right ml-4">
                                <div className="text-[#FFCC00] font-bold">
                                  {code.bonus_type === "fixed"
                                    ? `+${code.bonus_value} RCN`
                                    : `${code.bonus_value}%`}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      {availablePromoCodes.filter((code) =>
                        code.code
                          .toUpperCase()
                          .includes(promoCode.toUpperCase())
                      ).length === 0 && (
                        <div className="px-4 py-3 text-center text-gray-500">
                          No matching promo codes
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {promoError && (
                  <p className="mt-2 text-sm text-red-400">{promoError}</p>
                )}
              </div>

              {/* Customer Info Display */}
              {customerInfo && (
                <div className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          TIER_STYLES[customerInfo.tier]
                        }`}
                      >
                        {customerInfo.tier} TIER
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">Lifetime:</span>
                        <span className="text-white ml-1 font-semibold">
                          {customerInfo.lifetimeEarnings} RCN
                        </span>
                      </div>
                    </div>
                    <span className="text-green-400 text-sm font-medium">
                      ✅ No Earning Limits
                    </span>
                  </div>
                </div>
              )}

              {/* Error Messages */}
              {!fetchingCustomer &&
                customerAddress &&
                customerAddress.length === 42 &&
                shopData?.walletAddress &&
                customerAddress.toLowerCase() ===
                  shopData.walletAddress.toLowerCase() && (
                  <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30">
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-yellow-400 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <p className="text-yellow-400 font-semibold text-sm">
                          Cannot Issue to Your Own Wallet
                        </p>
                        <p className="text-yellow-300/70 text-xs mt-1">
                          You cannot issue rewards to your own wallet address.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {!fetchingCustomer &&
                customerFetchCompleted &&
                customerAddress &&
                customerAddress.length === 42 &&
                !customerInfo &&
                !(
                  shopData?.walletAddress &&
                  customerAddress.toLowerCase() ===
                    shopData.walletAddress.toLowerCase()
                ) && (
                  <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30">
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-red-400 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <p className="text-red-400 font-semibold text-sm">
                          Customer Not Registered
                        </p>
                        <p className="text-red-300/70 text-xs mt-1">
                          This wallet address is not registered. Customer must
                          register before receiving rewards.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {customerInfo &&
                (customerInfo.isActive === false || customerInfo.suspended) && (
                  <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30">
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-red-400 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <p className="text-red-400 font-semibold text-sm">
                          Customer Account Suspended
                        </p>
                        <p className="text-red-300/70 text-xs mt-1">
                          {customerInfo.suspensionReason
                            ? `This customer's account has been suspended: ${customerInfo.suspensionReason}`
                            : "This customer's account has been suspended."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Select Repair Type Card */}
          <div className="bg-[#101010] rounded-b-xl border border-gray-800">
            <div className="px-6 py-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#FFCC00]/20 flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-[#FFCC00]" />
                </div>
                <h3 className="text-[#FFCC00] font-semibold text-lg">
                  Select Repair Type
                </h3>
              </div>
            </div>

            <div className="p-6">
              {/* Custom Amount Option */}
              <div className="mb-6 bg-[#212121] p-4 rounded-lg border border-gray-700">
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="mt-1">
                    <input
                      type="radio"
                      name="repairType"
                      value="custom"
                      checked={repairType === "custom"}
                      onChange={(e) =>
                        setRepairType(e.target.value as RepairType)
                      }
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        repairType === "custom"
                          ? "border-[#FFCC00] bg-transparent"
                          : "border-gray-500"
                      }`}
                    >
                      {repairType === "custom" && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#FFCC00]"></div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-white">
                      Custom Amount
                    </span>
                    <p className="text-gray-500 text-sm mt-0.5">
                      Enter specific RCN reward and purchase value
                    </p>
                  </div>
                </label>

                {/* Custom Amount Inputs - Always visible when Custom is selected */}
                <div
                  className={`mt-4 grid grid-cols-2 gap-4 transition-all ${
                    repairType === "custom" ? "opacity-100" : "opacity-50"
                  }`}
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Purchase Amount ($)
                    </label>
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => {
                        setCustomAmount(e.target.value);
                        if (repairType !== "custom") setRepairType("custom");
                      }}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-3 bg-white border border-gray-700 text-black rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      RCN Reward
                    </label>
                    <input
                      type="number"
                      value={customRcn}
                      onChange={(e) => {
                        setCustomRcn(e.target.value);
                        if (repairType !== "custom") setRepairType("custom");
                      }}
                      placeholder="0"
                      min="0"
                      step="1"
                      className="w-full px-4 py-3 bg-white text-black border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* OR Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 border-t border-gray-700"></div>
                <span className="text-gray-500 text-sm font-medium">OR</span>
                <div className="flex-1 border-t border-gray-700"></div>
              </div>

              {/* Preset Reward Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {repairOptions.map((option) => (
                  <label key={option.type} className="cursor-pointer block">
                    <input
                      type="radio"
                      name="repairType"
                      value={option.type}
                      checked={repairType === option.type}
                      onChange={(e) => {
                        setRepairType(e.target.value as RepairType);
                        setCustomRcn("");
                        setCustomAmount("");
                      }}
                      className="sr-only"
                    />
                    <div
                      className={`p-4 rounded-lg border-2 transition-all duration-300 h-full relative ${
                        repairType === option.type
                          ? "border-[#FFCC00] bg-[#FFCC00]/5"
                          : "border-gray-700 bg-[#212121] hover:border-gray-600"
                      }`}
                      style={
                        repairType === option.type
                          ? {
                              boxShadow:
                                "0 0 20px rgba(255, 204, 0, 0.3), 0 0 40px rgba(255, 204, 0, 0.1), inset 0 1px 0 rgba(255, 204, 0, 0.1)",
                            }
                          : {}
                      }
                    >
                      {/* Top - Checkbox and text */}
                      <div className="flex items-start gap-3">
                        {/* Animated Checkbox */}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                            repairType === option.type
                              ? "bg-[#FFCC00]"
                              : "border-2 border-gray-500 bg-transparent"
                          }`}
                          style={
                            repairType === option.type
                              ? {
                                  animation:
                                    "pulse-glow 2s ease-in-out infinite",
                                }
                              : {}
                          }
                        >
                          {repairType === option.type && (
                            <Check
                              className="w-4 h-4 text-black"
                              strokeWidth={3}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4
                            className={`font-bold text-sm uppercase ${
                              repairType === option.type
                                ? "text-[#FFCC00]"
                                : "text-white"
                            }`}
                          >
                            {option.label}
                          </h4>

                          <p className={`text-xs mt-1 ${repairType === option.type ? "text-white" : "text-gray-500"}`}>
                            {option.description}
                          </p>
                        </div>
                      </div>

                      {/* Horizontal Divider */}
                      <div className={`border-t my-3 ${
                        repairType === option.type ? "border-[#FFCC00]" : "border-gray-700"
                      }`}></div>

                      {/* Bottom - RCN value */}
                      <div className="px-8">
                        <p
                          className={`lg:text-xl text-lg font-bold ${
                            repairType === option.type
                              ? "text-[#FFCC00]"
                              : "text-white"
                          }`}
                        >
                          {option.rcn} RCN
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Pulse animation styles */}
              <style jsx>{`
                @keyframes pulse-glow {
                  0%,
                  100% {
                    box-shadow: 0 0 0 0 rgba(255, 204, 0, 0.4);
                  }
                  50% {
                    box-shadow: 0 0 0 8px rgba(255, 204, 0, 0);
                  }
                }
              `}</style>
            </div>
          </div>
        </div>

        {/* Right Column - Reward Calculator */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <div className="bg-[#101010] rounded-xl border border-gray-800">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#FFCC00]/20 flex items-center justify-center">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M5.5 8H6V8.5C6 8.76522 6.10536 9.01957 6.29289 9.20711C6.48043 9.39464 6.73478 9.5 7 9.5C7.26522 9.5 7.51957 9.39464 7.70711 9.20711C7.89464 9.01957 8 8.76522 8 8.5V8H8.5C8.76522 8 9.01957 7.89464 9.20711 7.70711C9.39464 7.51957 9.5 7.26522 9.5 7C9.5 6.73478 9.39464 6.48043 9.20711 6.29289C9.01957 6.10536 8.76522 6 8.5 6H8V5.5C8 5.23478 7.89464 4.98043 7.70711 4.79289C7.51957 4.60536 7.26522 4.5 7 4.5C6.73478 4.5 6.48043 4.60536 6.29289 4.79289C6.10536 4.98043 6 5.23478 6 5.5V6H5.5C5.23478 6 4.98043 6.10536 4.79289 6.29289C4.60536 6.48043 4.5 6.73478 4.5 7C4.5 7.26522 4.60536 7.51957 4.79289 7.70711C4.98043 7.89464 5.23478 8 5.5 8ZM20 1H4C3.20435 1 2.44129 1.31607 1.87868 1.87868C1.31607 2.44129 1 3.20435 1 4V20C1 20.7956 1.31607 21.5587 1.87868 22.1213C2.44129 22.6839 3.20435 23 4 23H20C20.7956 23 21.5587 22.6839 22.1213 22.1213C22.6839 21.5587 23 20.7956 23 20V4C23 3.20435 22.6839 2.44129 22.1213 1.87868C21.5587 1.31607 20.7956 1 20 1ZM11 21H4C3.73478 21 3.48043 20.8946 3.29289 20.7071C3.10536 20.5196 3 20.2652 3 20V13H11V21ZM11 11H3V4C3 3.73478 3.10536 3.48043 3.29289 3.29289C3.48043 3.10536 3.73478 3 4 3H11V11ZM21 20C21 20.2652 20.8946 20.5196 20.7071 20.7071C20.5196 20.8946 20.2652 21 20 21H13V13H21V20ZM21 11H13V3H20C20.2652 3 20.5196 3.10536 20.7071 3.29289C20.8946 3.48043 21 3.73478 21 4V11Z"
                          fill="#FFCC00"
                        />
                      </svg>
                    </div>
                    <h3 className="text-[#FFCC00] font-semibold text-lg">
                      Reward Calculator
                    </h3>
                  </div>
                  <div className="relative">
                    <button
                      className="text-gray-500 hover:text-gray-400 transition-colors"
                      onMouseEnter={() => setShowCalculatorInfo(true)}
                      onMouseLeave={() => setShowCalculatorInfo(false)}
                      onClick={() => setShowCalculatorInfo(!showCalculatorInfo)}
                    >
                      <HelpCircle className="w-5 h-5" />
                    </button>

                    {/* Calculator info tooltip */}
                    {showCalculatorInfo && (
                      <div
                        className="absolute right-0 top-full mt-2 w-72 bg-[#1A1A1A] border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden"
                        onMouseEnter={() => setShowCalculatorInfo(true)}
                        onMouseLeave={() => setShowCalculatorInfo(false)}
                      >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-gray-700">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#FFCC00]" />
                            <span className="text-[#FFCC00] font-semibold text-sm">Reward Breakdown</span>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-[#FFCC00] mt-1.5 flex-shrink-0" />
                            <p className="text-gray-300 text-sm">
                              <span className="text-white font-medium">Available Balance:</span> Your shop&apos;s RCN tokens available to issue
                            </p>
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-[#FFCC00] mt-1.5 flex-shrink-0" />
                            <p className="text-gray-300 text-sm">
                              <span className="text-white font-medium">Base Reward:</span> RCN amount based on repair type selected
                            </p>
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-[#FFCC00] mt-1.5 flex-shrink-0" />
                            <p className="text-gray-300 text-sm">
                              <span className="text-white font-medium">Tier Bonus:</span> Extra RCN based on customer tier (Silver +2, Gold +5)
                            </p>
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-[#FFCC00] mt-1.5 flex-shrink-0" />
                            <p className="text-gray-300 text-sm">
                              <span className="text-white font-medium">Promo Bonus:</span> Additional RCN from applied promo codes
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Calculator Content */}
              <div className="p-6 space-y-4">
                {/* Available Balance */}
                <div className="flex items-center justify-between py-3 border-b border-gray-800">
                  <span className="text-gray-400">Available Balance</span>
                  <span
                    className={`text-lg font-bold ${
                      (shopData?.purchasedRcnBalance || 0) >= totalReward
                        ? "text-[#FFCC00]"
                        : "text-red-500"
                    }`}
                  >
                    {shopData?.purchasedRcnBalance || 0} RCN
                  </span>
                </div>

                {/* Base Reward */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Base Reward</span>
                    <span className="text-gray-600">•</span>
                  </div>
                  <span className="text-white font-medium">
                    {baseReward} RCN
                  </span>
                </div>

                {/* Tier Bonus */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Tier Bonus</span>
                    <span className="text-gray-600">•</span>
                  </div>
                  <span className="text-[#11E326] font-medium">
                    +{tierBonus} RCN
                  </span>
                </div>

                {/* Promo Bonus (if applicable) */}
                {promoBonus > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Promo Bonus</span>
                      <span className="text-gray-600">•</span>
                    </div>
                    <span className="text-[#FFCC00] font-medium">
                      +{promoBonus} RCN
                    </span>
                  </div>
                )}

                {/* Total Reward */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                  <span className="text-white font-semibold uppercase tracking-wide">
                    Total Reward:
                  </span>
                  <span className="text-[#FFCC00] text-xl font-bold">
                    {totalReward} RCN
                  </span>
                </div>

                {/* Issue Button */}
                <button
                  onClick={issueReward}
                  disabled={
                    processing ||
                    !customerAddress ||
                    !customerInfo ||
                    !canIssueReward ||
                    !hasSufficientBalance ||
                    customerInfo?.isActive === false ||
                    customerInfo?.suspended ||
                    totalReward === 0 ||
                    (shopData?.purchasedRcnBalance || 0) === 0
                  }
                  className="w-full bg-[#FFCC00] text-black font-bold py-4 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-[#FFD700] flex items-center justify-center gap-2"
                >
                  {processing ? (
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
                      Processing...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-5 h-5" />
                      Issue {totalReward} RCN
                    </>
                  )}
                </button>

                {/* Note */}
                <p className="text-center text-xs text-gray-500">
                  Tier bonuses are automatically added
                </p>
              </div>
            </div>
          </div>
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
