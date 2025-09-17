'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

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
  onReject
}) => {
  if (!shop) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const getWalletAddress = () => shop.walletAddress || shop.wallet_address || 'Not provided';
  const getShopId = () => shop.shopId || shop.shop_id || '';
  const getFullName = () => {
    const firstName = shop.firstName || shop.first_name || '';
    const lastName = shop.lastName || shop.last_name || '';
    return `${firstName} ${lastName}`.trim() || 'N/A';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Shop Application Review</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Basic Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-3 text-gray-900">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Shop Name</p>
                <p className="font-medium text-gray-900">{shop.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Shop ID</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 font-mono text-sm">{getShopId()}</p>
                  <button
                    onClick={() => copyToClipboard(getShopId())}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Application Date</p>
                <p className="font-medium text-gray-900">{formatDate(shop.joinDate || shop.join_date)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <div className="flex gap-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    (shop.active ?? true) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {(shop.active ?? true) ? 'Active' : 'Inactive'}
                  </span>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    (shop.verified ?? false) ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {(shop.verified ?? false) ? 'Verified' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-3 text-gray-900">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Contact Person</p>
                <p className="font-medium text-gray-900">{getFullName()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Role</p>
                <p className="font-medium text-gray-900">{shop.role || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{shop.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium text-gray-900">{shop.phone || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Business Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-3 text-gray-900">Business Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Company Name</p>
                <p className="font-medium text-gray-900">{shop.companyName || shop.company_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Company Size</p>
                <p className="font-medium text-gray-900">{shop.companySize || shop.company_size || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Monthly Revenue</p>
                <p className="font-medium text-gray-900">{shop.monthlyRevenue || shop.monthly_revenue || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Website</p>
                {shop.website ? (
                  <a
                    href={shop.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    Visit <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="font-medium text-gray-900">N/A</p>
                )}
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-3 text-gray-900">Location</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium text-gray-900">
                  {shop.street ? `${shop.street}, ` : ''}
                  {shop.city ? `${shop.city}, ` : ''}
                  {shop.country || 'Address not provided'}
                </p>
              </div>
            </div>
          </div>

          {/* Wallet Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-3 text-gray-900">Wallet Information</h3>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 font-mono text-sm">{getWalletAddress()}</p>
              <button
                onClick={() => copyToClipboard(getWalletAddress())}
                className="text-gray-400 hover:text-gray-600"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Referral Information */}
          {shop.referral && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-3 text-gray-900">Referral</h3>
              <p className="font-medium text-gray-900">{shop.referral}</p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 gap-2">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
          {onReject && (
            <Button
              variant="destructive"
              onClick={() => {
                onReject(getShopId());
                onClose();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject Application
            </Button>
          )}
          {onApprove && (
            <Button
              onClick={() => {
                onApprove(getShopId());
                onClose();
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve Application
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};