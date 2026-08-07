"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useCustomer } from "@/hooks/useCustomer";
import { customerApi, uploadProfileImage } from "@/services/api/customer";
import { FormSkeleton } from "@/components/ui/skeleton";
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
  Bell,
  Ban,
  Accessibility as AccessibilityIcon,
  ShieldCheck,
  CalendarCheck,
  Clock,
  MessageSquareWarning,
} from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import QRCode from "qrcode";
import { useAuthStore } from "@/stores/authStore";
import { useBlockchainEnabled } from "@/contexts/AppConfigContext";
import { SuspendedActionModal } from "./SuspendedActionModal";
import { NotificationPreferences } from "./NotificationPreferences";
import { CountryPhoneInput } from "../ui/CountryPhoneInput";
import CustomerNoShowBadge from "./CustomerNoShowBadge";
import { AccountStandingStats } from "./AccountStandingStats";
import DisputeModal from "./DisputeModal";
import { CustomerNoShowStatus, NoShowHistoryEntry, getOverallCustomerNoShowStatus, getCustomerNoShowHistory } from "@/services/api/noShow";
import { AccessibilitySettings } from "../accessibility/AccessibilitySettings";
import { GeneralNotificationSettings } from "../notifications/GeneralNotificationSettings";

type SettingsSection = "profile" | "notifications" | "accessibility" | "no-show";

const SECTIONS: { id: SettingsSection; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "accessibility", label: "Accessibility", icon: AccessibilityIcon },
  { id: "no-show", label: "Account Standing", icon: Ban },
];

export function SettingsTab() {
  const account = useActiveAccount();
  const searchParams = useSearchParams();
  const { userProfile, switchingAccount } = useAuthStore();
  const walletAddress = account?.address || userProfile?.address;
  const blockchainEnabled = useBlockchainEnabled();
  // In database-only mode the address is just the account's redemption ID, not a crypto wallet.
  const idLabel = blockchainEnabled ? "Wallet Address" : "RepairCoin ID";
  const {
    customerData,
    isLoading,
    fetchCustomerData,
  } = useCustomer();

  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState("");
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [noShowStatus, setNoShowStatus] = useState<CustomerNoShowStatus | null>(null);
  const [loadingNoShowStatus, setLoadingNoShowStatus] = useState(false);
  const [noShowHistory, setNoShowHistory] = useState<NoShowHistoryEntry[]>([]);
  const [disputeModalEntry, setDisputeModalEntry] = useState<NoShowHistoryEntry | null>(null);

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

  // Deep-link a section via ?section= (matches the shop settings behavior).
  useEffect(() => {
    const section = searchParams?.get("section");
    if (
      section === "profile" ||
      section === "notifications" ||
      section === "accessibility" ||
      section === "no-show"
    ) {
      setActiveSection(section);
    }
  }, [searchParams]);

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

  // Fetch no-show status and history
  useEffect(() => {
    const fetchNoShowData = async () => {
      if (!account?.address || switchingAccount) return;

      setLoadingNoShowStatus(true);
      try {
        const [status, history] = await Promise.all([
          getOverallCustomerNoShowStatus(account.address),
          getCustomerNoShowHistory(account.address, 10),
        ]);
        setNoShowStatus(status);
        setNoShowHistory(history);
      } catch (error) {
        console.error('Error fetching no-show data:', error);
        // Silent fail - don't show error to user
      } finally {
        setLoadingNoShowStatus(false);
      }
    };

    fetchNoShowData();
  }, [account?.address, switchingAccount]);

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

    if (!walletAddress) {
      toast.error("No wallet address found");
      return;
    }

    try {
      const qrData = await QRCode.toDataURL(walletAddress, {
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
    link.download = `wallet-qr-${walletAddress?.slice(0, 6)}.png`;
    link.href = qrCodeData;
    link.click();
    toast.success("QR code downloaded!");
  };

  // Only show loading on initial load, not when switching tabs
  if (isLoading && !customerData) {
    return <FormSkeleton fields={6} />;
  }

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
          <nav className="space-y-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeSection === section.id
                    ? "bg-[#FFCC00] text-black"
                    : "text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
                }`}
              >
                <section.icon className="w-4 h-4 flex-shrink-0" />
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          {/* ── Profile ─────────────────────────────────────────────── */}
          {activeSection === "profile" && (
            <>
              <div className="bg-[#212121] rounded-2xl overflow-hidden border border-gray-800/50">
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

                    {/* Account ID / Wallet Address */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-bold text-white mb-1.5">
                        <Wallet className="w-4 h-4 text-[#FFCC00]" />
                        {idLabel}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={walletAddress || ""}
                          disabled
                          className="flex-1 px-4 py-3 bg-[#2F2F2F] text-gray-400 rounded-xl border border-gray-700 focus:outline-none cursor-not-allowed font-mono text-sm truncate"
                        />
                        <button
                          onClick={() => copyToClipboard(walletAddress || "", idLabel)}
                          className="px-3 py-3 bg-[#2F2F2F] border border-gray-700 text-gray-400 rounded-xl hover:text-[#FFCC00] hover:border-[#FFCC00]/50 transition-colors"
                          title={`Copy ${idLabel}`}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {blockchainEnabled
                          ? "This wallet is used for receiving and sending RCN rewards."
                          : "This is your unique ID that shops use to give you rewards."}
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
                        Your main contact number for appointment reminders and verification.
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
                    Share your {idLabel} with shops for easy redemption.
                  </p>
                </div>
                <div className="px-6 py-8">
                  <div className="text-center">
                    <QrCode className="w-14 h-14 mx-auto mb-3 text-[#FFCC00]" />
                    <p className="text-gray-300 text-sm mb-5 max-w-md mx-auto">
                      Generate a QR code with your {idLabel} to share with shops
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
            </>
          )}

          {/* ── Notifications ───────────────────────────────────────── */}
          {activeSection === "notifications" && (
            <>
              <GeneralNotificationSettings userType="customer" />
              <NotificationPreferences />
            </>
          )}

          {/* ── Accessibility ───────────────────────────────────────── */}
          {activeSection === "accessibility" && <AccessibilitySettings />}

          {/* ── Account Standing (No-Show) ──────────────────────────── */}
          {activeSection === "no-show" && (
            <div className="bg-[#212121] rounded-2xl overflow-hidden border border-gray-800/50">
              <div className="px-6 py-4 border-b border-gray-800/50">
                <h3 className="text-lg font-semibold text-[#FFCC00]">Account Standing</h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  Your current standing based on appointment history
                </p>
              </div>
              <div className="p-6">
                {loadingNoShowStatus ? (
                  <p className="text-sm text-gray-400">Loading your account standing…</p>
                ) : noShowStatus ? (
                  <>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <CustomerNoShowBadge status={noShowStatus} size="lg" showDetails={true} />
                      {noShowStatus.restrictions.length > 0 && (
                        <div className="flex-1 space-y-1">
                          {noShowStatus.restrictions.map((r, i) => (
                            <p key={i} className="text-xs text-orange-400">⚠ {r}</p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* No-Show History with Dispute Buttons */}
                    {noShowHistory.length > 0 && (
                      <div className="mt-5">
                        <h4 className="text-sm font-semibold text-gray-300 mb-3">No-Show History</h4>
                        <div className="space-y-2">
                          {noShowHistory.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between p-3 bg-[#2A2A2A] rounded-xl border border-gray-700/50"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-200">
                                  {new Date(entry.scheduledTime).toLocaleDateString('en-US', {
                                    month: 'short', day: 'numeric', year: 'numeric'
                                  })}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Marked on {new Date(entry.markedNoShowAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {entry.disputed ? (
                                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                    entry.disputeStatus === 'approved'
                                      ? 'bg-green-500/10 text-green-400 border-green-500/30'
                                      : entry.disputeStatus === 'rejected'
                                      ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  }`}>
                                    {entry.disputeStatus === 'approved' ? '✓ Approved'
                                      : entry.disputeStatus === 'rejected' ? '✗ Rejected'
                                      : '⏳ Pending'}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setDisputeModalEntry(entry)}
                                    className="text-xs px-3 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg transition-colors"
                                  >
                                    Dispute
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-6">
                    {/* Good-standing hero */}
                    <div className="flex items-start gap-4 rounded-xl border border-green-500/30 bg-green-500/[0.06] p-5">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-500/15">
                        <ShieldCheck className="h-6 w-6 text-green-400" />
                      </span>
                      <div>
                        <p className="text-base font-semibold text-white">
                          Your account is in good standing
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                          No missed appointments on record. You can book freely with no deposits
                          or restrictions — keep it up!
                        </p>
                      </div>
                    </div>

                    {/* Appointment history stats */}
                    <AccountStandingStats />

                    {/* What this means */}
                    <div>
                      <h4 className="mb-3 text-sm font-semibold text-gray-300">What good standing gives you</h4>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <StandingPerk
                          icon={<CalendarCheck className="h-4 w-4 text-green-400" />}
                          title="Book instantly"
                          desc="Reserve any appointment without a deposit."
                        />
                        <StandingPerk
                          icon={<Clock className="h-4 w-4 text-green-400" />}
                          title="No restrictions"
                          desc="Full access to every shop and service."
                        />
                        <StandingPerk
                          icon={<ShieldCheck className="h-4 w-4 text-green-400" />}
                          title="Trusted customer"
                          desc="Shops see a reliable booking history."
                        />
                      </div>
                    </div>

                    {/* How the policy works */}
                    <div className="rounded-xl border border-gray-800 bg-[#1A1A1A] p-5">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
                        <Ban className="h-4 w-4 text-gray-400" />
                        How the no-show policy works
                      </h4>
                      <ul className="space-y-2 text-sm text-gray-400">
                        <li className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-600" />
                          Missing confirmed appointments without cancelling can move your account
                          to a <span className="text-amber-400">caution</span> or{" "}
                          <span className="text-amber-400">deposit-required</span> tier.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-600" />
                          Repeated no-shows can temporarily restrict booking until your standing
                          recovers.
                        </li>
                        <li className="flex items-start gap-2">
                          <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                          If a no-show was marked in error, you can{" "}
                          <span className="text-white">dispute it</span> right here — approved
                          disputes are removed from your record.
                        </li>
                      </ul>
                    </div>

                    <p className="text-xs text-gray-500">
                      Tip: need to cancel? Do it ahead of time from your bookings — cancelled
                      appointments never count as no-shows.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] rounded-2xl max-w-md w-full mx-4 border border-gray-800/50">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h3 className="text-xl font-semibold text-white">
                {idLabel} QR Code
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
                    alt={`${idLabel} QR Code`}
                    className="mx-auto bg-white p-4 rounded-lg"
                  />

                  <div className="text-sm text-gray-300 break-all bg-[#2F2F2F] p-3 rounded-lg font-mono">
                    {walletAddress}
                  </div>

                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() =>
                        copyToClipboard(walletAddress || "", idLabel)
                      }
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Copy {idLabel}
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

      {/* Dispute Modal */}
      {disputeModalEntry && (
        <DisputeModal
          isOpen={true}
          onClose={() => setDisputeModalEntry(null)}
          noShowEntry={disputeModalEntry}
          onDisputeSubmitted={() => {
            // Refresh no-show history after dispute submitted
            if (account?.address) {
              getCustomerNoShowHistory(account.address, 10)
                .then(setNoShowHistory)
                .catch(console.error);
            }
          }}
        />
      )}
    </div>
  );
}

/** Small perk tile used in the "good standing" panel. */
function StandingPerk({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#1A1A1A] p-4">
      <div className="mb-1.5 flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <p className="text-xs leading-relaxed text-gray-400">{desc}</p>
    </div>
  );
}
