"use client";

import { useState } from "react";
import CustomerNoShowBadge from "@/components/customer/CustomerNoShowBadge";
import NoShowWarningBanner from "@/components/customer/NoShowWarningBanner";
import { CustomerNoShowStatus } from "@/services/api/noShow";

export default function TestNoShowPage() {
  const [selectedTier, setSelectedTier] = useState<'normal' | 'warning' | 'caution' | 'deposit_required' | 'suspended'>('warning');

  // Mock data for each tier
  const mockStatuses: Record<string, CustomerNoShowStatus> = {
    normal: {
      customerAddress: '0x1234567890123456789012345678901234567890',
      noShowCount: 0,
      tier: 'normal',
      depositRequired: false,
      successfulAppointmentsSinceTier3: 0,
      canBook: true,
      requiresDeposit: false,
      minimumAdvanceHours: 0,
      restrictions: []
    },
    warning: {
      customerAddress: '0x1234567890123456789012345678901234567890',
      noShowCount: 1,
      tier: 'warning',
      depositRequired: false,
      lastNoShowAt: '2026-02-10T14:30:00Z',
      successfulAppointmentsSinceTier3: 0,
      canBook: true,
      requiresDeposit: false,
      minimumAdvanceHours: 0,
      restrictions: []
    },
    caution: {
      customerAddress: '0x1234567890123456789012345678901234567890',
      noShowCount: 2,
      tier: 'caution',
      depositRequired: false,
      lastNoShowAt: '2026-02-09T10:00:00Z',
      successfulAppointmentsSinceTier3: 0,
      canBook: true,
      requiresDeposit: false,
      minimumAdvanceHours: 24,
      restrictions: [
        'Must book at least 24 hours in advance',
        'Limited to 80% RCN redemption per booking'
      ]
    },
    deposit_required: {
      customerAddress: '0x1234567890123456789012345678901234567890',
      noShowCount: 3,
      tier: 'deposit_required',
      depositRequired: true,
      lastNoShowAt: '2026-02-08T16:45:00Z',
      successfulAppointmentsSinceTier3: 1,
      canBook: true,
      requiresDeposit: true,
      minimumAdvanceHours: 48,
      restrictions: [
        'Refundable $25 deposit required for all bookings',
        'Must book at least 48 hours in advance',
        'Limited to 80% RCN redemption per booking'
      ]
    },
    suspended: {
      customerAddress: '0x1234567890123456789012345678901234567890',
      noShowCount: 5,
      tier: 'suspended',
      depositRequired: true,
      lastNoShowAt: '2026-02-05T12:00:00Z',
      bookingSuspendedUntil: '2026-03-13T12:00:00Z',
      successfulAppointmentsSinceTier3: 0,
      canBook: false,
      requiresDeposit: true,
      minimumAdvanceHours: 48,
      restrictions: [
        'Booking privileges suspended until March 13, 2026',
        'After suspension: $25 deposit required for all bookings',
        'After suspension: Must book at least 48 hours in advance'
      ]
    }
  };

  const currentStatus = mockStatuses[selectedTier];

  return (
    <div className="min-h-screen bg-[#0D0D0D] py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-white">
            No-Show Components Test Page
          </h1>
          <p className="text-gray-400">
            Test the CustomerNoShowBadge and NoShowWarningBanner components with mock data
          </p>
        </div>

        {/* Tier Selector */}
        <div className="bg-[#212121] rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Select Tier to Test</h2>
          <div className="flex flex-wrap gap-3">
            {['normal', 'warning', 'caution', 'deposit_required', 'suspended'].map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedTier === tier
                    ? 'bg-[#FFCC00] text-black'
                    : 'bg-[#2F2F2F] text-white hover:bg-[#3F3F3F]'
                }`}
              >
                {tier.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Current Tier Info */}
        <div className="bg-[#212121] rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Current Tier Details</h2>
          <div className="space-y-2 text-gray-300">
            <p><strong>Tier:</strong> {currentStatus.tier}</p>
            <p><strong>No-Show Count:</strong> {currentStatus.noShowCount}</p>
            <p><strong>Can Book:</strong> {currentStatus.canBook ? 'Yes' : 'No'}</p>
            <p><strong>Deposit Required:</strong> {currentStatus.requiresDeposit ? 'Yes' : 'No'}</p>
            <p><strong>Minimum Advance Hours:</strong> {currentStatus.minimumAdvanceHours}</p>
            {currentStatus.lastNoShowAt && (
              <p><strong>Last No-Show:</strong> {new Date(currentStatus.lastNoShowAt).toLocaleString()}</p>
            )}
            {currentStatus.bookingSuspendedUntil && (
              <p><strong>Suspended Until:</strong> {new Date(currentStatus.bookingSuspendedUntil).toLocaleString()}</p>
            )}
            {currentStatus.tier === 'deposit_required' && (
              <p><strong>Successful Appointments Since Tier 3:</strong> {currentStatus.successfulAppointmentsSinceTier3} / 3</p>
            )}
          </div>
        </div>

        {/* Warning Banner Component */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">NoShowWarningBanner Component</h2>
          <NoShowWarningBanner status={currentStatus} />
          {currentStatus.tier === 'normal' && (
            <p className="text-gray-400 text-center italic">
              (Banner only shows for warning, caution, deposit_required, or suspended tiers)
            </p>
          )}
        </div>

        {/* Badge Component - All Sizes */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">CustomerNoShowBadge Component</h2>

          {/* Small Badge */}
          <div className="bg-[#212121] rounded-xl p-6">
            <h3 className="text-lg font-medium text-white mb-4">Small Badge (size="sm")</h3>
            <CustomerNoShowBadge status={currentStatus} size="sm" showDetails={false} />
            {currentStatus.tier === 'normal' && (
              <p className="text-gray-400 text-sm mt-2 italic">
                (Badge only shows for warning, caution, deposit_required, or suspended tiers)
              </p>
            )}
          </div>

          {/* Medium Badge */}
          <div className="bg-[#212121] rounded-xl p-6">
            <h3 className="text-lg font-medium text-white mb-4">Medium Badge (size="md", default)</h3>
            <CustomerNoShowBadge status={currentStatus} size="md" showDetails={false} />
          </div>

          {/* Large Badge */}
          <div className="bg-[#212121] rounded-xl p-6">
            <h3 className="text-lg font-medium text-white mb-4">Large Badge (size="lg")</h3>
            <CustomerNoShowBadge status={currentStatus} size="lg" showDetails={false} />
          </div>

          {/* Badge with Details */}
          <div className="bg-[#212121] rounded-xl p-6">
            <h3 className="text-lg font-medium text-white mb-4">Badge with Details (showDetails={true})</h3>
            <CustomerNoShowBadge status={currentStatus} size="lg" showDetails={true} />
          </div>
        </div>

        {/* Integration Instructions */}
        <div className="bg-[#212121] rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Where to Find Components in Production</h2>
          <div className="space-y-3 text-gray-300">
            <div>
              <p className="font-medium text-white mb-1">Customer Dashboard:</p>
              <p className="text-sm">Navigate to: <code className="bg-[#2F2F2F] px-2 py-1 rounded">/customer</code></p>
              <p className="text-sm text-gray-400 mt-1">
                The NoShowWarningBanner will appear at the top of the dashboard (currently commented out - waiting for backend endpoint)
              </p>
            </div>
            <div>
              <p className="font-medium text-white mb-1">Customer Settings:</p>
              <p className="text-sm">Navigate to: <code className="bg-[#2F2F2F] px-2 py-1 rounded">/customer?tab=settings</code></p>
              <p className="text-sm text-gray-400 mt-1">
                The CustomerNoShowBadge will appear in the "Account Status" section (currently commented out - waiting for backend endpoint)
              </p>
            </div>
          </div>
        </div>

        {/* Implementation Status */}
        <div className="bg-[#212121] rounded-xl p-6 space-y-4 border border-yellow-500/30">
          <h2 className="text-xl font-semibold text-yellow-400 flex items-center gap-2">
            <span>⚠️</span> Implementation Status
          </h2>
          <div className="space-y-3 text-gray-300">
            <div>
              <p className="font-medium text-white">✅ Completed:</p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                <li>CustomerNoShowBadge component</li>
                <li>NoShowWarningBanner component</li>
                <li>API client methods (noShow.ts)</li>
                <li>Integration structure in CustomerDashboardClient.tsx</li>
                <li>Integration structure in SettingsTab.tsx</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-yellow-400">⏳ Pending:</p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                <li>Backend endpoint: GET /api/customers/:address/overall-no-show-status</li>
                <li>Uncomment integration code in CustomerDashboardClient.tsx</li>
                <li>Uncomment integration code in SettingsTab.tsx</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
