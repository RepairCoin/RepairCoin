"use client";

import React from 'react';
import { XCircle, AlertCircle, Mail } from 'lucide-react';

interface SuspendedShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName: string;
  suspensionReason?: string;
  suspendedAt?: string;
  isSuspended: boolean; // true for suspended, false for rejected
}

export const SuspendedShopModal: React.FC<SuspendedShopModalProps> = ({
  isOpen,
  onClose,
  shopName,
  suspensionReason,
  suspendedAt,
  isSuspended,
}) => {
  if (!isOpen) return null;

  const title = isSuspended ? "Shop Suspended" : "Shop Application Rejected";
  const icon = isSuspended ? XCircle : AlertCircle;
  const Icon = icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1C1C1C] rounded-2xl max-w-2xl w-full border border-gray-800 shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-900/20 to-red-800/20 border-b border-red-500/30 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                <Icon className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-red-400">{title}</h2>
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
          {isSuspended ? (
            // Suspended Message
            <>
              <div className="bg-red-900/10 border border-red-500/30 rounded-xl p-4">
                <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
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
          ) : (
            // Rejected Message
            <>
              <div className="bg-red-900/10 border border-red-500/30 rounded-xl p-4">
                <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
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
