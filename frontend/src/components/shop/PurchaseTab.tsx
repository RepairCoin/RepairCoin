'use client';

import React from 'react';

interface PurchaseHistory {
  id: string;
  amount: number;
  totalCost?: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

interface PurchaseTabProps {
  purchaseAmount: number;
  setPurchaseAmount: (amount: number) => void;
  paymentMethod: 'usdc' | 'eth';
  setPaymentMethod: (method: 'usdc' | 'eth') => void;
  purchasing: boolean;
  purchases: PurchaseHistory[];
  onInitiatePurchase: () => void;
}

export const PurchaseTab: React.FC<PurchaseTabProps> = ({
  purchaseAmount,
  setPurchaseAmount,
  paymentMethod,
  setPaymentMethod,
  purchasing,
  purchases,
  onInitiatePurchase
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Purchase Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Purchase RCN Tokens</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (minimum 1 RCN)
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                step="1"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-2">
                Total cost: ${(purchaseAmount * 1).toFixed(2)} USD
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Crypto Payment Method
              </label>
              <div className="grid grid-cols-2 gap-4">
                <PaymentMethodButton
                  method="usdc"
                  label="USDC"
                  description="Stablecoin ($1 = 1 USDC)"
                  selected={paymentMethod === 'usdc'}
                  onClick={() => setPaymentMethod('usdc')}
                />
                
                <PaymentMethodButton
                  method="eth"
                  label="ETH"
                  description="Base Sepolia ETH"
                  selected={paymentMethod === 'eth'}
                  onClick={() => setPaymentMethod('eth')}
                />
              </div>
            </div>

            <button
              onClick={onInitiatePurchase}
              disabled={purchasing || purchaseAmount < 1}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 transform hover:scale-105"
            >
              {purchasing ? 'Initiating Purchase...' : `Buy ${purchaseAmount} RCN with ${paymentMethod.toUpperCase()}`}
            </button>

            <InfoCard
              title="💡 Why Purchase RCN?"
              items={[
                'Fund tier bonuses for your customers',
                'Bronze: +10 RCN, Silver: +20 RCN, Gold: +30 RCN',
                'Applied to repairs ≥ $50',
                'Increases customer loyalty and retention'
              ]}
            />

            <InfoCard
              title="🚀 Live Crypto Payments"
              description={
                <>
                  <strong>Base Sepolia Testnet:</strong> Pay with real USDC or ETH on Base testnet.
                  <br />
                  Transactions are processed on-chain via Thirdweb.
                </>
              }
            />
          </div>
        </div>

        {/* Purchase History */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Purchases</h3>
          <div className="space-y-4">
            {purchases.length > 0 ? (
              purchases.slice(0, 5).map((purchase) => (
                <PurchaseCard
                  key={purchase.id}
                  purchase={purchase}
                  getStatusColor={getStatusColor}
                />
              ))
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface PaymentMethodButtonProps {
  method: string;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

const PaymentMethodButton: React.FC<PaymentMethodButtonProps> = ({
  label,
  description,
  selected,
  onClick
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-4 rounded-xl border-2 transition-colors ${
        selected 
          ? 'border-green-500 bg-green-50 text-green-900' 
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="font-medium">{label}</div>
      <div className="text-sm text-gray-500">{description}</div>
    </button>
  );
};

interface InfoCardProps {
  title: string;
  items?: string[];
  description?: React.ReactNode;
}

const InfoCard: React.FC<InfoCardProps> = ({ title, items, description }) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <h4 className="text-sm font-medium text-blue-800 mb-2">{title}</h4>
      {items ? (
        <ul className="text-sm text-blue-700 space-y-1">
          {items.map((item, index) => (
            <li key={index}>• {item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-blue-700">{description}</p>
      )}
    </div>
  );
};

interface PurchaseCardProps {
  purchase: PurchaseHistory;
  getStatusColor: (status: string) => string;
}

const PurchaseCard: React.FC<PurchaseCardProps> = ({ purchase, getStatusColor }) => {
  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-gray-900">{purchase.amount || 0} RCN</p>
          <p className="text-sm text-gray-500">
            ${(purchase.totalCost || 0).toFixed(2)} via {purchase.paymentMethod || 'N/A'}
          </p>
          <p className="text-xs text-gray-400">
            {purchase.createdAt ? new Date(purchase.createdAt).toLocaleDateString() : 'N/A'}
          </p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(purchase.status || 'pending')}`}>
          {purchase.status || 'pending'}
        </span>
      </div>
    </div>
  );
};

const EmptyState: React.FC = () => {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-4">📦</div>
      <p className="text-gray-500">No purchases yet</p>
      <p className="text-sm text-gray-400">Make your first RCN purchase to get started</p>
    </div>
  );
};