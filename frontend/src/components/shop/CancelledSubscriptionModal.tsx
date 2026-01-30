"use client";

import React from 'react';
import { AlertTriangle, Calendar, CreditCard, Mail } from 'lucide-react';

interface CancelledSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName: string;
  endsAt: string;
  onManageSubscription: () => void;
}

export const CancelledSubscriptionModal: React.FC<CancelledSubscriptionModalProps> = ({
  isOpen,
  onClose,
  shopName,
  endsAt,
  onManageSubscription,
}) => {
  if (!isOpen) return null;

  const endDate = new Date(endsAt);
  const now = new Date();
  // Use Math.floor to get complete days remaining (not rounding up partial days)
  const daysRemaining = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1C1C1C] rounded-2xl max-w-xl w-full border border-gray-800 shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-900/20 to-orange-800/20 border-b border-orange-500/30 px-5 py-3 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-orange-400">Subscription Cancellation Scheduled</h2>
                <p className="text-xs text-gray-400">{shopName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="bg-orange-900/10 border border-orange-500/30 rounded-lg p-3">
            <h3 className="font-semibold text-orange-400 text-sm mb-1 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Your subscription has been cancelled
            </h3>
            <p className="text-gray-300 text-xs">
              Your shop subscription has been cancelled, but you can continue using all shop features until the end of your current billing period.
            </p>
          </div>

          {/* End Date Information */}
          <div className="bg-[#2F2F2F] rounded-lg p-3 border border-gray-700">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-white text-sm mb-1">Subscription End Date</h4>
                <p className="text-gray-300 text-xs mb-2">
                  Your subscription will end on{' '}
                  <span className="font-semibold text-orange-400">
                    {endDate.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </span>
                </p>
                <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-md px-2 py-1">
                  <span className="text-orange-400 font-semibold text-xs">
                    {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* What This Means */}
          <div className="bg-[#2F2F2F] rounded-lg p-3 border border-gray-700">
            <h4 className="font-semibold text-white text-sm mb-2">What This Means:</h4>
            <ul className="space-y-1.5 text-xs text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                <span>Full access to all shop features until {endDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                <span>You can still issue rewards and process redemptions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                <span>Your customer data and history are preserved</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400 mt-0.5 flex-shrink-0">⚠</span>
                <span>After {endDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}, you'll need to resubscribe to continue operations</span>
              </li>
            </ul>
          </div>

          {/* Reactivation Info */}
          <div className="bg-blue-900/10 border border-blue-500/30 rounded-lg p-3">
            <h4 className="font-semibold text-blue-400 text-sm mb-1.5 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Want to Continue?
            </h4>
            <p className="text-xs text-gray-300 mb-2.5">
              You can reactivate your subscription at any time before the end date to continue seamless operations. Your shop settings and data will be preserved.
            </p>
            <button
              onClick={() => {
                onClose();
                onManageSubscription();
              }}
              className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Manage Subscription
            </button>
          </div>

          {/* Contact Support */}
          <div className="bg-[#2F2F2F] rounded-lg p-3 border border-gray-700">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#FFCC00]" />
              <div>
                <h4 className="font-semibold text-white text-sm">Need Help?</h4>
                <p className="text-xs text-gray-400">
                  Contact support at{' '}
                  <a
                    href="mailto:support@repaircoin.com"
                    className="text-[#FFCC00] hover:underline"
                  >
                    support@repaircoin.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
