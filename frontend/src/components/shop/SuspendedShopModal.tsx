"use client";

import React from 'react';
import { XCircle, AlertCircle, Mail, CreditCard } from 'lucide-react';

interface SuspendedShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName: string;
  suspensionReason?: string;
  suspendedAt?: string;
  modalType: 'suspended' | 'rejected' | 'unsubscribed'; // Type of modal to show
}

export const SuspendedShopModal: React.FC<SuspendedShopModalProps> = ({
  isOpen,
  onClose,
  shopName,
  suspensionReason,
  suspendedAt,
  modalType,
}) => {
  if (!isOpen) return null;

  const getModalConfig = () => {
    switch (modalType) {
      case 'suspended':
        return {
          title: "Shop Suspended",
          icon: XCircle,
          color: "red",
        };
      case 'rejected':
        return {
          title: "Shop Application Rejected",
          icon: AlertCircle,
          color: "red",
        };
      case 'unsubscribed':
        return {
          title: "Subscription Required",
          icon: CreditCard,
          color: "yellow",
        };
    }
  };

  const config = getModalConfig();
  const Icon = config.icon;

  const colorClasses = {
    red: {
      gradient: "from-red-900/20 to-red-800/20",
      border: "border-red-500/30",
      bg: "bg-red-500/10",
      text: "text-red-400",
      contentBg: "bg-red-900/10",
    },
    yellow: {
      gradient: "from-yellow-900/20 to-yellow-800/20",
      border: "border-yellow-500/30",
      bg: "bg-yellow-500/10",
      text: "text-yellow-400",
      contentBg: "bg-yellow-900/10",
    },
  };

  const colors = colorClasses[config.color];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1C1C1C] rounded-2xl max-w-2xl w-full border border-gray-800 shadow-2xl">
        {/* Header */}
        <div className={`bg-gradient-to-r ${colors.gradient} border-b ${colors.border} px-6 py-4 rounded-t-2xl`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 ${colors.bg} rounded-full flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${colors.text}`} />
              </div>
              <div>
                <h2 className={`text-2xl font-bold ${colors.text}`}>{config.title}</h2>
                <p className="text-sm text-gray-400">{shopName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {modalType === 'suspended' && (
            <>
              <div className={`${colors.contentBg} border ${colors.border} rounded-xl p-4`}>
                <h3 className={`font-semibold ${colors.text} mb-2 flex items-center gap-2`}>
                  <AlertCircle className="w-5 h-5" />
                  Your shop has been suspended
                </h3>
                <p className="text-gray-300 text-sm">
                  Your shop access has been temporarily suspended. You cannot operate on the platform until this is resolved.
                </p>
              </div>

              {suspensionReason && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-white">Suspension Reason:</h4>
                  <div className="bg-[#2F2F2F] rounded-xl p-4 border border-gray-700">
                    <p className="text-gray-300">{suspensionReason}</p>
                  </div>
                </div>
              )}

              {suspendedAt && (
                <div className="text-sm text-gray-400">
                  <p>Suspended on: {new Date(suspendedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</p>
                </div>
              )}

              <div className="bg-blue-900/10 border border-blue-500/30 rounded-xl p-4">
                <h4 className="font-semibold text-blue-400 mb-2">Next Steps:</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Review the suspension reason above</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Contact our support team to appeal or resolve the issue</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Submit an unsuspend request if you believe this was an error</span>
                  </li>
                </ul>
              </div>
            </>
          )}

          {modalType === 'rejected' && (
            <>
              <div className={`${colors.contentBg} border ${colors.border} rounded-xl p-4`}>
                <h3 className={`font-semibold ${colors.text} mb-2 flex items-center gap-2`}>
                  <AlertCircle className="w-5 h-5" />
                  Your shop application was not approved
                </h3>
                <p className="text-gray-300 text-sm">
                  Your application to become a RepairCoin partner shop has been reviewed and was not approved at this time.
                </p>
              </div>

              {suspensionReason && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-white">Reason:</h4>
                  <div className="bg-[#2F2F2F] rounded-xl p-4 border border-gray-700">
                    <p className="text-gray-300">{suspensionReason}</p>
                  </div>
                </div>
              )}

              <div className="bg-blue-900/10 border border-blue-500/30 rounded-xl p-4">
                <h4 className="font-semibold text-blue-400 mb-2">What you can do:</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Review the reason for rejection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Contact support for more details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Reapply once you've addressed the issues</span>
                  </li>
                </ul>
              </div>
            </>
          )}

          {modalType === 'unsubscribed' && (
            <>
              <div className={`${colors.contentBg} border ${colors.border} rounded-xl p-4`}>
                <h3 className={`font-semibold ${colors.text} mb-2 flex items-center gap-2`}>
                  <CreditCard className="w-5 h-5" />
                  Active subscription required
                </h3>
                <p className="text-gray-300 text-sm">
                  Your shop subscription is currently inactive. An active monthly subscription ($500/month) is required to use RepairCoin shop features.
                </p>
              </div>

              <div className="bg-blue-900/10 border border-blue-500/30 rounded-xl p-4">
                <h4 className="font-semibold text-blue-400 mb-2">What you need to do:</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Go to Settings → Subscription tab</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Click "Subscribe Now" to activate your monthly subscription</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Once subscribed, you'll have full access to all shop features</span>
                  </li>
                </ul>
              </div>

              <div className="bg-[#2F2F2F] rounded-xl p-4 border border-gray-700">
                <h4 className="font-semibold text-white mb-2">Subscription Benefits:</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-[#FFCC00] mt-1">✓</span>
                    <span>Issue RCN rewards to customers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FFCC00] mt-1">✓</span>
                    <span>Purchase RCN credits at tiered pricing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FFCC00] mt-1">✓</span>
                    <span>Process customer redemptions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FFCC00] mt-1">✓</span>
                    <span>Access analytics and customer insights</span>
                  </li>
                </ul>
              </div>
            </>
          )}

          {/* Contact Support */}
          <div className="bg-[#2F2F2F] rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-[#FFCC00]" />
              <div>
                <h4 className="font-semibold text-white">Need Help?</h4>
                <p className="text-sm text-gray-400">
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
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
          {modalType === 'unsubscribed' && (
            <button
              onClick={() => {
                onClose();
                // Navigate to settings tab
                window.location.href = '/shop?tab=settings';
              }}
              className="px-6 py-2 bg-[#FFCC00] hover:bg-[#FFCC00]/90 text-black font-semibold rounded-xl transition-colors"
            >
              Go to Subscription
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
