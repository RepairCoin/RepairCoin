"use client";

import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import toast from "react-hot-toast";
import { Mail, User, Phone, MapPin, Bell, Shield, Eye, EyeOff, Key } from "lucide-react";

interface CustomerData {
  address: string;
  email: string;
  name?: string;
  phone?: string;
  referralCode?: string;
  notificationsEnabled?: boolean;
  twoFactorEnabled?: boolean;
}

interface SettingsTabProps {
  customerData: CustomerData | null;
  onUpdateCustomer?: () => void;
}

export function SettingsTab({ customerData, onUpdateCustomer }: SettingsTabProps) {
  const { account } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [formData, setFormData] = useState({
    name: customerData?.name || "",
    email: customerData?.email || "",
    phone: customerData?.phone || "",
    notificationsEnabled: customerData?.notificationsEnabled ?? true,
    twoFactorEnabled: customerData?.twoFactorEnabled ?? false,
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSaveProfile = async () => {
    if (!account?.address) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("customerAuthToken");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/customers/${account.address}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
          }),
        }
      );

      if (response.ok) {
        toast.success("Profile updated successfully!");
        setIsEditing(false);
        if (onUpdateCustomer) {
          onUpdateCustomer();
        }
      } else {
        throw new Error("Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setFormData({
      name: customerData?.name || "",
      email: customerData?.email || "",
      phone: customerData?.phone || "",
      notificationsEnabled: customerData?.notificationsEnabled ?? true,
      twoFactorEnabled: customerData?.twoFactorEnabled ?? false,
    });
    setIsEditing(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-[#FFCC00]" />
            Profile Information
          </h2>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg font-medium hover:bg-[#FFD700] transition-colors"
            >
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={loading}
                className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg font-medium hover:bg-[#FFD700] transition-colors disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Full Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-800 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-800 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              <Phone className="w-4 h-4 inline mr-1" />
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-800 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter your phone number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Wallet Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={account?.address || ""}
                disabled
                className="flex-1 px-4 py-2 bg-[#0D0D0D] border border-gray-800 rounded-lg text-gray-500 cursor-not-allowed truncate"
              />
              <button
                onClick={() => copyToClipboard(account?.address || "", "Wallet address")}
                className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Settings */}
      <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <User className="w-5 h-5 text-[#FFCC00]" />
          Referral Settings
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Your Referral Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customerData?.referralCode || "Not available"}
                disabled
                className="flex-1 px-4 py-2 bg-[#0D0D0D] border border-gray-800 rounded-lg text-gray-500 cursor-not-allowed"
              />
              {customerData?.referralCode && (
                <button
                  onClick={() => copyToClipboard(customerData.referralCode!, "Referral code")}
                  className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Copy
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Share this code with friends to earn 25 RCN when they complete their first repair!
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Referral Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customerData?.referralCode ? `${window.location.origin}/register?ref=${customerData.referralCode}` : "Not available"}
                disabled
                className="flex-1 px-4 py-2 bg-[#0D0D0D] border border-gray-800 rounded-lg text-gray-500 cursor-not-allowed text-sm"
              />
              {customerData?.referralCode && (
                <button
                  onClick={() => copyToClipboard(`${window.location.origin}/register?ref=${customerData.referralCode}`, "Referral link")}
                  className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Copy
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#FFCC00]" />
          Notification Preferences
        </h2>

        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Email Notifications</p>
              <p className="text-sm text-gray-400">Receive updates about your rewards and transactions</p>
            </div>
            <input
              type="checkbox"
              name="notificationsEnabled"
              checked={formData.notificationsEnabled}
              onChange={handleInputChange}
              className="w-5 h-5 text-[#FFCC00] bg-gray-700 border-gray-600 rounded focus:ring-[#FFCC00]"
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Push Notifications</p>
              <p className="text-sm text-gray-400">Get instant alerts on your device</p>
            </div>
            <input
              type="checkbox"
              disabled
              className="w-5 h-5 text-gray-500 bg-gray-700 border-gray-600 rounded cursor-not-allowed opacity-50"
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">SMS Notifications</p>
              <p className="text-sm text-gray-400">Receive text messages for important updates</p>
            </div>
            <input
              type="checkbox"
              disabled
              className="w-5 h-5 text-gray-500 bg-gray-700 border-gray-600 rounded cursor-not-allowed opacity-50"
            />
          </label>
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#FFCC00]" />
          Security Settings
        </h2>

        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Two-Factor Authentication</p>
              <p className="text-sm text-gray-400">Add an extra layer of security to your account</p>
            </div>
            <input
              type="checkbox"
              name="twoFactorEnabled"
              checked={formData.twoFactorEnabled}
              onChange={handleInputChange}
              disabled
              className="w-5 h-5 text-gray-500 bg-gray-700 border-gray-600 rounded cursor-not-allowed opacity-50"
            />
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
              <Key className="w-4 h-4" />
              Private Key
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showPrivateKey ? "text" : "password"}
                  value="••••••••••••••••••••••••••••••••"
                  disabled
                  className="w-full px-4 py-2 pr-10 bg-[#0D0D0D] border border-gray-800 rounded-lg text-gray-500 cursor-not-allowed"
                />
                <button
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                disabled
                className="px-3 py-2 bg-gray-700 text-gray-400 rounded-lg cursor-not-allowed opacity-50"
              >
                Export
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Never share your private key with anyone. RepairCoin staff will never ask for it.
            </p>
          </div>

          <div className="pt-4 border-t border-gray-800">
            <button
              disabled
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-medium opacity-50 cursor-not-allowed"
            >
              Delete Account (Coming Soon)
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              This action cannot be undone. All your data will be permanently deleted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}