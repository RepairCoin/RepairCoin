"use client";

import { useState, useEffect } from "react";
import { useCustomer } from "@/hooks/useCustomer";
import { customerApi } from "@/services/api/customer";
import toast from "react-hot-toast";
import {
  Mail,
  User,
  Phone,
  MapPin,
  Bell,
  Shield,
  Eye,
  EyeOff,
  Key,
  QrCode,
  Download,
  X,
} from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import QRCode from "qrcode";
import { useAuthStore } from "@/stores/authStore";
import { SuspendedActionModal } from "./SuspendedActionModal";
import { CountryPhoneInput } from "../ui/CountryPhoneInput";

interface CustomerData {
  address: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  referralCode?: string;
  notificationsEnabled?: boolean;
  twoFactorEnabled?: boolean;
}

export function SettingsTab() {
  const account = useActiveAccount();
  const { userProfile } = useAuthStore();
  const {
    customerData,
    isLoading,
    fetchCustomerData,
  } = useCustomer();

  const [isEditing, setIsEditing] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState("");
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);

  // Check if user is suspended
  const isSuspended = userProfile?.suspended || false;
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    notificationsEnabled: true,
    twoFactorEnabled: false,
  });
  const [loading, setLoading] = useState(false);

  // Initialize form data from store
  useEffect(() => {
    if (customerData) {
      setFormData({
        first_name: customerData.first_name || "",
        last_name: customerData.last_name || "",
        email: customerData.email || "",
        phone: customerData.phone || "",
        notificationsEnabled: customerData.notificationsEnabled ?? true,
        twoFactorEnabled: customerData.twoFactorEnabled ?? false,
      });
    }
  }, [customerData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSaveProfile = async () => {
    if (!account?.address) return;

    setLoading(true);
    try {
      const updatedCustomer = await customerApi.updateProfile(
        account.address,
        {
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
        }
      );

      if (updatedCustomer) {
        toast.success("Profile updated successfully!");
        setIsEditing(false);
        fetchCustomerData(true); // Force refresh data after update
      } else {
        throw new Error("Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setFormData({
      first_name: customerData?.first_name || "",
      last_name: customerData?.last_name || "",
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

  const generateQRCode = async () => {
    // Check if suspended
    if (isSuspended) {
      setShowSuspendedModal(true);
      return;
    }

    if (!account?.address) {
      toast.error("No wallet address found");
      return;
    }

    try{
      const qrData = await QRCode.toDataURL(account.address, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeData(qrData);
      setShowQRModal(true);
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error("Failed to generate QR code");
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeData) return;
    
    const link = document.createElement('a');
    link.download = `wallet-qr-${account?.address?.slice(0, 6)}.png`;
    link.href = qrCodeData;
    link.click();
    toast.success("QR code downloaded!");
  };

  // Only show loading on initial load, not when switching tabs
  if (isLoading && !customerData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-400 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Information */}
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
            Profile Information
          </p>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs sm:text-sm px-4 py-2 bg-black text-white rounded-3xl font-medium hover:bg-gray-900 transition-colors"
            >
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                className="text-xs sm:text-sm px-4 py-2 bg-black text-white rounded-3xl font-medium hover:bg-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={loading}
                className="text-xs sm:text-sm px-4 py-2 bg-black text-white rounded-3xl font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          <div className="flex flex-col gap-6">
            <div>
              <label className="block text-sm sm:text-base font-medium text-gray-300 mb-2">
                <User className="w-6 h-6 inline mr-1" />
                First Name
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your first name"
              />
            </div>

            <div>
              <label className="block text-sm sm:text-base font-medium text-gray-300 mb-2">
                <User className="w-6 h-6 inline mr-1" />
                Last Name
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your last name"
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
                value={formData.email}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <label className="block text-sm sm:text-base font-medium text-gray-300 mb-2">
                <Phone className="w-6 h-6 inline mr-1" />
                Phone Number
              </label>
              <CountryPhoneInput
                value={formData.phone}
                onChange={(phone) =>
                  setFormData((prev) => ({ ...prev, phone }))
                }
                disabled={!isEditing}
                placeholder="Enter phone number"
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
                  value={account?.address || ""}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-not-allowed"
                />
                <button
                  onClick={() =>
                    copyToClipboard(account?.address || "", "Wallet address")
                  }
                  className="text-xs sm:text-sm px-8 bg-[#FFCC00] text-black rounded-3xl font-medium hover:bg-yellow-500 transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code for Redemption */}
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
            QR Code for Redemption
          </p>
        </div>
        <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          <div className="text-center">
            <QrCode className="w-16 h-16 mx-auto mb-4 text-[#FFCC00]" />
            <p className="text-gray-300 text-sm sm:text-base mb-6">
              Generate a QR code with your wallet address to share with shops for easy redemption
            </p>
            <button
              onClick={generateQRCode}
              className="px-6 py-3 bg-[#FFCC00] text-black rounded-3xl font-medium hover:bg-yellow-500 transition-colors"
            >
              Generate QR Code
            </button>
          </div>
        </div>
      </div>

      <div className="w-full flex flex-col md:flex-row gap-8">

        {/* Notification Preferences */}
        {/* <div className="bg-[#212121] w-full rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden">
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
              Notification Preferences
            </p>
          </div>

          <div className="space-y-3 sm:space-y-6 px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
            <label className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Email Notifications</p>
                <p className="text-xs sm:text-sm text-gray-400">
                  Receive updates about your rewards and transactions
                </p>
              </div>
              <input
                type="checkbox"
                name="notificationsEnabled"
                checked={formData.notificationsEnabled}
                onChange={handleInputChange}
                className="w-5 h-5 text-[#FFCC00] bg-gray-700 border-gray-600 rounded focus:ring-[#FFCC00]"
              />
            </label>
          </div>
        </div> */}
      </div>

      {/* Security Settings */}
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
            Security Settings
          </p>
        </div>

        <div className="space-y-3 sm:space-y-6 px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium text-sm sm:text-base">
                Two-Factor Authentication
              </p>
              <p className="text-xs sm:text-sm text-gray-400">
                Add an extra layer of security to your account
              </p>
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
            <label className="text-sm sm:text-base font-medium text-gray-400 mb-2 flex items-center gap-2">
              <Key className="w-4 h-4" />
              Private Key
            </label>
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <input
                  type={showPrivateKey ? "text" : "password"}
                  value="••••••••••••••••••••••••••••••••"
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-not-allowed"
                />
                <button
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPrivateKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <button
                disabled
                className="text-sm sm:text-base px-6 py-2 bg-gray-700 text-gray-400 rounded-3xl cursor-not-allowed opacity-50"
              >
                Export
              </button>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-2">
              Never share your private key with anyone. RepairCoin staff will
              never ask for it.
            </p>
          </div>

          <div className="flex flex-col justify-center items-center pt-4 border-t border-gray-800">
            <button
              disabled
              className="text-sm sm:text-base md:w-1/2 px-4 py-2 bg-red-600 text-white rounded-3xl font-medium opacity-50 cursor-not-allowed"
            >
              Delete Account (Coming Soon)
            </button>
            <p className="text-xs sm:text-sm text-gray-500 mt-2">
              This action cannot be undone. All your data will be permanently
              deleted.
            </p>
          </div>
        </div>
      </div> */}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] rounded-2xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h3 className="text-xl font-semibold text-white">Wallet Address QR Code</h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 text-center">
              {qrCodeData && (
                <div className="space-y-4">
                  <img 
                    src={qrCodeData} 
                    alt="Wallet Address QR Code" 
                    className="mx-auto bg-white p-4 rounded-lg"
                  />
                  
                  <div className="text-sm text-gray-300 break-all bg-[#2F2F2F] p-3 rounded-lg">
                    {account?.address}
                  </div>
                  
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => copyToClipboard(account?.address || "", "Wallet address")}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Copy Address
                    </button>
                    <button
                      onClick={downloadQRCode}
                      className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-yellow-500 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download QR
                    </button>
                  </div>
                  
                  <p className="text-xs text-gray-400 mt-4">
                    Share this QR code with shops to make redemption faster and easier
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Suspended Action Modal */}
      <SuspendedActionModal
        isOpen={showSuspendedModal}
        onClose={() => setShowSuspendedModal(false)}
        action="generate QR code"
        reason={userProfile?.suspensionReason}
      />
    </div>
  );
}
