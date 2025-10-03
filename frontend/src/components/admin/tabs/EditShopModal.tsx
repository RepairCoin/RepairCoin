'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from 'react-hot-toast';

interface Shop {
  shopId: string;
  shop_id?: string;
  name: string;
  email?: string;
  phone?: string;
  // crossShopEnabled removed - universal redemption is now always enabled
  cross_shop_enabled?: boolean;
  active?: boolean;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
  description?: string;
  verified?: boolean;
}

interface EditShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: Shop | null;
  generateAdminToken: () => Promise<string | null>;
  onRefresh: () => void;
}

export const EditShopModal: React.FC<EditShopModalProps> = ({
  isOpen,
  onClose,
  shop,
  generateAdminToken,
  onRefresh
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    website: '',
    description: '',
    // crossShopEnabled removed - universal redemption is now always enabled
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (shop) {
      setFormData({
        name: shop.name || '',
        email: shop.email || '',
        phone: shop.phone || '',
        address: shop.address || '',
        city: shop.city || '',
        country: shop.country || '',
        website: shop.website || '',
        description: shop.description || '',
        // crossShopEnabled removed - universal redemption is now always enabled
      });
    }
  }, [shop]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;

    setIsLoading(true);
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        toast.error('Failed to authenticate as admin');
        return;
      }

      const shopId = shop.shopId || shop.shop_id;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/shops/${shopId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          country: formData.country,
          website: formData.website,
          description: formData.description,
          // cross_shop_enabled removed - universal redemption is now always enabled
        })
      });

      if (response.ok) {
        toast.success('Shop updated successfully');
        onRefresh();
        onClose();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update shop');
      }
    } catch (error) {
      console.error('Error updating shop:', error);
      toast.error('Network error while updating shop');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  if (!shop) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Edit Shop</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shop Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Website
              </label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country
              </label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Brief description of the shop..."
            />
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-green-700 mb-1">✅ Universal Redemption Active</h4>
            <p className="text-sm text-green-600">
              All RepairCoin customers can redeem 100% of their earned RCN at any participating shop.
            </p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Shop Information</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Shop ID:</span> {shop.shopId || shop.shop_id}</p>
              <p><span className="font-medium">Status:</span> {shop.active ? 'Active' : 'Suspended'}</p>
              <p><span className="font-medium">Verified:</span> {shop.verified ? 'Yes' : 'No'}</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isLoading ? 'Updating...' : 'Update Shop'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};