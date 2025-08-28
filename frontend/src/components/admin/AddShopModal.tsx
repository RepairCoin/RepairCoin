'use client';

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { X } from 'lucide-react';

interface AddShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  generateAdminToken: () => Promise<string | null>;
  onSuccess: () => void;
}

export const AddShopModal: React.FC<AddShopModalProps> = ({
  isOpen,
  onClose,
  generateAdminToken,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    shop_id: '',
    name: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    wallet_address: '',
    address: '',
    city: '',
    country: '',
    website: '',
    description: '',
    companySize: '',
    monthlyRevenue: '',
    role: '',
    referralCode: '',
    verified: false,
    active: true,
    cross_shop_enabled: false
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.shop_id || !formData.name || !formData.email || !formData.phone || !formData.wallet_address || !formData.address) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate wallet address format
    if (!formData.wallet_address.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast.error('Invalid wallet address format');
      return;
    }

    setLoading(true);
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        toast.error('Failed to authenticate as admin');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/create-shop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shop_id: formData.shop_id,
          name: formData.name,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          wallet_address: formData.wallet_address.toLowerCase(),
          address: formData.address,
          city: formData.city,
          country: formData.country,
          website: formData.website,
          description: formData.description,
          companySize: formData.companySize,
          monthlyRevenue: formData.monthlyRevenue,
          role: formData.role,
          referralCode: formData.referralCode,
          verified: formData.verified,
          active: formData.active,
          cross_shop_enabled: formData.cross_shop_enabled
        })
      });

      if (response.ok) {
        toast.success('Shop created successfully!');
        
        // Reset form
        setFormData({
          shop_id: '',
          name: '',
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          wallet_address: '',
          address: '',
          city: '',
          country: '',
          website: '',
          description: '',
          companySize: '',
          monthlyRevenue: '',
          role: '',
          referralCode: '',
          verified: false,
          active: true,
          cross_shop_enabled: false
        });
        
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to create shop');
      }
    } catch (error) {
      console.error('Error creating shop:', error);
      toast.error('Network error while creating shop');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Add New Shop</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Shop Information */}
            <div className="border-b border-gray-700 pb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Shop Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Shop ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="shop_id"
                    value={formData.shop_id}
                    onChange={handleInputChange}
                    placeholder="unique-shop-id"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Shop Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="My Repair Shop"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="border-b border-gray-700 pb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Wallet Information */}
            <div className="border-b border-gray-700 pb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Wallet Information</h3>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Wallet Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="wallet_address"
                  value={formData.wallet_address}
                  onChange={handleInputChange}
                  placeholder="0x..."
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none font-mono"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Location Information */}
            <div className="border-b border-gray-700 pb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Location Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                      disabled={loading}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Business Information */}
            <div className="border-b border-gray-700 pb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Business Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    placeholder="https://example.com"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                    placeholder="Brief description of the shop..."
                    disabled={loading}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Company Size
                    </label>
                    <select
                      name="companySize"
                      value={formData.companySize}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-yellow-400 focus:outline-none"
                      disabled={loading}
                    >
                      <option value="">Select size</option>
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-100">51-100 employees</option>
                      <option value="100+">100+ employees</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Monthly Revenue
                    </label>
                    <select
                      name="monthlyRevenue"
                      value={formData.monthlyRevenue}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-yellow-400 focus:outline-none"
                      disabled={loading}
                    >
                      <option value="">Select revenue</option>
                      <option value="<$10k">Less than $10k</option>
                      <option value="$10k-$50k">$10k - $50k</option>
                      <option value="$50k-$100k">$50k - $100k</option>
                      <option value="$100k+">$100k+</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Role
                    </label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-yellow-400 focus:outline-none"
                      disabled={loading}
                    >
                      <option value="">Select role</option>
                      <option value="Owner">Owner</option>
                      <option value="Manager">Manager</option>
                      <option value="Employee">Employee</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Referral Code
                    </label>
                    <input
                      type="text"
                      name="referralCode"
                      value={formData.referralCode}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Settings</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="verified"
                    checked={formData.verified}
                    onChange={handleInputChange}
                    className="w-5 h-5 bg-gray-800 border-gray-600 rounded text-yellow-400 focus:ring-yellow-400"
                    disabled={loading}
                  />
                  <span className="text-gray-300">Shop is verified</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="active"
                    checked={formData.active}
                    onChange={handleInputChange}
                    className="w-5 h-5 bg-gray-800 border-gray-600 rounded text-yellow-400 focus:ring-yellow-400"
                    disabled={loading}
                  />
                  <span className="text-gray-300">Shop is active</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="cross_shop_enabled"
                    checked={formData.cross_shop_enabled}
                    onChange={handleInputChange}
                    className="w-5 h-5 bg-gray-800 border-gray-600 rounded text-yellow-400 focus:ring-yellow-400"
                    disabled={loading}
                  />
                  <span className="text-gray-300">Enable cross-shop transactions</span>
                </label>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-400 text-black rounded-lg hover:from-yellow-500 hover:to-orange-500 transition-all disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Shop'}
          </button>
        </div>
      </div>
    </div>
  );
};