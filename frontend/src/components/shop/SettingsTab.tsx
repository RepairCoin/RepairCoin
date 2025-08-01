'use client';

import React, { useState } from 'react';

interface ShopData {
  crossShopEnabled: boolean;
  purchasedRcnBalance: number;
}

interface SettingsTabProps {
  shopId: string;
  shopData: ShopData | null;
  onSettingsUpdate: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ shopId, shopData, onSettingsUpdate }) => {
  const [crossShopEnabled, setCrossShopEnabled] = useState(shopData?.crossShopEnabled || false);
  const [autoPurchaseEnabled, setAutoPurchaseEnabled] = useState(false);
  const [autoPurchaseThreshold, setAutoPurchaseThreshold] = useState(50);
  const [autoPurchaseAmount, setAutoPurchaseAmount] = useState(100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const saveCrossShopSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          crossShopEnabled
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update settings');
      }

      setSuccess('Cross-shop settings updated successfully');
      onSettingsUpdate();
    } catch (err) {
      console.error('Settings error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const saveAutoPurchaseSettings = async () => {
    // This would be implemented when auto-purchase backend is ready
    setSuccess('Auto-purchase settings saved (feature coming soon)');
  };

  return (
    <div className="space-y-8">
      {/* Cross-Shop Settings */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Cross-Shop Network Settings</h2>
        
        <div className="space-y-6">
          <div className="flex items-start space-x-4">
            <input
              type="checkbox"
              id="crossShop"
              checked={crossShopEnabled}
              onChange={(e) => setCrossShopEnabled(e.target.checked)}
              className="mt-1 h-5 w-5 text-green-600 rounded focus:ring-green-500"
            />
            <div className="flex-1">
              <label htmlFor="crossShop" className="font-semibold text-gray-900 cursor-pointer">
                Enable Cross-Shop Redemptions
              </label>
              <p className="text-sm text-gray-600 mt-1">
                Allow customers from other shops to redeem up to 20% of their earned RCN at your shop.
                This increases foot traffic and customer base.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">🔄 How Cross-Shop Works</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Customers can use 20% of their balance at participating shops</li>
              <li>• Increases customer acquisition from the network</li>
              <li>• You receive $1 value for each RCN redeemed</li>
              <li>• Home shop customers can still redeem 100% at your shop</li>
            </ul>
          </div>

          <button
            onClick={saveCrossShopSettings}
            disabled={saving || crossShopEnabled === shopData?.crossShopEnabled}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
          >
            {saving ? 'Saving...' : 'Save Cross-Shop Settings'}
          </button>
        </div>
      </div>

      {/* Auto-Purchase Settings */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Auto-Purchase Settings</h2>
        
        <div className="space-y-6">
          <div className="flex items-start space-x-4">
            <input
              type="checkbox"
              id="autoPurchase"
              checked={autoPurchaseEnabled}
              onChange={(e) => setAutoPurchaseEnabled(e.target.checked)}
              className="mt-1 h-5 w-5 text-green-600 rounded focus:ring-green-500"
            />
            <div className="flex-1">
              <label htmlFor="autoPurchase" className="font-semibold text-gray-900 cursor-pointer">
                Enable Auto-Purchase
              </label>
              <p className="text-sm text-gray-600 mt-1">
                Automatically purchase RCN when your balance falls below the threshold.
              </p>
            </div>
          </div>

          {autoPurchaseEnabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Low Balance Threshold (RCN)
                </label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={autoPurchaseThreshold}
                  onChange={(e) => setAutoPurchaseThreshold(parseInt(e.target.value) || 50)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Trigger auto-purchase when balance drops below this amount
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Auto-Purchase Amount (RCN)
                </label>
                <input
                  type="number"
                  min="50"
                  max="1000"
                  step="50"
                  value={autoPurchaseAmount}
                  onChange={(e) => setAutoPurchaseAmount(parseInt(e.target.value) || 100)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Amount to purchase automatically (${autoPurchaseAmount} USD)
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h4 className="text-sm font-medium text-yellow-800 mb-1">⚠️ Payment Method Required</h4>
                <p className="text-sm text-yellow-700">
                  You'll need to set up a default payment method for auto-purchase to work.
                  This feature is coming soon.
                </p>
              </div>
            </>
          )}

          <button
            onClick={saveAutoPurchaseSettings}
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
          >
            {saving ? 'Saving...' : 'Save Auto-Purchase Settings'}
          </button>
        </div>
      </div>

      {/* Shop Information */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Shop Information</h2>
        
        <div className="space-y-4">
          <InfoRow label="Current RCN Balance" value={`${shopData?.purchasedRcnBalance || 0} RCN`} />
          <InfoRow 
            label="Cross-Shop Status" 
            value={shopData?.crossShopEnabled ? 'Enabled' : 'Disabled'}
            status={shopData?.crossShopEnabled ? 'success' : 'neutral'}
          />
          <InfoRow 
            label="Auto-Purchase" 
            value={autoPurchaseEnabled ? `Enabled (Threshold: ${autoPurchaseThreshold} RCN)` : 'Disabled'}
            status={autoPurchaseEnabled ? 'success' : 'neutral'}
          />
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex">
            <div className="text-red-400 text-xl mr-3">⚠️</div>
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-1 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex">
            <div className="text-green-400 text-xl mr-3">✅</div>
            <div>
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <div className="mt-1 text-sm text-green-700">{success}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface InfoRowProps {
  label: string;
  value: string;
  status?: 'success' | 'neutral';
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, status }) => {
  const statusColors = {
    success: 'bg-green-100 text-green-800',
    neutral: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
      <span className="text-gray-600">{label}</span>
      {status ? (
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[status]}`}>
          {value}
        </span>
      ) : (
        <span className="font-medium text-gray-900">{value}</span>
      )}
    </div>
  );
};