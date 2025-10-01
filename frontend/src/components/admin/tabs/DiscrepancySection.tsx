'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { AlertTriangle, Send, RefreshCw, CheckCircle, User } from 'lucide-react';

interface CustomerDiscrepancy {
  address: string;
  name: string;
  totalEarned: number;
  totalRedeemed: number;
  expectedBalance: number;
  offchainMints: number;
  adminTransfers: number;
  status: string;
  needsTokenTransfer: boolean;
  shopsInvolved?: string;
}

interface DiscrepancySummary {
  totalCustomers: number;
  customersNeedingTokens: number;
  totalMissingTokens: number;
}

export const DiscrepancySection: React.FC = () => {
  const { generateAdminToken } = useAdminDashboard();
  const [discrepancies, setDiscrepancies] = useState<CustomerDiscrepancy[]>([]);
  const [summary, setSummary] = useState<DiscrepancySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDiscrepancy | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    loadDiscrepancies();
  }, []);

  const loadDiscrepancies = async () => {
    setLoading(true);
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        toast.error('Failed to authenticate as admin');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/treasury/discrepancies`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setDiscrepancies(result.data.discrepancies);
        setSummary(result.data.summary);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to load discrepancies');
      }
    } catch (error) {
      console.error('Error loading discrepancies:', error);
      toast.error('Failed to load discrepancies');
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedCustomer || !transferAmount || !reason) {
      toast.error('Please fill in all fields');
      return;
    }

    setTransferring(selectedCustomer.address);
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        toast.error('Failed to authenticate as admin');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/treasury/manual-transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerAddress: selectedCustomer.address,
          amount: parseFloat(transferAmount),
          reason: reason
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Successfully transferred ${transferAmount} RCN to ${selectedCustomer.name || selectedCustomer.address}`);
        
        // Close modal and reset
        setShowModal(false);
        setSelectedCustomer(null);
        setTransferAmount('');
        setReason('');
        
        // Reload discrepancies
        await loadDiscrepancies();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Transfer failed');
      }
    } catch (error) {
      console.error('Transfer error:', error);
      toast.error('Failed to process transfer');
    } finally {
      setTransferring(null);
    }
  };

  const openTransferModal = (customer: CustomerDiscrepancy) => {
    setSelectedCustomer(customer);
    const amountNeeded = customer.expectedBalance - customer.adminTransfers;
    setTransferAmount(amountNeeded.toFixed(2));
    setReason(`Fixing missing tokens from shop rewards`);
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!summary || summary.customersNeedingTokens === 0) {
    return (
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Token Discrepancies</h3>
          <button
            onClick={loadDiscrepancies}
            className="flex items-center gap-2 bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
        <div className="flex items-center gap-3 text-green-400">
          <CheckCircle className="w-5 h-5" />
          <p>All customers have received their tokens on-chain</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Token Discrepancies</h3>
          <button
            onClick={loadDiscrepancies}
            className="flex items-center gap-2 bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Summary */}
        <div className="bg-yellow-900/50 border border-yellow-700 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-lg font-bold text-yellow-300 mb-2">Action Required</h4>
              <p className="text-yellow-200 mb-2">
                {summary.customersNeedingTokens} customer{summary.customersNeedingTokens !== 1 ? 's' : ''} may be missing tokens
              </p>
              <p className="text-sm text-yellow-300">
                Total missing: {summary.totalMissingTokens.toFixed(2)} RCN
              </p>
            </div>
          </div>
        </div>

        {/* Customer List */}
        <div className="space-y-3">
          {discrepancies
            .filter(d => d.needsTokenTransfer)
            .map((customer) => (
              <div key={customer.address} className="bg-gray-900 rounded-lg p-6 border border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-gray-400 mt-1" />
                    <div>
                      <p className="font-semibold text-white">{customer.name || 'Unknown Customer'}</p>
                      <p className="text-xs text-gray-400 font-mono">{customer.address}</p>
                      
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                          <p className="text-xs text-gray-500">Earned from Shops</p>
                          <p className="text-sm text-white">{customer.totalEarned.toFixed(2)} RCN</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Total Redeemed</p>
                          <p className="text-sm text-white">{customer.totalRedeemed.toFixed(2)} RCN</p>
                        </div>
                      </div>
                      
                      {customer.adminTransfers > 0 && (
                        <div className="mt-2 p-2 bg-blue-900/30 rounded-lg border border-blue-700">
                          <p className="text-xs text-blue-400">Already sent by admin</p>
                          <p className="text-sm font-semibold text-blue-300">{customer.adminTransfers.toFixed(2)} RCN</p>
                        </div>
                      )}
                      
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">Amount Still Needed</p>
                        <p className="text-lg font-bold text-yellow-400">
                          {(customer.expectedBalance - customer.adminTransfers).toFixed(2)} RCN
                        </p>
                        {customer.shopsInvolved && (
                          <p className="text-xs text-gray-400 mt-1">
                            Shops: {customer.shopsInvolved}
                          </p>
                        )}
                        {customer.offchainMints > 0 && (
                          <p className="text-xs text-orange-400 mt-1">
                            {customer.offchainMints} off-chain transaction{customer.offchainMints !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => openTransferModal(customer)}
                    disabled={transferring === customer.address}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {transferring === customer.address ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Transferring...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Fix Tokens
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Transfer Modal */}
      {showModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-lg w-full mx-4 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-6">Manual Token Transfer</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Customer</label>
                <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                  <p className="font-semibold text-white">{selectedCustomer.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-400 font-mono">{selectedCustomer.address}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Amount (RCN)</label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  step="0.01"
                  min="0.01"
                  max="10000"
                />
                <div className="text-xs text-gray-500 mt-1">
                  <p>Shop rewards: {selectedCustomer.totalEarned.toFixed(2)} RCN</p>
                  {selectedCustomer.adminTransfers > 0 && (
                    <p>Already sent: -{selectedCustomer.adminTransfers.toFixed(2)} RCN</p>
                  )}
                  <p className="font-semibold text-blue-400">Still needed: {(selectedCustomer.expectedBalance - selectedCustomer.adminTransfers).toFixed(2)} RCN</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  rows={3}
                  placeholder="Reason for manual transfer..."
                />
              </div>
              
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
                <p className="text-xs text-yellow-300">
                  This will transfer tokens from the admin wallet directly to the customer's wallet.
                  The transaction will be recorded and visible in the transaction history.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedCustomer(null);
                  setTransferAmount('');
                  setReason('');
                }}
                className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={!transferAmount || !reason || parseFloat(transferAmount) <= 0 || !!transferring}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {transferring ? 'Processing...' : 'Transfer Tokens'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};