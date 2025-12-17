"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { X } from "lucide-react";
import { CountryPhoneInput } from "../../ui/CountryPhoneInput";

interface Shop {
  shopId: string;
  shop_id?: string;
  name: string;
  email?: string;
  phone?: string;
  // crossShopEnabled removed - universal redemption is now always enabled
  cross_shop_enabled?: boolean;
  active?: boolean;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
  verified?: boolean;
}

interface EditShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: Shop | null;
  onRefresh: () => void;
}

export const EditShopModal: React.FC<EditShopModalProps> = ({
  isOpen,
  onClose,
  shop,
  onRefresh,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    website: "",
    // crossShopEnabled removed - universal redemption is now always enabled
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (shop) {
      console.log("EditShopModal - Loading shop data:", {
        shopId: shop.shopId || shop.shop_id,
        name: shop.name,
        city: shop.city,
        country: shop.country,
        website: shop.website,
        fullShopObject: shop,
      });

      setFormData({
        name: shop.name || "",
        email: shop.email || "",
        phone: shop.phone || "",
        address: shop.address || "",
        city: shop.city || "",
        country: shop.country || "",
        website: shop.website || "",
        // crossShopEnabled removed - universal redemption is now always enabled
      });
    }
  }, [shop]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;

    setIsLoading(true);
    try {
      const shopId = shop.shopId || shop.shop_id;
      const updateData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        website: formData.website,
        // cross_shop_enabled removed - universal redemption is now always enabled
      };

      console.log("EditShopModal - Submitting update:", {
        shopId,
        updateData,
        formData,
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/shops/${shopId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // Important: send cookies for authentication
          body: JSON.stringify(updateData),
        }
      );

      if (response.ok) {
        toast.success("Shop updated successfully");
        // Refresh the shop list to get latest data
        await onRefresh();
        // Don't close modal - just keep it open with updated data
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to update shop");
      }
    } catch (error) {
      console.error("Error updating shop:", error);
      toast.error("Network error while updating shop");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  if (!shop || !isOpen) return null;

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
            Update Shop
          </p>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            disabled={isLoading}
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
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Shop Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={isLoading}
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
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone
                  </label>
                  <CountryPhoneInput
                    value={formData.phone}
                    onChange={(phone) =>
                      setFormData((prev) => ({ ...prev, phone }))
                    }
                    disabled={isLoading}
                    placeholder="Enter phone number"
                  />
                </div>
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
                    Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isLoading}
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
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isLoading}
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
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isLoading}
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
                    onChange={handleChange}
                    placeholder="https://example.com"
                    className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            {/* Universal Redemption Notice */}
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
              <p className="text-sm text-green-400">
                ✅ Universal Redemption Active
              </p>
              <p className="text-xs text-green-400 mt-1">
                All RepairCoin customers can redeem 100% of their earned RCN at
                any participating shop.
              </p>
            </div>

            {/* Shop Status Information */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                Shop Information
              </h4>
              <div className="text-sm text-gray-400 space-y-1">
                <p>
                  <span className="font-medium text-gray-300">Shop ID:</span>{" "}
                  {shop.shopId || shop.shop_id}
                </p>
                <p>
                  <span className="font-medium text-gray-300">Status:</span>{" "}
                  {shop.active ? "Active" : "Suspended"}
                </p>
                <p>
                  <span className="font-medium text-gray-300">Verified:</span>{" "}
                  {shop.verified ? "Yes" : "No"}
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-700 text-white rounded-3xl hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 bg-[#FFCC00] text-black rounded-3xl hover:from-yellow-500 hover:to-orange-500 transition-all disabled:opacity-50"
          >
            {isLoading ? "Updating..." : "Update Shop"}
          </button>
        </div>
      </div>
    </div>
  );
};
