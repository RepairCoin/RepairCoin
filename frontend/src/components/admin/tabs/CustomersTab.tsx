'use client';

import React, { useState } from 'react';
import { SuspendCustomerModal, UnsuspendCustomerModal } from '@/components/ConfirmationModal';

interface Customer {
  address: string;
  name?: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  lifetimeEarnings: number;
  isActive: boolean;
  lastEarnedDate: string;
}

interface CustomersTabProps {
  customers: Customer[];
  onMintTokens: (address: string, amount: number, reason: string) => void;
  onSuspendCustomer: (address: string) => Promise<void>;
  onUnsuspendCustomer: (address: string) => Promise<void>;
  onRefresh: () => void;
}

export const CustomersTab: React.FC<CustomersTabProps> = ({
  customers,
  onMintTokens,
  onSuspendCustomer,
  onUnsuspendCustomer,
  onRefresh
}) => {
  const [suspendModal, setSuspendModal] = useState<{ isOpen: boolean; customer: Customer | null }>({
    isOpen: false,
    customer: null
  });
  const [unsuspendModal, setUnsuspendModal] = useState<{ isOpen: boolean; customer: Customer | null }>({
    isOpen: false,
    customer: null
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'BRONZE': return 'bg-orange-100 text-orange-800';
      case 'SILVER': return 'bg-gray-100 text-gray-800';
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSuspend = async () => {
    if (!suspendModal.customer) return;
    
    setIsProcessing(true);
    try {
      await onSuspendCustomer(suspendModal.customer.address);
      setSuspendModal({ isOpen: false, customer: null });
      onRefresh();
    } catch (error) {
      console.error('Error suspending customer:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnsuspend = async () => {
    if (!unsuspendModal.customer) return;
    
    setIsProcessing(true);
    try {
      await onUnsuspendCustomer(unsuspendModal.customer.address);
      setUnsuspendModal({ isOpen: false, customer: null });
      onRefresh();
    } catch (error) {
      console.error('Error unsuspending customer:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Customer Management</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lifetime Earnings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.map((customer) => (
                <tr key={customer.address} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {customer.name || 'Anonymous'}
                      </div>
                      <div className="text-sm text-gray-500 font-mono">
                        {customer.address.slice(0, 6)}...{customer.address.slice(-4)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTierColor(customer.tier)}`}>
                      {customer.tier}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {customer.lifetimeEarnings?.toFixed(2) || '0.00'} RCN
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      customer.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {customer.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      onClick={() => onMintTokens(customer.address, 100, 'Admin bonus')}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      Mint 100 RCN
                    </button>
                    {customer.isActive ? (
                      <button 
                        onClick={() => setSuspendModal({ isOpen: true, customer })}
                        className="text-red-600 hover:text-red-900"
                      >
                        Suspend
                      </button>
                    ) : (
                      <button 
                        onClick={() => setUnsuspendModal({ isOpen: true, customer })}
                        className="text-green-600 hover:text-green-900"
                      >
                        Unsuspend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {suspendModal.customer && (
        <SuspendCustomerModal
          isOpen={suspendModal.isOpen}
          onClose={() => setSuspendModal({ isOpen: false, customer: null })}
          onConfirm={handleSuspend}
          customerName={suspendModal.customer.name}
          customerAddress={suspendModal.customer.address}
          isLoading={isProcessing}
        />
      )}

      {unsuspendModal.customer && (
        <UnsuspendCustomerModal
          isOpen={unsuspendModal.isOpen}
          onClose={() => setUnsuspendModal({ isOpen: false, customer: null })}
          onConfirm={handleUnsuspend}
          customerName={unsuspendModal.customer.name}
          customerAddress={unsuspendModal.customer.address}
          isLoading={isProcessing}
        />
      )}
    </>
  );
};