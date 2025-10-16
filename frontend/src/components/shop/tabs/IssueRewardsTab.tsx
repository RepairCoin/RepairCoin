"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import Tooltip from "../../ui/tooltip";

interface ShopData {
  purchasedRcnBalance: number;
}

interface IssueRewardsTabProps {
  shopId: string;
  shopData: ShopData | null;
  onRewardIssued: () => void;
}

type RepairType = "minor" | "small" | "large" | "custom";

interface CustomerInfo {
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetimeEarnings: number;
  // dailyEarnings and monthlyEarnings removed - no limits
}

interface RepairOption {
  type: RepairType;
  label: string;
  rcn: string | number;
  description: string;
}

const TIER_BONUSES = {
  BRONZE: 0,    // No bonus for Bronze
  SILVER: 2,    // +2 RCN per repair
  GOLD: 5,      // +5 RCN per repair
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
  const totalReward = baseReward + tierBonus;
  const hasSufficientBalance =
    (shopData?.purchasedRcnBalance || 0) >= totalReward;

  // No earning limits - customers can earn unlimited RCN
  const canIssueReward = true;

  useEffect(() => {
    if (customerAddress && customerAddress.length === 42) {
      fetchCustomerInfo();
    } else {
      setCustomerInfo(null);
    }
  }, [customerAddress]);

  const fetchCustomerInfo = async () => {
    setFetchingCustomer(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/customers/${customerAddress}`
      );

      if (response.ok) {
        const result = await response.json();
        const customerData = result.data.customer || result.data;
        setCustomerInfo({
          tier: customerData.tier || "BRONZE",
          lifetimeEarnings: customerData.lifetimeEarnings || 0,
        });
      } else {
        setCustomerInfo({
          tier: "BRONZE",
          lifetimeEarnings: 0,
        });
      }
    } catch (err) {
      console.error("Error fetching customer:", err);
      setCustomerInfo({
        tier: "BRONZE",
        lifetimeEarnings: 0,
      });
    } finally {
      setFetchingCustomer(false);
    }
  };

  const issueReward = async () => {
    if (!customerAddress) {
      setError("Please enter a valid customer address");
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
      const authToken =
        localStorage.getItem("shopAuthToken") ||
        sessionStorage.getItem("shopAuthToken");

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      } else {
        throw new Error(
          "No authentication token found. Please refresh the page and try again."
        );
      }

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
      console.log("API URL:", `${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/issue-reward`);
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/issue-reward`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: "Failed to parse error response" };
        }
        console.error("Error response from server:", {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          requestBody: requestBody
        });
        
        // Check for specific error messages
        if (errorData.error === "Failed to process promo code") {
          console.error("Promo code error details:", errorData.details || "No details provided");
          console.error("Promo code:", errorData.promoCode);
          console.error("Shop ID:", errorData.shopId);
          
          // Include details in the error message if available
          const detailMessage = errorData.details ? `: ${errorData.details}` : "";
          throw new Error(`${errorData.error}${detailMessage}`);
        }
        
        throw new Error(errorData.error || "Failed to issue reward");
      }

      const result = await response.json();

      // Show success toast notification
      toast.success(
        `Successfully issued ${result.data.totalReward} RCN to customer!`,
        {
          duration: 5000,
          position: 'top-right',
          style: {
            background: '#10B981',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '16px',
            padding: '16px',
          },
          icon: '🎉',
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
        errorMessage = "Network error. Please check your connection and try again. If the problem persists, try refreshing the page.";
      } else {
        errorMessage = err instanceof Error ? err.message : "Failed to issue reward";
      }
      
      setError(errorMessage);
      
      // Show error toast notification
      toast.error(errorMessage, {
        duration: 5000,
        position: 'top-right',
        style: {
          background: '#EF4444',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '16px',
          padding: '16px',
        },
      });
    } finally {
      setProcessing(false);
    }
  };

  const repairOptions: RepairOption[] = [
    {
      type: "minor",
      label: "XS Repair",
      rcn: MINOR_REPAIR_RCN,
      description: "$30 - $50 repair value",
    },
    {
      type: "small",
      label: "Small Repair",
      rcn: SMALL_REPAIR_RCN,
      description: "$50 - $99 repair value",
    },
    {
      type: "large",
      label: "Large Repair",
      rcn: LARGE_REPAIR_RCN,
      description: "$100+ repair value",
    },
  ];

  const RepairRadioButton = ({ option }: { option: RepairOption }) => (
    <label className="relative cursor-pointer block group h-full">
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
        className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 h-full min-h-[120px] ${
          repairType === option.type
            ? "bg-gradient-to-r from-[#FFCC00]/10 to-[#FFCC00]/5 border-[#FFCC00] shadow-lg shadow-[#FFCC00]/20"
            : "bg-[#1A1A1A] border-gray-700 hover:border-gray-500 hover:bg-[#222222]"
        }`}
      >
        <div className="p-5 h-full flex flex-col justify-between">
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="relative flex-shrink-0 mt-1">
                <div
                  className={`w-5 h-5 rounded-full border-2 transition-all duration-300 ${
                    repairType === option.type
                      ? "border-[#FFCC00] bg-[#FFCC00]"
                      : "border-gray-500 bg-transparent group-hover:border-gray-400"
                  }`}
                >
                  <svg
                    className={`w-full h-full text-black transition-all duration-300 ${
                      repairType === option.type ? "opacity-100 scale-100" : "opacity-0 scale-50"
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                {repairType === option.type && (
                  <div className="absolute inset-0 rounded-full bg-[#FFCC00] animate-ping opacity-30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold text-base md:text-base transition-colors leading-tight ${
                  repairType === option.type ? "text-white" : "text-gray-200 group-hover:text-white"
                }`}>
                  {option.label}
                </h3>
                <p className={`text-xs mt-1 transition-colors leading-snug ${
                  repairType === option.type ? "text-gray-300" : "text-gray-500 group-hover:text-gray-400"
                }`}>
                  {option.description}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="flex flex-col items-end">
                <span
                  className={`text-xl md:text-2xl font-bold transition-colors leading-none ${
                    repairType === option.type 
                      ? "text-[#FFCC00]" 
                      : option.rcn === 0 && option.type !== "custom"
                        ? "text-gray-600"
                        : "text-gray-400 group-hover:text-[#FFCC00]/70"
                  }`}
                >
                  {option.type === "custom"
                    ? customRcn
                      ? customRcn
                      : "?"
                    : option.rcn}
                </span>
                <span className={`text-xs uppercase tracking-wide mt-1 leading-none ${
                  repairType === option.type ? "text-[#FFCC00]" : "text-gray-500"
                }`}>
                  RCN
                </span>
              </div>
            </div>
          </div>
        </div>
        {repairType === option.type && (
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#FFCC00] opacity-5 rounded-full -translate-y-12 translate-x-12 pointer-events-none" />
        )}
      </div>
    </label>
  );


  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#212121] rounded-3xl">
            <div
              className="w-full px-4 md:px-8 py-4 text-white rounded-t-3xl"
              style={{
                backgroundImage: `url('/img/cust-ref-widget3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                Customer Details
              </p>
            </div>

            <div className="w-full p-4 md:p-8 text-white">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Wallet Address
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="0x0000...0000"
                    className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all"
                  />
                  {fetchingCustomer && (
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Promo Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Enter promo code"
                    className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {customerInfo && (
                <div className="bg-[#0D0D0D] rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
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
                    <div className="text-sm">
                      <span className="text-green-400 font-semibold">
                        ✅ No Earning Limits
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#212121] rounded-3xl">
            <div
              className="w-full px-4 md:px-8 py-4 text-white rounded-t-3xl flex items-center justify-between"
              style={{
                backgroundImage: `url('/img/cust-ref-widget3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                Select Repair Type
              </p>
              <Tooltip
                title="How it works"
                position="bottom"
                className="right-0"
                content={
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-blue-400">
                          1
                        </span>
                      </div>
                      <span className="text-gray-300">
                        Enter customer's wallet address to check their tier and earnings
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-blue-400">
                          2
                        </span>
                      </div>
                      <span className="text-gray-300">
                        Choose repair type or enter custom amount and RCN reward
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-blue-400">
                          3
                        </span>
                      </div>
                      <span className="text-gray-300">
                        Tier bonuses are automatically added (Silver +2, Gold +5 RCN)
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-blue-400">
                          4
                        </span>
                      </div>
                      <span className="text-gray-300">
                        RCN tokens are instantly transferred to customer's wallet
                      </span>
                    </li>
                  </ul>
                }
              />
            </div>

            {/* Custom Amount Section */}
            <div className="p-4 md:p-8 pb-0">
              <div className="space-y-4">
                <div className="p-4 bg-[#2F2F2F] rounded-xl">
                  <label className="flex items-center cursor-pointer">
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
                      className={`w-5 h-5 rounded-full border-2 mr-3 ${
                        repairType === "custom"
                          ? "border-[#FFCC00] bg-[#FFCC00]"
                          : "border-gray-500"
                      }`}
                    >
                      {repairType === "custom" && (
                        <svg
                          className="w-full h-full text-black"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="font-semibold text-white">
                        Custom Amount
                      </span>
                      <p className="text-gray-400 text-sm mt-1">
                        Enter specific RCN reward and repair value
                      </p>
                    </div>
                  </label>

                  {repairType === "custom" && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Repair Amount ($)
                        </label>
                        <input
                          type="number"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          placeholder="0"
                          min="0"
                          step="0.01"
                          className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all"
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
                            if (!repairType || repairType !== "custom") {
                              setRepairType("custom");
                            }
                          }}
                          placeholder="0"
                          min="0"
                          step="1"
                          className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Divider with "Or" */}
            <div className="px-4 md:px-8 py-4">
              <div className="flex items-center">
                <div className="flex-1 border-t border-gray-600"></div>
                <span className="px-4 text-gray-400 text-sm font-medium">
                  OR
                </span>
                <div className="flex-1 border-t border-gray-600"></div>
              </div>
            </div>

            {/* Preset Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full px-4 md:px-8 pb-8 text-white">
              {repairOptions.map((option) => (
                <RepairRadioButton key={option.type} option={option} />
              ))}
            </div>

            {/* {!hasSufficientBalance && totalReward > 0 && (
              <div className="w-full px-8 pb-8 text-white">
                <div className="bg-[#2F2F2F] border-b border-yellow-500 rounded-xl p-4">
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 text-yellow-500 mt-0.5 mr-3"
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
                      <h4 className="font-semibold text-gray-100 mb-1">
                        Insufficient Balance
                      </h4>
                      <p className="text-sm text-gray-400">
                        Need {totalReward} RCN but only have{" "}
                        {shopData?.purchasedRcnBalance || 0} RCN available.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )} */}

          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1C1C1C] to-[#252525] border border-gray-800">
              <div className="p-1">
                <div className="bg-[#1C1C1C] px-6 py-4 rounded-t-3xl">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-[#FFCC00] bg-opacity-20 flex items-center justify-center">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M5.5 8H6V8.5C6 8.76522 6.10536 9.01957 6.29289 9.20711C6.48043 9.39464 6.73478 9.5 7 9.5C7.26522 9.5 7.51957 9.39464 7.70711 9.20711C7.89464 9.01957 8 8.76522 8 8.5V8H8.5C8.76522 8 9.01957 7.89464 9.20711 7.70711C9.39464 7.51957 9.5 7.26522 9.5 7C9.5 6.73478 9.39464 6.48043 9.20711 6.29289C9.01957 6.10536 8.76522 6 8.5 6H8V5.5C8 5.23478 7.89464 4.98043 7.70711 4.79289C7.51957 4.60536 7.26522 4.5 7 4.5C6.73478 4.5 6.48043 4.60536 6.29289 4.79289C6.10536 4.98043 6 5.23478 6 5.5V6H5.5C5.23478 6 4.98043 6.10536 4.79289 6.29289C4.60536 6.48043 4.5 6.73478 4.5 7C4.5 7.26522 4.60536 7.51957 4.79289 7.70711C4.98043 7.89464 5.23478 8 5.5 8ZM4.88 19.12C5.06736 19.3063 5.32081 19.4108 5.585 19.4108C5.84919 19.4108 6.10264 19.3063 6.29 19.12L7 18.41L7.71 19.12C7.89736 19.3063 8.15081 19.4108 8.415 19.4108C8.67919 19.4108 8.93264 19.3063 9.12 19.12C9.30625 18.9326 9.41079 18.6792 9.41079 18.415C9.41079 18.1508 9.30625 17.8974 9.12 17.71L8.41 17L9.12 16.29C9.28383 16.0987 9.36943 15.8526 9.35971 15.6009C9.34999 15.3493 9.24566 15.1105 9.06756 14.9324C8.88947 14.7543 8.65073 14.65 8.39905 14.6403C8.14738 14.6306 7.9013 14.7162 7.71 14.88L7 15.59L6.29 14.88C6.0987 14.7162 5.85262 14.6306 5.60095 14.6403C5.34927 14.65 5.11053 14.7543 4.93244 14.9324C4.75434 15.1105 4.65001 15.3493 4.64029 15.6009C4.63057 15.8526 4.71617 16.0987 4.88 16.29L5.59 17L4.88 17.71C4.69375 17.8974 4.58921 18.1508 4.58921 18.415C4.58921 18.6792 4.69375 18.9326 4.88 19.12ZM20 1H4C3.20435 1 2.44129 1.31607 1.87868 1.87868C1.31607 2.44129 1 3.20435 1 4V20C1 20.7956 1.31607 21.5587 1.87868 22.1213C2.44129 22.6839 3.20435 23 4 23H20C20.7956 23 21.5587 22.6839 22.1213 22.1213C22.6839 21.5587 23 20.7956 23 20V4C23 3.20435 22.6839 2.44129 22.1213 1.87868C21.5587 1.31607 20.7956 1 20 1ZM11 21H4C3.73478 21 3.48043 20.8946 3.29289 20.7071C3.10536 20.5196 3 20.2652 3 20V13H11V21ZM11 11H3V4C3 3.73478 3.10536 3.48043 3.29289 3.29289C3.48043 3.10536 3.73478 3 4 3H11V11ZM21 20C21 20.2652 20.8946 20.5196 20.7071 20.7071C20.5196 20.8946 20.2652 21 20 21H13V13H21V20ZM21 11H13V3H20C20.2652 3 20.5196 3.10536 20.7071 3.29289C20.8946 3.48043 21 3.73478 21 4V11ZM15.5 16.5H18.5C18.7652 16.5 19.0196 16.3946 19.2071 16.2071C19.3946 16.0196 19.5 15.7652 19.5 15.5C19.5 15.2348 19.3946 14.9804 19.2071 14.7929C19.0196 14.6054 18.7652 14.5 18.5 14.5H15.5C15.2348 14.5 14.9804 14.6054 14.7929 14.7929C14.6054 14.9804 14.5 15.2348 14.5 15.5C14.5 15.7652 14.6054 16.0196 14.7929 16.2071C14.9804 16.3946 15.2348 16.5 15.5 16.5ZM18.5 6H15.5C15.2348 6 14.9804 6.10536 14.7929 6.29289C14.6054 6.48043 14.5 6.73478 14.5 7C14.5 7.26522 14.6054 7.51957 14.7929 7.70711C14.9804 7.89464 15.2348 8 15.5 8H18.5C18.7652 8 19.0196 7.89464 19.2071 7.70711C19.3946 7.51957 19.5 7.26522 19.5 7C19.5 6.73478 19.3946 6.48043 19.2071 6.29289C19.0196 6.10536 18.7652 6 18.5 6ZM15.5 19.5H18.5C18.7652 19.5 19.0196 19.3946 19.2071 19.2071C19.3946 19.0196 19.5 18.7652 19.5 18.5C19.5 18.2348 19.3946 17.9804 19.2071 17.7929C19.0196 17.6054 18.7652 17.5 18.5 17.5H15.5C15.2348 17.5 14.9804 17.6054 14.7929 17.7929C14.6054 17.9804 14.5 18.2348 14.5 18.5C14.5 18.7652 14.6054 19.0196 14.7929 19.2071C14.9804 19.3946 15.2348 19.5 15.5 19.5Z"
                          fill="#FFCC00"
                        />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">
                      Reward Calculator
                    </h3>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">
                    Available Balance
                  </span>
                  <div className="text-right">
                    <div
                      className={`text-2xl font-bold ${
                        (shopData?.purchasedRcnBalance || 0) >= totalReward
                          ? "text-[#FFCC00]"
                          : "text-red-500"
                      }`}
                    >
                      {shopData?.purchasedRcnBalance || 0} RCN
                    </div>
                    {!hasSufficientBalance && totalReward > 0 && (
                      <p className="text-red-400 text-xs mt-1">
                        Need{" "}
                        {totalReward - (shopData?.purchasedRcnBalance || 0)}{" "}
                        more
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#FFCC00] rounded-full"></div>
                      <span className="text-gray-300">Base Reward</span>
                    </div>
                    <span className="text-white font-semibold text-lg">
                      {baseReward} RCN
                    </span>
                  </div>

                  {customerInfo && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-300">
                          {customerInfo.tier} Bonus
                        </span>
                      </div>
                      <span className="text-green-500 font-semibold text-lg">
                        +{tierBonus} RCN
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white font-semibold text-md">
                      Total Reward
                    </span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#FFCC00]">
                        {totalReward} RCN
                      </div>
                    </div>
                  </div>

                </div>

                <button
                  onClick={issueReward}
                  disabled={
                    processing ||
                    !customerAddress ||
                    !canIssueReward ||
                    !hasSufficientBalance
                  }
                  className="w-full bg-[#FFCC00] text-black font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-yellow-500/25 transform hover:scale-105"
                >
                  {processing ? (
                    <div className="flex items-center justify-center">
                      <svg
                        className="animate-spin h-5 w-5 mr-2"
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
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12 20L4.6797 10.8496C4.34718 10.434 4.18092 10.2262 4.13625 9.9757C4.09159 9.72524 4.17575 9.47276 4.34407 8.96778L5.0883 6.73509C5.52832 5.41505 5.74832 4.75503 6.2721 4.37752C6.79587 4 7.49159 4 8.88304 4H15.117C16.5084 4 17.2041 4 17.7279 4.37752C18.2517 4.75503 18.4717 5.41505 18.9117 6.73509L19.6559 8.96778C19.8243 9.47276 19.9084 9.72524 19.8637 9.9757C19.8191 10.2262 19.6528 10.434 19.3203 10.8496L12 20ZM12 20L15.5 9M12 20L8.5 9M19.5 10L15.5 9M15.5 9L14 5M15.5 9H8.5M10 5L8.5 9M8.5 9L4.5 10"
                          stroke="#2F2F2F"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      Issue {totalReward} RCN
                    </div>
                  )}
                </button>

                <p className="text-center text-xs text-gray-500">
                  Tier bonuses are automatically added
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
