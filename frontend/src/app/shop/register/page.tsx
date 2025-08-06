"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

export default function ShopRegistration() {
  const account = useActiveAccount();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [checkingApplication, setCheckingApplication] = useState(false);
  const [existingApplication, setExistingApplication] = useState<{
    hasApplication: boolean;
    status: "pending" | "verified" | null;
    shopName?: string;
    shopId?: string;
  }>({ hasApplication: false, status: null });

  const [formData, setFormData] = useState({
    // Shop Information
    shopId: "",
    name: "", // Company name

    // Personal Information
    firstName: "",
    lastName: "",
    email: "",
    phone: "",

    // Business Information
    address: "", // Street address
    city: "",
    country: "",
    companySize: "",
    monthlyRevenue: "",
    website: "",
    referral: "",

    // Wallet Information
    reimbursementAddress: "",
    fixflowShopId: "",

    // Location (for mapping)
    location: {
      city: "",
      state: "",
      zipCode: "",
      lat: "",
      lng: "",
    },

    // Terms and Conditions
    acceptTerms: false,
  });

  // Check if wallet has existing shop application
  const checkExistingApplication = async (walletAddress: string) => {
    setCheckingApplication(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/wallet/${walletAddress}`
      );
      console.log("Registration check - API Response Status:", response.status);
      console.log("Registration check - Fetching for wallet:", walletAddress);

      if (response.ok) {
        const data = await response.json();
        console.log("Registration check - API Response:", data);
        const shop = data.data;
        if (shop) {
          setExistingApplication({
            hasApplication: true,
            status: shop.verified ? "verified" : "pending",
            shopName: shop.name,
            shopId: shop.shopId || shop.shop_id,
          });
        }
      } else if (response.status === 404) {
        // No shop found - this is normal for new wallets
        setExistingApplication({ hasApplication: false, status: null });
      }
    } catch (error) {
      console.error("Error checking existing application:", error);
      // Don't show error to user, just assume no application
      setExistingApplication({ hasApplication: false, status: null });
    } finally {
      setCheckingApplication(false);
    }
  };

  // Check for existing application when wallet connects
  useEffect(() => {
    if (account?.address) {
      checkExistingApplication(account.address);
    }
  }, [account?.address]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;

    if (name.startsWith("location.")) {
      const locationField = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        location: {
          ...prev.location,
          [locationField]: value,
        },
      }));
    } else if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const registrationData = {
        ...formData,
        walletAddress: account.address,
        reimbursementAddress: formData.reimbursementAddress || account.address,
        location: {
          ...formData.location,
          lat: formData.location.lat
            ? parseFloat(formData.location.lat)
            : undefined,
          lng: formData.location.lng
            ? parseFloat(formData.location.lng)
            : undefined,
        },
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(registrationData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();

        // Handle role conflict errors with specific messaging
        if (response.status === 409 && errorData.conflictingRole) {
          const roleMessage = {
            admin:
              "This wallet is registered as an admin account and cannot be used for shop registration.",
            customer:
              "This wallet is already registered as a customer account. You cannot register the same wallet as both a customer and a shop.",
            shop: "This wallet is already registered to another shop.",
          };

          throw new Error(
            roleMessage[
              errorData.conflictingRole as keyof typeof roleMessage
            ] || errorData.error
          );
        }

        throw new Error(errorData.error || "Registration failed");
      }

      const result = await response.json();
      setSuccess("Shop registered successfully! Awaiting admin verification.");
      console.log("Shop registered:", result);

      // Reset form
      setFormData({
        shopId: "",
        name: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        country: "",
        companySize: "",
        monthlyRevenue: "",
        website: "",
        referral: "",
        reimbursementAddress: "",
        fixflowShopId: "",
        location: {
          city: "",
          state: "",
          zipCode: "",
          lat: "",
          lng: "",
        },
        acceptTerms: false,
      });
    } catch (err) {
      console.error("Registration error:", err);
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-6xl mb-6">🏪</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Shop Registration
            </h1>
            <p className="text-gray-600 mb-8">
              Connect your wallet to register your repair shop
            </p>
            <ConnectButton
              client={client}
              theme="light"
              connectModal={{ size: "wide" }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Show existing application status if application exists
  if (checkingApplication || existingApplication.hasApplication) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center">
              {checkingApplication ? (
                <>
                  <div className="text-6xl mb-6">🔄</div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    Checking Application Status...
                  </h1>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-6"></div>
                  <p className="text-gray-600">
                    Please wait while we check for existing shop applications
                  </p>
                </>
              ) : existingApplication.status === "pending" ? (
                <>
                  <div className="text-6xl mb-6">⏳</div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    Application Already Submitted
                  </h1>
                  <p className="text-gray-600 mb-8">
                    Your shop application is currently being reviewed by our
                    admin team. You cannot submit another application with this
                    wallet.
                  </p>

                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-8">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-4">
                      Application Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                      <div>
                        <p className="text-sm text-yellow-700 font-medium">
                          Shop Name:
                        </p>
                        <p className="text-yellow-900 font-semibold">
                          {existingApplication.shopName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-yellow-700 font-medium">
                          Shop ID:
                        </p>
                        <p className="text-yellow-900 font-mono text-sm">
                          {existingApplication.shopId}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-yellow-700 font-medium">
                          Wallet:
                        </p>
                        <p className="text-yellow-900 font-mono text-sm">
                          {account?.address?.slice(0, 6)}...
                          {account?.address?.slice(-4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-yellow-700 font-medium">
                          Status:
                        </p>
                        <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-yellow-100 text-yellow-800">
                          ⏳ Awaiting Admin Review
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
                    <h4 className="font-semibold text-blue-900 mb-2">
                      What happens next?
                    </h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Admin will review your application details</li>
                      <li>• You'll receive access once approved</li>
                      <li>• Check your shop dashboard for status updates</li>
                      <li>• Contact support if you have questions</li>
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <button
                      onClick={() => router.push("/shop")}
                      className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold rounded-xl transition duration-200 transform hover:scale-105"
                    >
                      View Application Status
                    </button>
                    <div className="text-center">
                      <button
                        onClick={() => router.push("/")}
                        className="text-gray-600 hover:text-gray-900 underline text-sm"
                      >
                        Return to Home
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-6">✅</div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    Shop Already Registered
                  </h1>
                  <p className="text-gray-600 mb-8">
                    Your shop is already registered and verified in the
                    RepairCoin network.
                  </p>

                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 mb-8">
                    <h3 className="text-lg font-semibold text-green-800 mb-4">
                      Shop Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                      <div>
                        <p className="text-sm text-green-700 font-medium">
                          Shop Name:
                        </p>
                        <p className="text-green-900 font-semibold">
                          {existingApplication.shopName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-green-700 font-medium">
                          Shop ID:
                        </p>
                        <p className="text-green-900 font-mono text-sm">
                          {existingApplication.shopId}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-green-700 font-medium">
                          Status:
                        </p>
                        <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">
                          ✅ Verified & Active
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push("/shop")}
                    className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl transition duration-200 transform hover:scale-105"
                  >
                    Go to Shop Dashboard
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-10 pt-36 bg-[#0D0D0D]"
      style={{
        backgroundImage: `url('/img/dashboard-bg.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="max-w-screen-2xl w-[70%] mx-auto">
        {/* Header */}
        <div className="w-full mx-auto bg-black/70 rounded-2xl overflow-hidden mb-12">
          <img src="/img/cus-reg-banner.png" alt="" className="w-full h-full" />
        </div>

        {/* Registration Form */}
        <div className="bg-[#1C1C1C] rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Personal Information */}
            <div>
              <p className="text-lg font-bold text-[#FFCC00] mb-4">
                Personal Information
              </p>
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      First Name <span className="text-[#FFCC00]">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      placeholder="Mike"
                      className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Last Name <span className="text-[#FFCC00]">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      placeholder="Johnson"
                      className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Phone Number <span className="text-[#FFCC00]">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      placeholder="+1-555-0123"
                      className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email Address <span className="text-[#FFCC00]">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      placeholder="mike@electronicsrepair.com"
                      className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Business Information */}
            <div>
              <p className="text-lg font-bold text-[#FFCC00] mb-4">
                Business Information
              </p>
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Shop ID <span className="text-[#FFCC00]">*</span>
                    </label>
                    <input
                      type="text"
                      name="shopId"
                      value={formData.shopId}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., mikes-electronics-repair"
                      className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Unique identifier for your shop
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Company Name <span className="text-[#FFCC00]">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder="Mike's Electronics Repair"
                      className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Company Size <span className="text-[#FFCC00]">*</span>
                    </label>
                    <Select
                      value={formData.companySize}
                      onValueChange={(value) =>
                        handleSelectChange("companySize", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select company size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">1-10 employees</SelectItem>
                        <SelectItem value="11-50">11-50 employees</SelectItem>
                        <SelectItem value="51-100">51-100 employees</SelectItem>
                        <SelectItem value="100+">100+ employees</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Monthly Revenue <span className="text-[#FFCC00]">*</span>
                    </label>
                    <Select
                      value={formData.monthlyRevenue}
                      onValueChange={(value) =>
                        handleSelectChange("monthlyRevenue", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select monthly revenue" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<$10k">Less than $10,000</SelectItem>
                        <SelectItem value="$10k-$50k">
                          $10,000 - $50,000
                        </SelectItem>
                        <SelectItem value="$50k-$100k">
                          $50,000 - $100,000
                        </SelectItem>
                        <SelectItem value="$100k+">$100,000+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Website URL
                    </label>
                    <input
                      type="url"
                      name="website"
                      value={formData.website}
                      onChange={handleInputChange}
                      placeholder="https://www.yourshop.com"
                      className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Referral (Optional)
                    </label>
                    <input
                      type="text"
                      name="referral"
                      value={formData.referral}
                      onChange={handleInputChange}
                      placeholder="Who referred you to RepairCoin?"
                      className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Enter the name or company that referred you
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div>
              <p className="text-lg font-bold text-[#FFCC00] mb-4">
                Address Information
              </p>
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Street Address <span className="text-[#FFCC00]">*</span>
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      required
                      placeholder="123 Main Street"
                      className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      City <span className="text-[#FFCC00]">*</span>
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      required
                      placeholder="New York"
                      className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Country <span className="text-[#FFCC00]">*</span>
                    </label>
                    <Select
                      value={formData.country}
                      onValueChange={(value) =>
                        handleSelectChange("country", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="UK">United Kingdom</SelectItem>
                        <SelectItem value="AU">Australia</SelectItem>
                        <SelectItem value="DE">Germany</SelectItem>
                        <SelectItem value="FR">France</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Wallet Information */}
            <div>
              <p className="text-lg font-bold text-[#FFCC00] mb-4">
                Wallet Information
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Connected Wallet
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl">
                    <span className="font-mono text-sm text-gray-600">
                      {account.address.slice(0, 6)}...
                      {account.address.slice(-4)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Used for shop operations and token management
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Reimbursement Address (Optional)
                  </label>
                  <input
                    type="text"
                    name="reimbursementAddress"
                    value={formData.reimbursementAddress}
                    onChange={handleInputChange}
                    placeholder="0x... (defaults to connected wallet)"
                    className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Where to receive payments for token redemptions
                  </p>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div>
              <p className="text-lg font-bold text-[#FFCC00] mb-4">
                Additional Information (Optional)
              </p>
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      FixFlow Shop ID (Optional)
                    </label>
                    <input
                      type="text"
                      name="fixflowShopId"
                      value={formData.fixflowShopId}
                      onChange={handleInputChange}
                      placeholder="shop_123"
                      className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      If you use FixFlow for repairs
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      State/Province
                    </label>
                    <input
                      type="text"
                      name="location.state"
                      value={formData.location.state}
                      onChange={handleInputChange}
                      placeholder="NY"
                      className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      ZIP/Postal Code
                    </label>
                    <input
                      type="text"
                      name="location.zipCode"
                      value={formData.location.zipCode}
                      onChange={handleInputChange}
                      placeholder="10001"
                      className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="bg-[#1C1C1C] rounded-2xl shadow-xl py-10">
              <div className="w-full">
                <h2 className="text-3xl font-bold text-[#FFA500] mb-2">
                  Terms and Conditions
                </h2>
                <p className="text-white font-bold text-lg mb-6">
                  Your Agreement
                </p>

                <ul className="space-y-4 mb-6">
                  {[
                    "Your shop will need admin verification before activation",
                    "You'll be able to purchase RCN at $0.10 each",
                    "Tier bonuses will be automatically deducted from your RCN Balance",
                    "Cross hop redemption can be enabled after verification",
                    "All transactions are recorded on the blockchain",
                    "You agree to comply with all RepairCoin network policies",
                  ].map((item, index) => (
                    <li key={index} className="flex items-start">
                      <svg
                        className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-white">{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex items-start">
                  <input
                    type="checkbox"
                    name="acceptTerms"
                    checked={formData.acceptTerms}
                    onChange={handleInputChange}
                    required
                    className="mt-1 mr-3 w-5 h-5 rounded border-gray-300 text-[#FFA500] focus:ring-[#FFA500]"
                  />
                  <label htmlFor="termsCheckbox" className="text-white text-sm">
                    I confirm that I have read and accept the terms and
                    conditions and privacy policy.
                  </label>
                </div>
              </div>
            </div>


            {/* Submit Button */}
            <div className="flex justify-center pt-6">
              <button
                type="submit"
                disabled={loading || !formData.acceptTerms}
                className="w-[200px] mx-auto  px-8 py-2 bg-[#FFCC00] text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 transform hover:scale-105"
                >
                {loading ? 'Registering Shop...' : 'Register Shop'}
              </button>
            </div>
          </form>

          {/* Success Message */}
          {success && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="text-green-400 text-2xl mr-3">✅</div>
                <div>
                  <h3 className="text-sm font-medium text-green-800">
                    Registration Successful!
                  </h3>
                  <div className="mt-2 text-sm text-green-700">{success}</div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="text-red-400 text-2xl mr-3">⚠️</div>
                <div>
                  <h3 className="text-sm font-medium text-red-800">
                    Registration Failed
                  </h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
