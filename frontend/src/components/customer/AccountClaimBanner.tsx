'use client';

import React, { useState, useEffect } from 'react';
import { X, Gift, Loader2, Check, AlertCircle } from 'lucide-react';
import { customerApi, ClaimableAccount } from '@/services/api/customer';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'react-hot-toast';

/**
 * AccountClaimBanner
 *
 * Shows a banner when a customer has placeholder accounts (from manual bookings)
 * that can be claimed/merged with their real account.
 */
export const AccountClaimBanner: React.FC = () => {
  const { userProfile, isCustomer, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [claimableAccounts, setClaimableAccounts] = useState<ClaimableAccount[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [claimedCount, setClaimedCount] = useState(0);

  // Check for claimable accounts on mount
  useEffect(() => {
    const checkAccounts = async () => {
      if (!isAuthenticated || !isCustomer || !userProfile?.address) {
        setLoading(false);
        return;
      }

      // Check if already dismissed this session
      const dismissedKey = `claim_dismissed_${userProfile.address}`;
      if (typeof window !== 'undefined' && sessionStorage.getItem(dismissedKey)) {
        setDismissed(true);
        setLoading(false);
        return;
      }

      try {
        const response = await customerApi.checkClaimableAccounts();
        if (response.success && response.claimable && response.accounts) {
          setClaimableAccounts(response.accounts);
        }
      } catch (error) {
        console.error('Error checking claimable accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAccounts();
  }, [isAuthenticated, isCustomer, userProfile?.address]);

  // Handle dismiss
  const handleDismiss = () => {
    setDismissed(true);
    if (userProfile?.address && typeof window !== 'undefined') {
      sessionStorage.setItem(`claim_dismissed_${userProfile.address}`, 'true');
    }
  };

  // Handle claim all accounts
  const handleClaimAll = async () => {
    setClaiming(true);
    let successCount = 0;

    for (const account of claimableAccounts) {
      try {
        const result = await customerApi.claimAccount(account.placeholderAddress);
        if (result?.success) {
          successCount++;
        }
      } catch (error) {
        console.error('Error claiming account:', account.placeholderAddress, error);
      }
    }

    setClaiming(false);
    setClaimedCount(successCount);

    if (successCount > 0) {
      toast.success(`Successfully claimed ${successCount} account(s) with booking history!`);
      // Clear claimable accounts after successful claim
      setClaimableAccounts([]);
      setShowModal(false);
    } else {
      toast.error('Failed to claim accounts. Please try again.');
    }
  };

  // Calculate total bookings
  const totalBookings = claimableAccounts.reduce((sum, acc) => sum + acc.bookingCount, 0);

  // Don't show if loading, no accounts, or dismissed
  if (loading || claimableAccounts.length === 0 || dismissed) {
    return null;
  }

  return (
    <>
      {/* Banner */}
      <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl p-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Gift className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">
                You have booking history to claim!
              </h3>
              <p className="text-sm text-gray-300">
                We found {totalBookings} booking{totalBookings !== 1 ? 's' : ''} from previous appointments
                linked to your email/phone. Claim them to see your full history.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-3 px-4 py-2 bg-purple-500 text-white text-sm font-semibold rounded-lg hover:bg-purple-600 transition-colors"
              >
                Claim My Bookings
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
            title="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Claim Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div
            className="bg-[#1A1A1A] border border-gray-800 rounded-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="border-b border-gray-800 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <Gift className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Claim Your Booking History</h3>
                  <p className="text-sm text-gray-400">Link previous bookings to your account</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <p className="text-gray-300 mb-4">
                The following accounts were created when shops booked appointments for you.
                Claiming them will transfer all booking history to your current account.
              </p>

              {/* Account List */}
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {claimableAccounts.map((account, index) => (
                  <div
                    key={account.placeholderAddress}
                    className="bg-[#0D0D0D] border border-gray-800 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">Account {index + 1}</span>
                      <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full">
                        {account.bookingCount} booking{account.bookingCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      {account.name && <p>Name: {account.name}</p>}
                      {account.email && <p>Email: {account.email}</p>}
                      {account.phone && <p>Phone: {account.phone}</p>}
                      {account.totalSpent > 0 && (
                        <p>Total spent: ${account.totalSpent.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Info */}
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-400">
                    Your email or phone was matched to verify these accounts belong to you.
                    After claiming, all bookings will appear in your history.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-800 p-4 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={claiming}
                className="flex-1 px-4 py-3 bg-[#0D0D0D] text-white font-semibold rounded-lg border border-gray-700 hover:bg-[#1A1A1A] transition-colors disabled:opacity-50"
              >
                Maybe Later
              </button>
              <button
                onClick={handleClaimAll}
                disabled={claiming}
                className="flex-1 px-4 py-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {claiming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Claim All ({claimableAccounts.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AccountClaimBanner;
