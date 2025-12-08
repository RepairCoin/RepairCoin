"use client";

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { useAuthStore } from "@/stores/authStore";
import apiClient from '@/services/api/client';

interface CustomerData {
  address: string;
  name?: string;
  email?: string;
  phone?: string;
  tier: string;
  lifetimeEarnings: number;
  isActive: boolean;
  referralCode?: string;
  joinDate: string;
}

export default function CustomerSettingsPage() {
  const { userProfile, isLoading: authLoading, isCustomer, userType } = useAuthStore();
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) {
      return;
    }
    
    // Check if userProfile is authenticated
    if (!userProfile || !userProfile.address) {
      router.push('/');
      return;
    }

    // Check if userProfile is a customer
    if (!isCustomer) {
      router.push('/');
      return;
    }

    // Fetch customer data
    fetchCustomerData();
  }, [userProfile, authLoading, isCustomer, router]);

  const fetchCustomerData = async () => {
    if (!userProfile?.address) return;

    try {
      // apiClient uses cookies automatically and returns unwrapped data
      const data = await apiClient.get(`/customers/${userProfile.address}`);
      const customerData = data.data?.customer || data.data;

      if (!customerData) {
        throw new Error('No customer data found');
      }

      setCustomer(customerData);
      setName(customerData.name || '');
      setEmail(customerData.email || '');
      setPhone(customerData.phone || '');
    } catch (error: any) {
      console.error('Error fetching customer data:', error);
      toast.error(error.message || 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: 'name' | 'email' | 'phone', value: string) => {
    switch (field) {
      case 'name':
        setName(value);
        break;
      case 'email':
        setEmail(value);
        break;
      case 'phone':
        setPhone(value);
        break;
    }
    
    // Check if any field has changed from original
    const changed = 
      value !== (customer?.[field] || '') ||
      name !== (customer?.name || '') ||
      email !== (customer?.email || '') ||
      phone !== (customer?.phone || '');
    
    setHasChanges(changed);
  };

  const handleSave = async () => {
    if (!userProfile?.address || !hasChanges) return;

    setSaving(true);
    try {
      // apiClient uses cookies automatically and returns unwrapped data
      const data = await apiClient.put(`/customers/${userProfile.address}`, {
        name,
        email,
        phone,
      });

      if (data.data?.customer) {
        setCustomer(data.data.customer);
      }

      toast.success('Profile updated successfully!');
      setHasChanges(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const exportData = async (format: 'json' | 'csv') => {
    if (!userProfile?.address) return;

    setExportLoading(true);
    try {
      // For file downloads, we need to use axios with responseType: 'blob'
      const response = await apiClient.get(
        `/customers/${userProfile.address}/export`,
        {
          params: { format },
          responseType: 'blob',
        }
      );

      // Get filename from Content-Disposition header or use default
      const filename = `repaircoin-data-${userProfile.address}.${format}`;

      // Response is the blob data (apiClient unwraps it)
      const blob = response as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Data exported as ${format.toUpperCase()}`);
    } catch (error: any) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Failed to load profile data</p>
          <Link href="/customer" className="text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Link href="/customer" className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
            </div>
            <div className="text-sm text-gray-500">
              Connected: {userProfile?.address?.slice(0, 6)}...{userProfile?.address?.slice(-4)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Non-editable Information */}
          <div className="mb-8 pb-8 border-b">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500">Wallet Address</label>
                <p className="mt-1 text-sm text-gray-900 font-mono">{customer.address}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Referral Code</label>
                <p className="mt-1 text-sm text-gray-900 font-semibold">{customer.referralCode || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Tier Status</label>
                <p className="mt-1">
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    customer.tier?.toUpperCase() === 'GOLD' ? 'bg-yellow-100 text-yellow-800' :
                    customer.tier?.toUpperCase() === 'SILVER' ? 'bg-gray-100 text-gray-800' :
                    'bg-orange-100 text-orange-800'
                  }`}>
                    {customer.tier?.toUpperCase() || 'BRONZE'}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Lifetime Earnings</label>
                <p className="mt-1 text-sm text-gray-900 font-bold">{customer.lifetimeEarnings} RCN</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Member Since</label>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(customer.joinDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Account Status</label>
                <p className="mt-1">
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    customer.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {customer.isActive ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Editable Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between">
                <Link
                  href="/customer"
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={!hasChanges || saving}
                  className={`px-6 py-2 text-sm font-medium text-white rounded-md ${
                    hasChanges && !saving
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Additional Settings */}
        <div className="mt-8 bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Privacy & Security</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h3>
                <p className="text-sm text-gray-500">Secure your account with 2FA</p>
              </div>
              <span className="text-sm text-gray-400">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Email Notifications</h3>
                <p className="text-sm text-gray-500">Receive updates about your rewards</p>
              </div>
              <span className="text-sm text-gray-400">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Export Data</h3>
                <p className="text-sm text-gray-500">Download your transaction history and profile data</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => exportData('json')}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  disabled={exportLoading}
                >
                  {exportLoading ? 'Loading...' : 'JSON'}
                </button>
                <button
                  onClick={() => exportData('csv')}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  disabled={exportLoading}
                >
                  {exportLoading ? 'Loading...' : 'CSV'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}