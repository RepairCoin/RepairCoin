"use client";

import React from "react";
import {
  Copy,
  ExternalLink,
  CheckCircle,
  XCircle,
  Store,
  Mail,
  Phone,
  MapPin,
  Wallet,
  Building,
  User,
  Globe,
  Users,
  Link,
} from "lucide-react";
import toast from "react-hot-toast";

interface Shop {
  shopId: string;
  shop_id?: string;
  name: string;
  active?: boolean;
  verified?: boolean;
  email?: string;
  phone?: string;
  walletAddress?: string;
  wallet_address?: string;
  joinDate?: string;
  join_date?: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  companyName?: string;
  company_name?: string;
  companySize?: string;
  company_size?: string;
  monthlyRevenue?: string;
  monthly_revenue?: string;
  role?: string;
  website?: string;
  referral?: string;
  street?: string;
  city?: string;
  country?: string;
  suspended_at?: string;
  suspension_reason?: string;
}

interface ShopReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: Shop | null;
  onApprove?: (shopId: string) => void;
  onReject?: (shopId: string) => void;
}

export const ShopReviewModal: React.FC<ShopReviewModalProps> = ({
  isOpen,
  onClose,
  shop,
  onApprove,
  onReject,
}) => {
  if (!isOpen || !shop) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? "Invalid Date" : date.toLocaleDateString();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const getWalletAddress = () =>
    shop.walletAddress || shop.wallet_address || "Not provided";
  const getShopId = () => shop.shopId || shop.shop_id || "";
  const getFullName = () => {
    const firstName = shop.firstName || shop.first_name || "";
    const lastName = shop.lastName || shop.last_name || "";
    return `${firstName} ${lastName}`.trim() || "N/A";
  };
  const getAddress = () => {
    const parts = [];
    if (shop.street) parts.push(shop.street);
    if (shop.city) parts.push(shop.city);
    if (shop.country) parts.push(shop.country);
    return parts.length > 0 ? parts.join(", ") : "Address not provided";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full mx-4 border border-gray-700 max-h-[90vh]
  overflow-y-auto"
      >
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-2xl font-bold text-white">
            Shop Application Review
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div
              className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center
   justify-center text-white font-bold text-2xl"
            >
              {shop.name[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-bold text-white">{shop.name}</h4>
              <p className="text-sm text-gray-400 font-mono mb-2">
                {getShopId()}
              </p>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border
   ${
     shop.verified ?? false
       ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
       : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
   }`}
                >
                  {shop.verified ?? false ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <Store className="w-3 h-3" />
                  )}
                  {shop.verified ?? false ? "Verified" : "Pending"}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border
   ${
     shop.active ?? true
       ? "bg-green-500/10 text-green-400 border-green-500/20"
       : "bg-red-500/10 text-red-400 border-red-500/20"
   }`}
                >
                  {shop.active ?? true ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  {shop.active ?? true ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900/50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Application Date</p>
              <p className="text-xl font-bold text-yellow-400">
                {formatDate(shop.joinDate || shop.join_date)}
              </p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Monthly Revenue</p>
              <p className="text-xl font-bold text-blue-400">
                {shop.monthlyRevenue || shop.monthly_revenue || "N/A"}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-gray-300">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 min-w-[100px]">Contact:</span>
              <span>{getFullName()}</span>
              {shop.role && (
                <span className="text-gray-500">({shop.role})</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 min-w-[100px]">Email:</span>
              <span>{shop.email || "N/A"}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 min-w-[100px]">Phone:</span>
              <span>{shop.phone || "N/A"}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <Building className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 min-w-[100px]">Company:</span>
              <span>{shop.companyName || shop.company_name || "N/A"}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 min-w-[100px]">Size:</span>
              <span>{shop.companySize || shop.company_size || "N/A"}</span>
            </div>
            {shop.website && (
              <div className="flex items-center gap-3 text-gray-300">
                <Globe className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400 min-w-[100px]">Website:</span>
                <a
                  href={shop.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400
  hover:text-blue-300 flex items-center gap-1"
                >
                  {shop.website} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            <div className="flex items-center gap-3 text-gray-300">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 min-w-[100px]">Address:</span>
              <span>{getAddress()}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <Wallet className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 min-w-[100px]">Wallet:</span>
              <span className="font-mono text-sm">{getWalletAddress()}</span>
              <button
                onClick={() => copyToClipboard(getWalletAddress())}
                className="text-gray-400
  hover:text-white"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            {shop.referral && (
              <div className="flex items-center gap-3 text-gray-300">
                <Link className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400 min-w-[100px]">Referral:</span>
                <span>{shop.referral}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg
  hover:bg-gray-600 transition-colors font-medium"
            >
              Close
            </button>
            {onReject && (
              <button
                onClick={() => {
                  onReject(getShopId());
                  onClose();
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors
  font-medium flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            )}
            {onApprove && (
              <button
                onClick={() => {
                  onApprove(getShopId());
                  onClose();
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700
  transition-colors font-medium flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
