'use client';

import React from 'react';
import { CustomerNoShowStatus } from '@/services/api/noShow';

interface NoShowWarningBannerProps {
  status: CustomerNoShowStatus | null;
  onDismiss?: () => void;
}

export default function NoShowWarningBanner({ status, onDismiss }: NoShowWarningBannerProps) {
  if (!status || status.tier === 'normal') {
    return null;
  }

  const getBannerConfig = () => {
    switch (status.tier) {
      case 'warning':
        return {
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          iconBgColor: 'bg-yellow-100',
          icon: '⚠️',
          title: 'Missed Appointment Notice',
          message: `You have ${status.noShowCount} missed appointment. Please arrive on time for future bookings to avoid restrictions.`,
          showDetails: false
        };

      case 'caution':
        return {
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-300',
          textColor: 'text-orange-900',
          iconBgColor: 'bg-orange-100',
          icon: '⚠️',
          title: 'Account Restrictions Applied',
          message: `You have ${status.noShowCount} missed appointments. Additional restrictions now apply:`,
          showDetails: true
        };

      case 'deposit_required':
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-300',
          textColor: 'text-red-900',
          iconBgColor: 'bg-red-100',
          icon: '🚨',
          title: 'Refundable Deposit Required',
          message: `Due to ${status.noShowCount} missed appointments, you must now pay a refundable deposit for all bookings:`,
          showDetails: true
        };

      case 'suspended':
        const suspensionEndDate = status.bookingSuspendedUntil
          ? new Date(status.bookingSuspendedUntil).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
          : 'unknown date';

        return {
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-400',
          textColor: 'text-gray-900',
          iconBgColor: 'bg-gray-200',
          icon: '🛑',
          title: 'Account Temporarily Suspended',
          message: `Your booking privileges have been suspended until ${suspensionEndDate} due to ${status.noShowCount} missed appointments.`,
          showDetails: true
        };

      default:
        return null;
    }
  };

  const config = getBannerConfig();
  if (!config) return null;

  return (
    <div className={`${config.bgColor} border ${config.borderColor} rounded-lg p-4 mb-6 shadow-sm`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`${config.iconBgColor} rounded-full p-2 flex-shrink-0`}>
          <span className="text-2xl">{config.icon}</span>
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className={`font-semibold text-lg ${config.textColor} mb-1`}>
            {config.title}
          </h3>

          <p className={`${config.textColor} mb-3`}>
            {config.message}
          </p>

          {/* Restrictions List */}
          {config.showDetails && status.restrictions.length > 0 && (
            <ul className={`${config.textColor} space-y-2 mb-3`}>
              {status.restrictions.map((restriction, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-sm mt-0.5">•</span>
                  <span className="text-sm">{restriction}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Help Text */}
          {status.tier === 'deposit_required' && (
            <div className="bg-white/50 rounded p-3 mt-3">
              <p className="text-sm text-gray-700">
                <strong>Good News:</strong> Complete 3 successful appointments and these restrictions will be removed automatically.
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Progress: {status.successfulAppointmentsSinceTier3} / 3 successful appointments
              </p>
            </div>
          )}

          {status.tier === 'suspended' && (
            <div className="bg-white/50 rounded p-3 mt-3">
              <p className="text-sm text-gray-700">
                <strong>What's Next:</strong> After the suspension period, you'll be able to book again with a refundable deposit. Build trust by honoring future appointments.
              </p>
            </div>
          )}

          {/* Tips for All Tiers */}
          {status.tier !== 'suspended' && (
            <div className="mt-3 pt-3 border-t border-current/20">
              <p className="text-xs text-gray-600 font-medium mb-1">Tips to avoid further restrictions:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Cancel at least 4 hours in advance if you can't make it</li>
                <li>• Set reminders on your phone for appointments</li>
                <li>• Contact the shop directly if you're running late</li>
              </ul>
            </div>
          )}
        </div>

        {/* Dismiss Button (Optional) */}
        {onDismiss && status.tier === 'warning' && (
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
