'use client';

import React, { useState } from 'react';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function DebugPendingMints() {
  const { generateAdminToken } = useAdminDashboard();
  const [shopId, setShopId] = useState('zwiftech');
  const [debugData, setDebugData] = useState<any>(null);
  const [allShopsData, setAllShopsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchShopDebug = async () => {
    setLoading(true);
    try {
      const token = await generateAdminToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/debug/pending-mints/${shopId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setDebugData(data);
    } catch (error) {
      console.error('Error fetching debug data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllShops = async () => {
    setLoading(true);
    try {
      const token = await generateAdminToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/debug/all-shops-purchases`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setAllShopsData(data);
    } catch (error) {
      console.error('Error fetching all shops data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/admin" className="inline-flex items-center gap-2 mb-6 text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          Back to Admin Dashboard
        </Link>
        
        <h1 className="text-3xl font-bold mb-8">Debug Pending Mints</h1>
        
        <div className="space-y-8">
          {/* Shop Debug Section */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Check Specific Shop</h2>
            <div className="flex gap-4 mb-4">
              <input
                type="text"
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                placeholder="Enter shop ID"
                className="px-4 py-2 bg-gray-700 rounded-lg flex-1"
              />
              <button
                onClick={fetchShopDebug}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Check Shop'}
              </button>
            </div>
            
            {debugData && (
              <div className="mt-4 bg-gray-900 rounded-lg p-4">
                <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(debugData, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* All Shops Section */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">All Shops with Purchases</h2>
            <button
              onClick={fetchAllShops}
              disabled={loading}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 mb-4"
            >
              {loading ? 'Loading...' : 'Fetch All Shops'}
            </button>
            
            {allShopsData && (
              <div className="mt-4 bg-gray-900 rounded-lg p-4">
                <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(allShopsData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}