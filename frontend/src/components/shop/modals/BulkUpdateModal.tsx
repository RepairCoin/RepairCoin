// frontend/src/components/shop/modals/BulkUpdateModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Loader2, Edit, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { inventoryApi } from '@/services/api/inventory';
import type { InventoryCategory, InventoryVendor, InventoryStatus } from '@/types/inventory';

interface BulkUpdateModalProps {
  selectedCount: number;
  selectedItemIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

const STATUS_OPTIONS: { value: InventoryStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'text-green-400' },
  { value: 'inactive', label: 'Inactive', color: 'text-gray-400' },
  { value: 'discontinued', label: 'Discontinued', color: 'text-red-400' },
];

export const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({
  selectedCount,
  selectedItemIds,
  onClose,
  onSuccess,
}) => {
  const [updateType, setUpdateType] = useState<'status' | 'category' | 'vendor'>('status');
  const [selectedStatus, setSelectedStatus] = useState<InventoryStatus>('active');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoadingData(true);
      const [categoriesData, vendorsData] = await Promise.all([
        inventoryApi.getCategories(),
        inventoryApi.getVendors(),
      ]);
      setCategories(categoriesData);
      setVendors(vendorsData);
      if (categoriesData.length > 0) setSelectedCategory(categoriesData[0].id);
      if (vendorsData.length > 0) setSelectedVendor(vendorsData[0].id);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load categories and vendors');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const updates: Record<string, string> = {};

    if (updateType === 'status') {
      updates.status = selectedStatus;
    } else if (updateType === 'category') {
      if (!selectedCategory) {
        toast.error('Please select a category');
        return;
      }
      updates.categoryId = selectedCategory;
    } else if (updateType === 'vendor') {
      if (!selectedVendor) {
        toast.error('Please select a vendor');
        return;
      }
      updates.vendorId = selectedVendor;
    }

    setLoading(true);

    try {
      const updatedCount = await inventoryApi.bulkUpdateItems(selectedItemIds, updates);
      toast.success(`Successfully updated ${updatedCount} item${updatedCount !== 1 ? 's' : ''}`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating items:', error);
      toast.error(error.response?.data?.error || 'Failed to update items');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] rounded-lg w-full max-w-lg border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Edit className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Bulk Update Items</h2>
              <p className="text-sm text-gray-400">Update {selectedCount} selected items</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {loadingData ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#FFCC00] animate-spin" />
            </div>
          ) : (
            <>
              {/* Update Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  What would you like to update? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setUpdateType('status')}
                    className={`p-3 rounded-lg border transition-all ${
                      updateType === 'status'
                        ? 'border-[#FFCC00] bg-[#FFCC00]/10 text-[#FFCC00]'
                        : 'border-gray-700 bg-[#101010] text-gray-400 hover:border-gray-600'
                    }`}
                    disabled={loading}
                  >
                    Status
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateType('category')}
                    className={`p-3 rounded-lg border transition-all ${
                      updateType === 'category'
                        ? 'border-[#FFCC00] bg-[#FFCC00]/10 text-[#FFCC00]'
                        : 'border-gray-700 bg-[#101010] text-gray-400 hover:border-gray-600'
                    }`}
                    disabled={loading}
                  >
                    Category
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateType('vendor')}
                    className={`p-3 rounded-lg border transition-all ${
                      updateType === 'vendor'
                        ? 'border-[#FFCC00] bg-[#FFCC00]/10 text-[#FFCC00]'
                        : 'border-gray-700 bg-[#101010] text-gray-400 hover:border-gray-600'
                    }`}
                    disabled={loading}
                  >
                    Vendor
                  </button>
                </div>
              </div>

              {/* Status Selection */}
              {updateType === 'status' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    New Status <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {STATUS_OPTIONS.map((status) => (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() => setSelectedStatus(status.value)}
                        className={`p-3 rounded-lg border transition-all ${
                          selectedStatus === status.value
                            ? 'border-[#FFCC00] bg-[#FFCC00]/10'
                            : 'border-gray-700 bg-[#101010] hover:border-gray-600'
                        }`}
                        disabled={loading}
                      >
                        <span className={selectedStatus === status.value ? 'text-[#FFCC00] font-medium' : status.color}>
                          {status.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Selection */}
              {updateType === 'category' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    New Category <span className="text-red-500">*</span>
                  </label>
                  {categories.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No categories available</p>
                  ) : (
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-colors"
                      disabled={loading}
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Vendor Selection */}
              {updateType === 'vendor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    New Vendor <span className="text-red-500">*</span>
                  </label>
                  {vendors.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No vendors available</p>
                  ) : (
                    <select
                      value={selectedVendor}
                      onChange={(e) => setSelectedVendor(e.target.value)}
                      className="w-full px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-colors"
                      disabled={loading}
                    >
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Info Box */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-300">
                    <p className="font-medium mb-1">This will update {selectedCount} items</p>
                    <p className="text-blue-400/80">
                      All selected items will be updated with the new {updateType}. This action can be reverted by
                      editing individual items later.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-700 text-gray-300 rounded-lg hover:border-gray-600 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || loadingData}
              className="px-6 py-2 bg-[#FFCC00] text-black font-medium rounded-lg hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4" />
                  Update Items
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
