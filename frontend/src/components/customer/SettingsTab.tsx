"use client";

import { useState, useEffect, useRef } from "react";
import { useCustomer } from "@/hooks/useCustomer";
import { customerApi, uploadProfileImage } from "@/services/api/customer";
import toast from "react-hot-toast";
import {
  Mail,
  User,
  Phone,
  Wallet,
  QrCode,
  Download,
  X,
  Settings,
  Copy,
  Camera,
  Loader2,
  ImageIcon,
} from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import QRCode from "qrcode";
import { useAuthStore } from "@/stores/authStore";
import { SuspendedActionModal } from "./SuspendedActionModal";
import { NotificationPreferences } from "./NotificationPreferences";
import { CountryPhoneInput } from "../ui/CountryPhoneInput";

export function SettingsTab() {
  const account = useActiveAccount();
  const { userProfile } = useAuthStore();
  const {
    customerData,
    isLoading,
    fetchCustomerData,
  } = useCustomer();

  const [isEditing, setIsEditing] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState("");
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user is suspended
  const isSuspended = userProfile?.suspended || false;
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize form data from store
  useEffect(() => {
    if (customerData) {
      setFormData({
        first_name: customerData.first_name || "",
        last_name: customerData.last_name || "",
        email: customerData.email || "",
        phone: customerData.phone || "",
      });
      setProfileImageUrl(customerData.profile_image_url || null);
    }
  }, [customerData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
        fetchCustomerData(true);
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
    });
    setIsEditing(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, GIF, or WebP image.");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB.");
      return;
    }

    setUploadingImage(true);
    try {
      const result = await uploadProfileImage(file);
      if (result.success && result.url) {
        setProfileImageUrl(result.url);
        toast.success("Profile image updated!");
        fetchCustomerData(true);
      } else {
        toast.error(result.error || "Failed to upload image.");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image. Please try again.");
    } finally {
      setUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const getInitials = () => {
    const first = formData.first_name?.charAt(0) || "";
    const last = formData.last_name?.charAt(0) || "";
    if (first || last) return (first + last).toUpperCase();
    return "?";
  };

  const generateQRCode = async () => {
    if (isSuspended) {
      setShowSuspendedModal(true);
      return;
    }

    if (!account?.address) {
      toast.error("No wallet address found");
      return;
    }

    try {
      const qrData = await QRCode.toDataURL(account.address, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
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

    const link = document.createElement("a");
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
  

      {/* Your Profile Details */}
      <div className="bg-[#212121] rounded-2xl overflow-hidden border border-gray-800/50">
          {/* Section Header */}
      <div className="flex items-center gap-3  px-6 py-4">
        <div className="w-10 h-10 rounded-xl bg-[#FFCC00]/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-[#FFCC00]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[#FFCC00]">Settings</h2>
          <p className="text-sm text-gray-400">
            Manage your profile details and preferences
          </p>
        </div>
      </div>
        <div className="flex justify-between items-start px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-[#FFCC00]">
              Your Profile Details
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">
              Basic profile information, location and contact numbers.
            </p>
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm px-5 py-2 bg-[#FFCC00] text-black rounded-full font-medium hover:bg-yellow-400 transition-colors"
            >
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                className="text-sm px-5 py-2 bg-gray-700 text-white rounded-full font-medium hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={loading}
                className="text-sm px-5 py-2 bg-[#FFCC00] text-black rounded-full font-medium hover:bg-yellow-400 transition-colors disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8 p-6">
          {/* Left: Form Fields */}
          <div className="flex-1 space-y-5">
            {/* First Name */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-white mb-1.5">
                <User className="w-4 h-4 text-[#FFCC00]" />
                First Name
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full px-4 py-3 bg-[#2F2F2F] text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                placeholder="Enter your first name"
              />
              <p className="text-xs text-gray-500 mt-1">
                This name will appear on your RepairCoin profile and customer reward receipts.
              </p>
            </div>

            {/* Last Name */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-white mb-1.5">
                <User className="w-4 h-4 text-[#FFCC00]" />
                Last Name
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full px-4 py-3 bg-[#2F2F2F] text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                placeholder="Enter your last name"
              />
              <p className="text-xs text-gray-500 mt-1">
                This name will appear on your RepairCoin profile and customer reward receipts.
              </p>
            </div>

            {/* Wallet Address */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-white mb-1.5">
                <Wallet className="w-4 h-4 text-[#FFCC00]" />
                Wallet Address
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={account?.address || ""}
                  disabled
                  className="flex-1 px-4 py-3 bg-[#2F2F2F] text-gray-400 rounded-xl border border-gray-700 focus:outline-none cursor-not-allowed font-mono text-sm truncate"
                />
                <button
                  onClick={() =>
                    copyToClipboard(account?.address || "", "Wallet address")
                  }
                  className="px-3 py-3 bg-[#2F2F2F] border border-gray-700 text-gray-400 rounded-xl hover:text-[#FFCC00] hover:border-[#FFCC00]/50 transition-colors"
                  title="Copy wallet address"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This wallet is used for receiving and sending RCN rewards.
              </p>
            </div>

            {/* Phone Number */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-white mb-1.5">
                <Phone className="w-4 h-4 text-[#FFCC00]" />
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
              <p className="text-xs text-gray-500 mt-1">
                Your main contact number for customer inquiries and verification.
              </p>
            </div>

            {/* Email Address */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-white mb-1.5">
                <Mail className="w-4 h-4 text-[#FFCC00]" />
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="w-full px-4 py-3 bg-[#2F2F2F] text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                placeholder="Enter your email"
              />
              <p className="text-xs text-gray-500 mt-1">
                We&apos;ll use this email for account notifications and important updates.
              </p>
            </div>
          </div>

          {/* Right: Profile Image */}
          <div className="lg:w-64 flex flex-col items-center">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-[#FFCC00] mb-1">
              <ImageIcon className="w-4 h-4" />
              Your Profile Image
            </h4>
            <p className="text-xs text-gray-500 mb-4 text-center">
              Upload your photo here. This image will be used across your profile, communications, and website display.
            </p>

            {/* Avatar */}
            <div className="relative group">
              <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-gray-700 group-hover:border-[#FFCC00]/50 transition-colors">
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#2F2F2F] flex items-center justify-center">
                    <span className="text-4xl font-bold text-gray-400">
                      {getInitials()}
                    </span>
                  </div>
                )}
              </div>

              {/* Edit overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer disabled:cursor-not-allowed"
              >
                {uploadingImage ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="mt-4 text-sm px-5 py-2 bg-[#2F2F2F] text-gray-300 rounded-full border border-gray-700 hover:border-[#FFCC00]/50 hover:text-white transition-colors disabled:opacity-50"
            >
              {uploadingImage ? "Uploading..." : "Edit"}
            </button>
            <p className="text-xs text-gray-600 mt-2 text-center">
              JPEG, PNG, GIF or WebP. Max 5MB.
            </p>
          </div>
        </div>
      </div>

      {/* QR Code for Redemption */}
      <div className="bg-[#212121] rounded-2xl overflow-hidden border border-gray-800/50">
        <div className="px-6 py-4">
          <h3 className="text-lg font-semibold text-[#FFCC00]">
            QR Code for Redemption
          </h3>
          <p className="text-sm text-gray-400 mt-0.5">
            Share your wallet address with shops for easy token redemption.
          </p>
        </div>
        <div className="px-6 py-8">
          <div className="text-center">
            <QrCode className="w-14 h-14 mx-auto mb-3 text-[#FFCC00]" />
            <p className="text-gray-300 text-sm mb-5 max-w-md mx-auto">
              Generate a QR code with your wallet address to share with shops
              for easy redemption
            </p>
            <button
              onClick={generateQRCode}
              className="px-6 py-3 bg-[#FFCC00] text-black rounded-full font-medium hover:bg-yellow-400 transition-colors"
            >
              Generate QR Code
            </button>
          </div>
        </div>
      </div>

      {/* Appointment Reminder Notification Preferences */}
      <NotificationPreferences />

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] rounded-2xl max-w-md w-full mx-4 border border-gray-800/50">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h3 className="text-xl font-semibold text-white">
                Wallet Address QR Code
              </h3>
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

                  <div className="text-sm text-gray-300 break-all bg-[#2F2F2F] p-3 rounded-lg font-mono">
                    {account?.address}
                  </div>

                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() =>
                        copyToClipboard(
                          account?.address || "",
                          "Wallet address"
                        )
                      }
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Copy Address
                    </button>
                    <button
                      onClick={downloadQRCode}
                      className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-yellow-400 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download QR
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 mt-4">
                    Share this QR code with shops to make redemption faster and
                    easier
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
