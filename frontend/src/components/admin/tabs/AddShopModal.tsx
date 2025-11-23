"use client";

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { X } from "lucide-react";

interface AddShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddShopModal: React.FC<AddShopModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    shop_id: "",
    name: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    wallet_address: "",
    address: "",
    city: "",
    country: "",
    website: "",
    description: "",
    companySize: "",
    monthlyRevenue: "",
    referralCode: "",
    verified: false,
    active: true,
    // cross_shop_enabled removed - universal redemption is now always enabled,
  });

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (
      !formData.shop_id ||
      !formData.name ||
      !formData.email ||
      !formData.phone ||
      !formData.wallet_address ||
      !formData.address
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate wallet address format
    if (!formData.wallet_address.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast.error("Invalid wallet address format");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/create-shop`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: 'include', // Important: send cookies for authentication
          body: JSON.stringify({
            shop_id: formData.shop_id,
            name: formData.name,
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            wallet_address: formData.wallet_address.toLowerCase(),
            address: formData.address,
            city: formData.city,
            country: formData.country,
            website: formData.website,
            description: formData.description,
            companySize: formData.companySize,
            monthlyRevenue: formData.monthlyRevenue,
            referralCode: formData.referralCode,
            verified: formData.verified,
            active: formData.active,
            // cross_shop_enabled removed - universal redemption is now always enabled,
          }),
        }
      );

      if (response.ok) {
        toast.success("Shop created successfully!");

        // Reset form
        setFormData({
          shop_id: "",
          name: "",
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          wallet_address: "",
          address: "",
          city: "",
          country: "",
          website: "",
          description: "",
          companySize: "",
          monthlyRevenue: "",
          referralCode: "",
          verified: false,
          active: true,
          // cross_shop_enabled removed - universal redemption is now always enabled,
        });

        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to create shop");
      }
    } catch (error) {
      console.error("Error creating shop:", error);
      toast.error("Network error while creating shop");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#212121] border border-gray-800 rounded-xl shadow-2xl w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-3xl transform transition-all">
        <div
          className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
            Add New Shop
          </p>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-900" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Shop Information */}
            <div className="border-b border-gray-700 pb-6">
              <h3 className="text-lg font-semibold text-[#FFCC00] mb-4">
                Shop Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Shop ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="shop_id"
                    value={formData.shop_id}
                    onChange={handleInputChange}
                    placeholder="unique-shop-id"
                    className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Shop Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="My Repair Shop"
                    className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="border-b border-gray-700 pb-6">
              <h3 className="text-lg font-semibold text-[#FFCC00] mb-4">
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Wallet Information */}
            <div className="border-b border-gray-700 pb-6">
              <h3 className="text-lg font-semibold text-[#FFCC00] mb-4">
                Wallet Information
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Wallet Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="wallet_address"
                  value={formData.wallet_address}
                  onChange={handleInputChange}
                  placeholder="0x..."
                  className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Location Information */}
            <div className="border-b border-gray-700 pb-6">
              <h3 className="text-lg font-semibold text-[#FFCC00] mb-4">
                Location Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Business Information */}
            <div className="border-b border-gray-700 pb-6">
              <h3 className="text-lg font-semibold text-[#FFCC00] mb-4">
                Business Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    placeholder="https://example.com"
                    className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brief description of the shop..."
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Company Size
                    </label>
                    <select
                      name="companySize"
                      value={formData.companySize}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loading}
                    >
                      <option value="">Select size</option>
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-100">51-100 employees</option>
                      <option value="100+">100+ employees</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Monthly Revenue
                    </label>
                    <select
                      name="monthlyRevenue"
                      value={formData.monthlyRevenue}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loading}
                    >
                      <option value="">Select revenue</option>
                      <option value="<$10k">Less than $10k</option>
                      <option value="$10k-$50k">$10k - $50k</option>
                      <option value="$50k-$100k">$50k - $100k</option>
                      <option value="$100k+">$100k+</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Referral Code
                  </label>
                  <input
                    type="text"
                    name="referralCode"
                    value={formData.referralCode}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">
                Settings
              </h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="verified"
                    checked={formData.verified}
                    onChange={handleInputChange}
                    className="w-5 h-5 bg-gray-800 border-gray-600 rounded text-yellow-400 focus:ring-yellow-400"
                    disabled={loading}
                  />
                  <span className="text-gray-300">Shop is verified</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="active"
                    checked={formData.active}
                    onChange={handleInputChange}
                    className="w-5 h-5 bg-gray-800 border-gray-600 rounded text-yellow-400 focus:ring-yellow-400"
                    disabled={loading}
                  />
                  <span className="text-gray-300">Shop is active</span>
                </label>

                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                  <p className="text-sm text-green-400">
                    ✅ Universal redemption is automatically enabled for all shops - 
                    customers can redeem 100% of earned RCN at any participating shop.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-gray-700 text-white rounded-3xl hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-[#FFCC00] text-black rounded-3xl hover:from-yellow-500 hover:to-orange-500 transition-all disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Shop"}
          </button>
        </div>
      </div>
    </div>
  );
};
