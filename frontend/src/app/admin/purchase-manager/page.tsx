'use client';

import React, { useState, useEffect } from 'react';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { toast } from 'react-hot-toast';
import { ArrowLeft, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function PurchaseManager() {
  const { generateAdminToken } = useAdminDashboard();
  const [shopId, setShopId] = useState('zwiftech');
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const token = await generateAdminToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/debug/purchase-status/${shopId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setPurchases(data.data || []);
      } else {
        toast.error('Failed to fetch purchases');
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
      toast.error('Failed to load purchase data');
    } finally {
      setLoading(false);
    }
  };

  const completePurchase = async (purchaseId: string) => {
    if (!confirm('Are you sure you want to manually complete this purchase?')) {
      return;
    }

    setCompleting(purchaseId);
    try {
      const token = await generateAdminToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/shops/${shopId}/complete-purchase/${purchaseId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            paymentReference: `MANUAL_ADMIN_${new Date().toISOString()}`
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        toast.success(`Purchase completed! ${result.data.amount} RCN now ready for minting.`);
        await fetchPurchases(); // Reload the list
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to complete purchase');
      }
    } catch (error) {
      console.error('Error completing purchase:', error);
      toast.error('Failed to complete purchase');
    } finally {
      setCompleting(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'pending': return 'text-yellow-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/admin" className="inline-flex items-center gap-2 mb-6 text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          Back to Admin Dashboard
        </Link>
        
        <h1 className="text-3xl font-bold mb-8">Purchase Manager</h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Check Shop Purchases</h2>
          <div className="flex gap-4">
            <input
              type="text"
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              placeholder="Enter shop ID"
              className="px-4 py-2 bg-gray-700 rounded-lg flex-1"
            />
            <button
              onClick={fetchPurchases}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load Purchases'}
            </button>
          </div>
        </div>

        {purchases.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Purchase History</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4">ID</th>
                    <th className="text-left py-3 px-4">Amount</th>
                    <th className="text-left py-3 px-4">Cost</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Created</th>
                    <th className="text-left py-3 px-4">Payment Ref</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr key={purchase.id} className="border-b border-gray-700">
                      <td className="py-3 px-4 font-mono text-sm">{purchase.id}</td>
                      <td className="py-3 px-4">{purchase.amount} RCN</td>
                      <td className="py-3 px-4">${purchase.total_cost}</td>
                      <td className={`py-3 px-4 ${getStatusColor(purchase.status)}`}>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(purchase.status)}
                          {purchase.status}
                          {purchase.minted_at && (
                            <span className="text-xs bg-blue-600 px-2 py-1 rounded">Minted</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">{formatDate(purchase.created_at)}</td>
                      <td className="py-3 px-4 text-sm font-mono">
                        {purchase.payment_reference || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {purchase.status === 'pending' && (
                          <button
                            onClick={() => completePurchase(purchase.id)}
                            disabled={completing === purchase.id}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-50"
                          >
                            {completing === purchase.id ? 'Completing...' : 'Complete'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 text-sm text-gray-400">
              <p>Total: {purchases.length} purchases</p>
              <p>Pending: {purchases.filter(p => p.status === 'pending').length}</p>
              <p>Completed: {purchases.filter(p => p.status === 'completed').length}</p>
              <p>Minted: {purchases.filter(p => p.minted_at).length}</p>
            </div>
          </div>
        )}

        {purchases.length > 0 && purchases.some(p => p.status === 'pending') && (
          <div className="mt-6 bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-400 font-semibold">Pending Purchases Found</p>
                <p className="text-sm text-gray-300 mt-1">
                  These purchases are awaiting payment confirmation. If Stripe shows the payment as successful, 
                  you can manually complete them using the "Complete" button.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}