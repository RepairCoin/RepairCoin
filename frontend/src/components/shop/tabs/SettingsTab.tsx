"use client";

import React, { useState, useEffect } from "react";
import { SubscriptionManagement } from "../SubscriptionManagement";
import { Store, Mail, Phone, MapPin, Globe, Clock, User } from "lucide-react";
import toast from "react-hot-toast";

interface ShopData {
  // crossShopEnabled removed - universal redemption is now always enabled
  purchasedRcnBalance: number;
  walletAddress: string;
  operational_status?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  openingHours?: string;
  ownerName?: string;
}

interface SettingsTabProps {
  shopId: string;
  shopData: ShopData | null;
  onSettingsUpdate: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  shopId,
  shopData,
  onSettingsUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<"information" | "subscription">("information");
  // crossShopEnabled state removed - universal redemption is now always enabled
  const [autoPurchaseEnabled, setAutoPurchaseEnabled] = useState(false);
  const [autoPurchaseThreshold, setAutoPurchaseThreshold] = useState(50);
  const [autoPurchaseAmount, setAutoPurchaseAmount] = useState(100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Shop Details State
  const [isEditingShop, setIsEditingShop] = useState(false);
  const [shopFormData, setShopFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    openingHours: "",
    ownerName: "",
  });
  const [loadingShopUpdate, setLoadingShopUpdate] = useState(false);

  // Initialize shop form data
  useEffect(() => {
    if (shopData) {
      setShopFormData({
        name: shopData.name || "",
        email: shopData.email || "",
        phone: shopData.phone || "",
        address: shopData.address || "",
        website: shopData.website || "",
        openingHours: shopData.openingHours || "",
        ownerName: shopData.ownerName || "",
      });
    }
  }, [shopData]);


  const saveAutoPurchaseSettings = async () => {
    // This would be implemented when auto-purchase backend is ready
    setSuccess("Auto-purchase settings saved (feature coming soon)");
  };

  const handleShopInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setShopFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveShopDetails = async () => {
    setLoadingShopUpdate(true);
    try {
      // Get the JWT token from localStorage
      const token = localStorage.getItem("token");

      // First update shop details
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/details`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(shopFormData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update shop details");
      }

      // Cross-shop settings removed - universal redemption is now always enabled

      const data = await response.json();
      toast.success(data.message || "Shop details and settings updated successfully!");
      setIsEditingShop(false);
      onSettingsUpdate();
    } catch (error: any) {
      console.error("Error updating shop details:", error);
      toast.error(
        error.message || "Failed to update shop details. Please try again."
      );
    } finally {
      setLoadingShopUpdate(false);
    }
  };

  const handleCancelShopEdit = () => {
    setShopFormData({
      name: shopData?.name || "",
      email: shopData?.email || "",
      phone: shopData?.phone || "",
      address: shopData?.address || "",
      website: shopData?.website || "",
      openingHours: shopData?.openingHours || "",
      ownerName: shopData?.ownerName || "",
    });
    setIsEditingShop(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <div className="space-y-6">
      {/* Tab Buttons */}
      <div className="flex space-x-4 mb-6 border-b-[1px] border-gray-500 py-4">
        <button
          onClick={() => setActiveTab("information")}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
            activeTab === "information"
              ? "bg-[#FFCC00] text-black"
              : "bg-transparent text-gray-400 border border-gray-600 hover:text-white hover:border-gray-400"
          }`}
        >
          Information
        </button>
        <button
          onClick={() => setActiveTab("subscription")}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
            activeTab === "subscription"
              ? "bg-[#FFCC00] text-black"
              : "bg-transparent text-gray-400 border border-gray-600 hover:text-white hover:border-gray-400"
          }`}
        >
          Subscription
        </button>
      </div>

      {/* Information Tab Content */}
      {activeTab === "information" && (
        <>
          {/* Shop Details Section */}
          <div className="bg-[#212121] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden">
        <div
          className="w-full flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
            Shop Information
          </p>
          {!isEditingShop ? (
            <button
              onClick={() => setIsEditingShop(true)}
              className="text-xs sm:text-sm px-4 py-2 bg-black text-white rounded-3xl font-medium hover:bg-gray-900 transition-colors"
            >
              Edit Details
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancelShopEdit}
                className="text-xs sm:text-sm px-4 py-2 bg-black text-white rounded-3xl font-medium hover:bg-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveShopDetails}
                disabled={loadingShopUpdate}
                className="text-xs sm:text-sm px-4 py-2 bg-black text-white rounded-3xl font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
              >
                {loadingShopUpdate ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          <div className="flex flex-col gap-6">
            <div>
              <label className="block text-sm sm:text-base font-medium text-gray-300 mb-2">
                <Store className="w-6 h-6 inline mr-1" />
                Shop Name
              </label>
              <input
                type="text"
                name="name"
                value={shopFormData.name}
                onChange={handleShopInputChange}
                disabled={!isEditingShop}
                className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                placeholder="Enter shop name"
              />
            </div>

            <div>
              <label className="block text-sm sm:text-base font-medium text-gray-300 mb-2">
                <Mail className="w-6 h-6 inline mr-1" />
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={shopFormData.email}
                onChange={handleShopInputChange}
                disabled={!isEditingShop}
                className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                placeholder="shop@example.com"
              />
            </div>

            <div>
              <label className="block text-sm sm:text-base font-medium text-gray-300 mb-2">
                <Phone className="w-6 h-6 inline mr-1" />
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={shopFormData.phone}
                onChange={handleShopInputChange}
                disabled={!isEditingShop}
                className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <label className="block text-sm sm:text-base font-medium text-gray-300 mb-2">
                <Globe className="w-6 h-6 inline mr-1" />
                Website
              </label>
              <input
                type="url"
                name="website"
                value={shopFormData.website}
                onChange={handleShopInputChange}
                disabled={!isEditingShop}
                className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                placeholder="https://www.example.com"
              />
            </div>

            <div>
              <label className="block text-sm sm:text-base font-medium text-gray-300 mb-2">
                <MapPin className="w-6 h-6 inline mr-1" />
                Shop Address
              </label>
              <input
                type="text"
                name="address"
                value={shopFormData.address}
                onChange={handleShopInputChange}
                disabled={!isEditingShop}
                className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                placeholder="123 Main St, City, State ZIP"
              />
            </div>

            <div>
              <label className="block text-sm sm:text-base font-medium text-gray-300 mb-2">
                <MapPin className="w-6 h-6 inline mr-1" />
                Wallet Address
              </label>
              <div className="flex gap-6">
                <input
                  type="text"
                  value={shopData?.walletAddress || ""}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent cursor-not-allowed"
                />
                <button
                  onClick={() =>
                    copyToClipboard(
                      shopData?.walletAddress || "",
                      "Wallet address"
                    )
                  }
                  className="text-xs sm:text-sm px-8 bg-[#FFCC00] text-black rounded-3xl font-medium hover:bg-yellow-500 transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Universal Redemption Notice */}
        <div className="px-4 sm:px-6 lg:px-8 pb-6 sm:pb-10">
          <div className="bg-green-900/20 border border-green-700 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-green-400 mb-1">
              ✅ Universal Redemption Enabled
            </h4>
            <p className="text-sm text-green-300">
              All RepairCoin customers can redeem 100% of their earned RCN at your shop. 
              This maximizes customer convenience and increases foot traffic to your business.
            </p>
          </div>
        </div>
      </div>


      {/* Auto-Purchase Settings */}
      {/* <div className="bg-[#212121] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden">
        <div
          className="w-full flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
            Auto-Purchase Settings
          </p>
        </div>

        <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          <div className="flex items-start space-x-4">
            <input
              type="checkbox"
              id="autoPurchase"
              checked={autoPurchaseEnabled}
              onChange={(e) => setAutoPurchaseEnabled(e.target.checked)}
              className="mt-1 h-5 w-5 text-[#FFCC00] bg-gray-700 border-gray-600 rounded focus:ring-[#FFCC00]"
            />
            <div className="flex-1">
              <label
                htmlFor="autoPurchase"
                className="font-semibold text-white cursor-pointer"
              >
                Enable Auto-Purchase
              </label>
              <p className="text-sm text-gray-400 mt-1">
                Automatically purchase RCN when your balance falls below the
                threshold.
              </p>
            </div>
          </div>

          {autoPurchaseEnabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Low Balance Threshold (RCN)
                </label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={autoPurchaseThreshold}
                  onChange={(e) =>
                    setAutoPurchaseThreshold(parseInt(e.target.value) || 50)
                  }
                  className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Trigger auto-purchase when balance drops below this amount
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Auto-Purchase Amount (RCN)
                </label>
                <input
                  type="number"
                  min="50"
                  max="1000"
                  step="50"
                  value={autoPurchaseAmount}
                  onChange={(e) =>
                    setAutoPurchaseAmount(parseInt(e.target.value) || 100)
                  }
                  className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Amount to purchase automatically (${autoPurchaseAmount} USD)
                </p>
              </div>

              <div className="bg-yellow-900 bg-opacity-20 border border-yellow-500 rounded-xl p-4">
                <h4 className="text-sm font-medium text-yellow-400 mb-1">
                  ⚠️ Payment Method Required
                </h4>
                <p className="text-sm text-yellow-300">
                  You'll need to set up a default payment method for
                  auto-purchase to work. This feature is coming soon.
                </p>
              </div>
            </>
          )}

          <button
            onClick={saveAutoPurchaseSettings}
            disabled={saving}
            className="w-full bg-[#FFCC00] hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
          >
            {saving ? "Saving..." : "Save Auto-Purchase Settings"}
          </button>
        </div>
      </div> */}
        </>
      )}

      {/* Subscription Tab Content */}
      {activeTab === "subscription" && (
        <>
          {/* Monthly Subscription Management - Only show if not RCG qualified */}
          {shopData && shopData.operational_status !== "rcg_qualified" && (
            <SubscriptionManagement
              shopId={shopId}
              shopWallet={shopData.walletAddress}
            />
          )}
        </>
      )}

      {/* Status Messages */}
      {error && (
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
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-900 bg-opacity-20 border border-green-500 rounded-xl p-4">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-green-500 mr-3"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-green-400">{success}</p>
          </div>
        </div>
      )}
    </div>
  );
};
