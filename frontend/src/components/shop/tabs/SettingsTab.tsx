"use client";

import React, { useState, useEffect } from "react";
import { SubscriptionManagement } from "../SubscriptionManagement";
import {
  Store,
  Mail,
  Phone,
  MapPin,
  Globe,
  Camera,
  Wallet,
  Search,
  Navigation,
  Pencil,
  Settings,
  User,
  CreditCard,
  Bell,
  Lock,
  MessageSquare,
  Shield,
} from "lucide-react";
import toast from "react-hot-toast";
import { LocationPickerWrapper } from "../../maps/LocationPickerWrapper";
import { CountryPhoneInput } from "../../ui/CountryPhoneInput";
import { ImageUploader } from "../ImageUploader";
import apiClient from "@/services/api/client";

interface ShopData {
  // crossShopEnabled removed - universal redemption is now always enabled
  purchasedRcnBalance: number;
  walletAddress: string;
  operational_status?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  website?: string;
  logoUrl?: string;
  location?: {
    city?: string;
    state?: string;
    zipCode?: string;
    lat?: number;
    lng?: number;
  };
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
  const [activeTab, setActiveTab] = useState<
    | "shop-profile"
    | "online-presence"
    | "wallet-payouts"
    | "accessibility"
    | "notifications"
    | "subscription"
    | "emails"
    | "password"
    | "social-media"
    | "moderation"
  >("shop-profile");
  // crossShopEnabled state removed - universal redemption is now always enabled
  const [error] = useState<string | null>(null);
  const [success] = useState<string | null>(null);

  // Shop Details State
  const [isEditingShop, setIsEditingShop] = useState(false);
  const [shopFormData, setShopFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    facebook: "",
    twitter: "",
    instagram: "",
    website: "",
    logoUrl: "",
    location: {
      lat: undefined as number | undefined,
      lng: undefined as number | undefined,
    },
  });
  const [loadingShopUpdate, setLoadingShopUpdate] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [showLogoUploader, setShowLogoUploader] = useState(false);

  // Initialize shop form data
  useEffect(() => {
    if (shopData) {
      setShopFormData({
        name: shopData.name || "",
        email: shopData.email || "",
        phone: shopData.phone || "",
        address: shopData.address || "",
        facebook: shopData.facebook || "",
        twitter: shopData.twitter || "",
        instagram: shopData.instagram || "",
        website: shopData.website || "",
        logoUrl: shopData.logoUrl || "",
        location: {
          lat: shopData.location?.lat,
          lng: shopData.location?.lng,
        },
      });
    }
  }, [shopData]);

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
      // Filter out fields that don't exist in the database
      const validFields = {
        name: shopFormData.name,
        email: shopFormData.email,
        phone: shopFormData.phone,
        address: shopFormData.address,
        facebook: shopFormData.facebook,
        twitter: shopFormData.twitter,
        instagram: shopFormData.instagram,
        website: shopFormData.website,
        logoUrl: shopFormData.logoUrl,
        location: {
          lat: shopFormData.location.lat,
          lng: shopFormData.location.lng,
        },
      };

      // Update shop details
      const data = await apiClient.put(`/shops/${shopId}/details`, validFields);

      // Cross-shop settings removed - universal redemption is now always enabled

      toast.success(
        data.message || "Shop details and settings updated successfully!"
      );
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
      facebook: shopData?.facebook || "",
      twitter: shopData?.twitter || "",
      instagram: shopData?.instagram || "",
      website: shopData?.website || "",
      logoUrl: shopData?.logoUrl || "",
      location: {
        lat: shopData?.location?.lat,
        lng: shopData?.location?.lng,
      },
    });
    setIsEditingShop(false);
    setShowLocationPicker(false);
    setShowLogoUploader(false);
  };

  // Handle logo upload success
  const handleLogoUpload = (url: string) => {
    setShopFormData((prev) => ({
      ...prev,
      logoUrl: url,
    }));
    toast.success("Logo uploaded! Click 'Save Changes' to apply.");
  };

  // Handle logo removal
  const handleLogoRemove = () => {
    setShopFormData((prev) => ({
      ...prev,
      logoUrl: "",
    }));
  };

  const handleLocationSelect = (location: {
    latitude: number;
    longitude: number;
    address?: string;
  }) => {
    setShopFormData((prev) => ({
      ...prev,
      location: {
        lat: location.latitude,
        lng: location.longitude,
      },
      // Update address if provided - allow overwriting existing address when picking new location
      ...(location.address ? { address: location.address } : {}),
    }));

    // Show success message when address is auto-filled
    if (location.address) {
      toast.success("Location pinpointed! Address automatically updated.");
    } else {
      toast.success("Location coordinates updated.");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  // Get current location using browser geolocation
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    toast.loading("Getting your location...", { id: "location" });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setShopFormData((prev) => ({
          ...prev,
          location: {
            lat: latitude,
            lng: longitude,
          },
        }));
        setShowLocationPicker(true);
        toast.success("Location updated! You can adjust the pin on the map.", {
          id: "location",
        });
      },
      (error) => {
        toast.error("Unable to get your location. Please pin manually.", {
          id: "location",
        });
        console.error("Geolocation error:", error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Tab menu items configuration
  const mainTabs = [
    { id: "shop-profile" as const, label: "Shop Profile", icon: User },
    { id: "online-presence" as const, label: "Online Presence", icon: Globe },
    {
      id: "wallet-payouts" as const,
      label: "RepairCoin Wallet & Payouts",
      icon: Wallet,
    },
    { id: "accessibility" as const, label: "Accessibility", icon: Settings },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
  ];

  const accessTabs = [
    { id: "subscription" as const, label: "Subscription", icon: CreditCard },
    { id: "emails" as const, label: "Emails", icon: Mail },
    {
      id: "password" as const,
      label: "Password and authentication",
      icon: Lock,
    },
    { id: "social-media" as const, label: "Social Media", icon: MessageSquare },
    { id: "moderation" as const, label: "Moderation", icon: Shield },
  ];

  return (
    <div className="bg-[#101010] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden">
      {/* Header */}
      <div className="w-full flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white border-b border-[#303236]">
        <p className="text-base sm:text-lg md:text-xl text-[#FFCC00] font-semibold">
          <Settings className="w-4 h-4 inline mr-1.5 text-[#FFCC00]" />
          Settings
        </p>
      </div>

      {/* Main Content - Sidebar + Content */}
      <div className="flex flex-col lg:flex-row">
        {/* Sidebar Navigation */}
        <div className="lg:w-64 xl:w-72 border-b lg:border-b-0 lg:border-r border-[#303236] p-4">
          {/* Main Tabs */}
          <nav className="space-y-1">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-[#FFCC00] text-black"
                    : "text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Access Section */}
          <div className="mt-6">
            <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Access
            </p>
            <nav className="space-y-1 mt-1">
              {accessTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-[#FFCC00] text-black"
                      : "text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
                  }`}
                >
                  <tab.icon className="w-4 h-4 flex-shrink-0" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          {/* Shop Profile Tab Content */}
          {activeTab === "shop-profile" && (
            <>
              {/* Card Title Section */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-[#FFCC00]">
                  Shop Profile
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Basic shop information, location and contact numbers
                </p>
              </div>

              {/* Main Form Grid - 2 columns: fields left, logo right */}
              <div className="grid border-t border-[#3F3F3F] pt-6 grid-cols-1 xl:grid-cols-[1fr_280px] gap-8 xl:gap-12">
                {/* Left Column - Form Fields */}
                <div className="flex flex-col gap-5 order-2 lg:order-1">
                  {/* Shop Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      <Store className="w-4 h-4 inline mr-1.5 text-[#FFCC00]" />
                      Shop Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={shopFormData.name}
                      onChange={handleShopInputChange}
                      disabled={!isEditingShop}
                      className="w-full px-4 py-2 bg-[#F6F8FA] text-[#24292F] rounded-xl border border-[#3F3F3F] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent placeholder:text-gray-500 disabled:bg-[#E8EAED] disabled:cursor-not-allowed"
                      placeholder="Enter shop name"
                    />
                    <p className="mt-1.5 text-xs text-gray-500">
                      This shop name will appear on your RepairCoin profile and
                      customer reward receipts
                    </p>
                  </div>

                  {/* Wallet Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      <Wallet className="w-4 h-4 inline mr-1.5 text-[#FFCC00]" />
                      Wallet Address
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shopData?.walletAddress || ""}
                        disabled
                        className="flex-1 px-4 py-4 bg-[#E8EAED] text-[#24292F] rounded-xl border border-[#3F3F3F] focus:outline-none cursor-not-allowed font-mono text-xs sm:text-sm truncate"
                      />
                      <button
                        onClick={() =>
                          copyToClipboard(
                            shopData?.walletAddress || "",
                            "Wallet address"
                          )
                        }
                        className="px-3 py-2 bg-[#F6F8FA] text-[#24292F] rounded-xl border border-[#3F3F3F] hover:bg-[#E8EAED] transition-colors"
                        title="Copy wallet address"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      This wallet is used for receiving and sending RCN rewards
                    </p>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      <Phone className="w-4 h-4 inline mr-1.5 text-[#FFCC00]" />
                      Phone Number
                    </label>
                    <CountryPhoneInput
                      value={shopFormData.phone}
                      onChange={(phone) =>
                        setShopFormData((prev) => ({ ...prev, phone }))
                      }
                      disabled={!isEditingShop}
                      placeholder="Enter phone number"
                      version="UPDATES2"
                    />
                    <p className="mt-1.5 text-xs text-gray-500">
                      Your main shop contact number for customer inquiries and
                      verification
                    </p>
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      <Mail className="w-4 h-4 inline mr-1.5 text-[#FFCC00]" />
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={shopFormData.email}
                      onChange={handleShopInputChange}
                      disabled={!isEditingShop}
                      className="w-full px-4 py-2 bg-[#F6F8FA] text-[#24292F] rounded-xl border border-[#3F3F3F] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent placeholder:text-gray-500 disabled:bg-[#E8EAED] disabled:cursor-not-allowed"
                      placeholder="shop@example.com"
                    />
                    <p className="mt-1.5 text-xs text-gray-500">
                      We&apos;ll use this email for account notifications and
                      important updates
                    </p>
                  </div>
                </div>

                {/* Right Column - Logo */}
                <div className="flex flex-col items-center order-1 lg:order-2">
                  <label className="block text-sm font-medium text-gray-300 mb-3 self-start lg:self-center">
                    Shop Logo
                  </label>

                  {/* Circular Logo Preview - show when not uploading */}
                  {!showLogoUploader ? (
                    <>
                      <div className="relative">
                        <div className="w-40 h-40 lg:w-48 lg:h-48 rounded-full overflow-hidden bg-[#2F2F2F] border-2 border-[#3F3F3F] flex items-center justify-center shadow-lg">
                          {shopFormData.logoUrl ? (
                            <img
                              src={shopFormData.logoUrl}
                              alt="Shop logo"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Camera className="w-16 h-16 text-gray-500" />
                          )}
                        </div>

                        {/* Edit Button Overlay - only show in edit mode */}
                        {isEditingShop && (
                          <button
                            type="button"
                            onClick={() => setShowLogoUploader(true)}
                            className="absolute bottom-2 right-2 w-10 h-10 bg-[#FFCC00] rounded-full flex items-center justify-center cursor-pointer hover:bg-yellow-500 transition-colors shadow-lg"
                            title="Edit logo"
                          >
                            <Pencil className="w-5 h-5 text-black" />
                          </button>
                        )}
                      </div>
                      <p className="mt-3 text-xs text-gray-500 text-center max-w-[200px]">
                        Upload your company or brand logo here. This image will
                        be used across your profile, communications, and website
                        display
                      </p>
                    </>
                  ) : (
                    /* ImageUploader - show when editing logo */
                    <div className="w-full max-w-[280px]">
                      <ImageUploader
                        imageType="logo"
                        currentImageUrl={shopFormData.logoUrl || undefined}
                        onUploadSuccess={(url) => {
                          handleLogoUpload(url);
                          setShowLogoUploader(false);
                        }}
                        onRemove={() => {
                          handleLogoRemove();
                          setShowLogoUploader(false);
                        }}
                        showPreview={true}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLogoUploader(false)}
                        className="mt-3 w-full px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Social Media Section - Collapsible */}
              <div className="mt-6 border-t border-[#3F3F3F] pt-6">
                <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#FFCC00]" />
                  Social Media & Website
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Website */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Website
                    </label>
                    <input
                      type="url"
                      name="website"
                      value={shopFormData.website}
                      onChange={handleShopInputChange}
                      disabled={!isEditingShop}
                      className="w-full px-4 py-2 bg-[#F6F8FA] text-[#24292F] rounded-xl border border-[#3F3F3F] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent placeholder:text-gray-500 disabled:bg-[#E8EAED] disabled:cursor-not-allowed"
                      placeholder="https://yourshop.com"
                    />
                  </div>
                  {/* Twitter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Twitter
                    </label>
                    <input
                      type="url"
                      name="twitter"
                      value={shopFormData.twitter}
                      onChange={handleShopInputChange}
                      disabled={!isEditingShop}
                      className="w-full px-4 py-2 bg-[#F6F8FA] text-[#24292F] rounded-xl border border-[#3F3F3F] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent placeholder:text-gray-500 disabled:bg-[#E8EAED] disabled:cursor-not-allowed"
                      placeholder="https://twitter.com/yourshop"
                    />
                  </div>
                  {/* Instagram */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Instagram
                    </label>
                    <input
                      type="url"
                      name="instagram"
                      value={shopFormData.instagram}
                      onChange={handleShopInputChange}
                      disabled={!isEditingShop}
                      className="w-full px-4 py-2 bg-[#F6F8FA] text-[#24292F] rounded-xl border border-[#3F3F3F] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent placeholder:text-gray-500 disabled:bg-[#E8EAED] disabled:cursor-not-allowed"
                      placeholder="https://instagram.com/yourshop"
                    />
                  </div>
                  {/* Facebook */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Facebook
                    </label>
                    <input
                      type="url"
                      name="facebook"
                      value={shopFormData.facebook}
                      onChange={handleShopInputChange}
                      disabled={!isEditingShop}
                      className="w-full px-4 py-2 bg-[#F6F8FA] text-[#24292F] rounded-xl border border-[#3F3F3F] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent placeholder:text-gray-500 disabled:bg-[#E8EAED] disabled:cursor-not-allowed"
                      placeholder="https://facebook.com/yourshop"
                    />
                  </div>
                </div>
              </div>

              {/* Location Section */}
              <div className="mt-6 border-t border-[#3F3F3F] pt-6">
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  <MapPin className="w-4 h-4 inline mr-1.5 text-[#FFCC00]" />
                  Shop Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={shopFormData.address}
                  onChange={handleShopInputChange}
                  disabled={!isEditingShop}
                  className="w-full px-4 py-2 bg-[#F6F8FA] text-[#24292F] rounded-xl border border-[#3F3F3F] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent placeholder:text-gray-500 disabled:bg-[#E8EAED] disabled:cursor-not-allowed"
                  placeholder="Door 2, Lot 14, Flex Building, Buffed Avenue, New York City, 8000"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Use your full address for accurate map pinning
                </p>

                {/* Map - always show if coordinates exist or in edit mode */}
                {isEditingShop && (
                  <div className="mt-4">
                    <LocationPickerWrapper
                      initialLocation={
                        shopFormData.location.lat && shopFormData.location.lng
                          ? {
                              latitude: shopFormData.location.lat,
                              longitude: shopFormData.location.lng,
                              address: shopFormData.address,
                            }
                          : undefined
                      }
                      onLocationSelect={
                        isEditingShop ? handleLocationSelect : () => {}
                      }
                      height="450px"
                      version="UPDATES2"
                    />
                  </div>
                )}
              </div>

              {/* Save Edit Button */}
              <div className="mt-6">
                {!isEditingShop ? (
                  <button
                    onClick={() => setIsEditingShop(true)}
                    className="text-xs sm:text-sm px-6 py-3 bg-[#FFCC00] text-black rounded-lg font-medium hover:bg-[#E6B800] transition-all duration-200"
                  >
                    Edit Details
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelShopEdit}
                      className="text-xs sm:text-sm px-6 py-3 bg-transparent text-gray-400 border border-gray-600 rounded-lg font-medium hover:text-white hover:border-gray-400 transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveShopDetails}
                      disabled={loadingShopUpdate}
                      className="text-xs sm:text-sm px-6 py-3 bg-[#FFCC00] text-black rounded-lg font-medium hover:bg-[#E6B800] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingShopUpdate ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                )}
              </div>

              {/* Universal Redemption Notice */}
              <div className="mt-6">
                <div className="bg-green-900/20 border border-green-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-green-400 mb-1">
                    ✅ Universal Redemption Enabled
                  </h4>
                  <p className="text-sm text-green-300">
                    All RepairCoin customers can redeem 100% of their earned RCN
                    at your shop. This maximizes customer convenience and
                    increases foot traffic to your business.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Online Presence Tab Content */}
          {activeTab === "online-presence" && (
            <div>
              <h2 className="text-xl font-semibold text-[#FFCC00] mb-2">
                Online Presence
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                Manage your shop's online visibility and presence
              </p>
              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
                <p className="text-gray-400">
                  Online presence settings coming soon...
                </p>
              </div>
            </div>
          )}

          {/* Wallet & Payouts Tab Content */}
          {activeTab === "wallet-payouts" && (
            <div>
              <h2 className="text-xl font-semibold text-[#FFCC00] mb-2">
                RepairCoin Wallet & Payouts
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                Manage your wallet and payout settings
              </p>
              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
                <p className="text-gray-400">
                  Wallet and payout settings coming soon...
                </p>
              </div>
            </div>
          )}

          {/* Accessibility Tab Content */}
          {activeTab === "accessibility" && (
            <div>
              <h2 className="text-xl font-semibold text-[#FFCC00] mb-2">
                Accessibility
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                Configure accessibility options
              </p>
              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
                <p className="text-gray-400">
                  Accessibility settings coming soon...
                </p>
              </div>
            </div>
          )}

          {/* Notifications Tab Content */}
          {activeTab === "notifications" && (
            <div>
              <h2 className="text-xl font-semibold text-[#FFCC00] mb-2">
                Notifications
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                Manage your notification preferences
              </p>
              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
                <p className="text-gray-400">
                  Notification settings coming soon...
                </p>
              </div>
            </div>
          )}

          {/* Subscription Tab Content */}
          {activeTab === "subscription" && (
            <div>
              <h2 className="text-xl font-semibold text-[#FFCC00] mb-2">
                Subscription
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                Manage your RepairCoin subscription
              </p>
              {shopData && shopData.operational_status !== "rcg_qualified" && (
                <SubscriptionManagement
                  shopId={shopId}
                  shopWallet={shopData.walletAddress}
                />
              )}
            </div>
          )}

          {/* Emails Tab Content */}
          {activeTab === "emails" && (
            <div>
              <h2 className="text-xl font-semibold text-[#FFCC00] mb-2">
                Emails
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                Configure email preferences and notifications
              </p>
              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
                <p className="text-gray-400">Email settings coming soon...</p>
              </div>
            </div>
          )}

          {/* Password Tab Content */}
          {activeTab === "password" && (
            <div>
              <h2 className="text-xl font-semibold text-[#FFCC00] mb-2">
                Password and Authentication
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                Manage your security settings
              </p>
              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
                <p className="text-gray-400">
                  Password and authentication settings coming soon...
                </p>
              </div>
            </div>
          )}

          {/* Social Media Tab Content */}
          {activeTab === "social-media" && (
            <div>
              <h2 className="text-xl font-semibold text-[#FFCC00] mb-2">
                Social Media
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                Connect and manage your social media accounts
              </p>
              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
                <p className="text-gray-400">
                  Social media settings coming soon...
                </p>
              </div>
            </div>
          )}

          {/* Moderation Tab Content */}
          {activeTab === "moderation" && (
            <div>
              <h2 className="text-xl font-semibold text-[#FFCC00] mb-2">
                Moderation
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                Configure content moderation settings
              </p>
              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
                <p className="text-gray-400">
                  Moderation settings coming soon...
                </p>
              </div>
            </div>
          )}

          {/* Status Messages */}
          {error && (
            <div className="bg-red-900 bg-opacity-20 border border-red-500 rounded-xl p-4 mt-6">
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
            <div className="bg-green-900 bg-opacity-20 border border-green-500 rounded-xl p-4 mt-6">
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
      </div>
    </div>
  );
};
