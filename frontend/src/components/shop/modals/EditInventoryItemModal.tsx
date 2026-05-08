// frontend/src/components/shop/modals/EditInventoryItemModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Upload, Plus, Loader2, Package, Tag, DollarSign, Hash, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { inventoryApi } from '@/services/api/inventory';
import type {
  InventoryItemWithDetails,
  InventoryCategory,
  InventoryVendor,
  UpdateInventoryItemData
} from '@/types/inventory';

interface EditInventoryItemModalProps {
  item: InventoryItemWithDetails;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditInventoryItemModal: React.FC<EditInventoryItemModalProps> = ({ item, onClose, onSuccess }) => {
  // Form state - initialize with existing item data
  const [formData, setFormData] = useState<UpdateInventoryItemData>({
    name: item.name,
    description: item.description || '',
    sku: item.sku || '',
    barcode: item.barcode || '',
    price: item.price,
    cost: item.cost || 0,
    lowStockThreshold: item.lowStockThreshold,
    categoryId: item.categoryId || '',
    vendorId: item.vendorId || '',
    status: item.status,
    images: item.images || [],
    metadata: item.metadata || {},
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [imagePreview, setImagePreview] = useState<string>(item.images?.[0] || '');
  const [showQuickAddCategory, setShowQuickAddCategory] = useState(false);
  const [showQuickAddVendor, setShowQuickAddVendor] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newVendorName, setNewVendorName] = useState('');

  // Load categories and vendors
  useEffect(() => {
    const loadData = async () => {
      try {
        const [categoriesData, vendorsData] = await Promise.all([
          inventoryApi.getCategories(),
          inventoryApi.getVendors(),
        ]);
        setCategories(categoriesData);
        setVendors(vendorsData);
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load categories and vendors');
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, []);

  const handleInputChange = (field: keyof UpdateInventoryItemData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size should be less than 10MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to DigitalOcean Spaces
    try {
      const loadingToast = toast.loading('Uploading image...');
      const result = await inventoryApi.uploadImage(file);
      toast.dismiss(loadingToast);
      toast.success('Image uploaded successfully');
      handleInputChange('images', [result.url]);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error(error.response?.data?.error || 'Failed to upload image');
      // Reset preview on error
      setImagePreview('');
    }
  };

  const handleQuickAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    try {
      const newCategory = await inventoryApi.createCategory({ name: newCategoryName.trim() });
      setCategories((prev) => [...prev, newCategory]);
      handleInputChange('categoryId', newCategory.id);
      setNewCategoryName('');
      setShowQuickAddCategory(false);
      toast.success('Category created successfully');
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Failed to create category');
    }
  };

  const handleQuickAddVendor = async () => {
    if (!newVendorName.trim()) {
      toast.error('Please enter a vendor name');
      return;
    }

    try {
      const newVendor = await inventoryApi.createVendor({ name: newVendorName.trim() });
      setVendors((prev) => [...prev, newVendor]);
      handleInputChange('vendorId', newVendor.id);
      setNewVendorName('');
      setShowQuickAddVendor(false);
      toast.success('Vendor created successfully');
    } catch (error) {
      console.error('Error creating vendor:', error);
      toast.error('Failed to create vendor');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (formData.name && !formData.name.trim()) {
      toast.error('Item name cannot be empty');
      return;
    }

    if (formData.price !== undefined && formData.price <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }

    setLoading(true);

    try {
      await inventoryApi.updateItem(item.id, formData);
      toast.success('Inventory item updated successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating item:', error);
      toast.error(error.response?.data?.error || 'Failed to update inventory item');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-[#1A1A1A] rounded-lg p-8 flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-[#FFCC00] animate-spin" />
          <span className="text-white">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#1A1A1A] rounded-lg w-full max-w-3xl border border-gray-800 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FFCC00]/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-[#FFCC00]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Edit Inventory Item</h2>
              <p className="text-sm text-gray-400">Update item information</p>
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
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Item Image</label>
            <div className="flex items-center gap-4">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-24 h-24 rounded-lg object-cover border border-gray-700"
                />
              ) : (
                <div className="w-24 h-24 rounded-lg bg-[#101010] border-2 border-dashed border-gray-700 flex items-center justify-center">
                  <Package className="w-8 h-8 text-gray-600" />
                </div>
              )}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={loading}
                />
                <div className="px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-gray-300 hover:border-[#FFCC00] hover:text-[#FFCC00] transition-colors flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">Change Image</span>
                </div>
              </label>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Item Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., iPhone 13 Pro Screen"
                  className="w-full pl-10 pr-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* SKU */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">SKU</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => handleInputChange('sku', e.target.value)}
                  placeholder="e.g., IP13P-SCR-001"
                  className="w-full pl-10 pr-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Barcode */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Barcode</label>
              <div className="relative">
                <BarChart3 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => handleInputChange('barcode', e.target.value)}
                  placeholder="e.g., 123456789012"
                  className="w-full pl-10 pr-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter item description..."
              rows={3}
              className="w-full px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors resize-none"
              disabled={loading}
            />
          </div>

          {/* Category and Vendor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
              {showQuickAddCategory ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category name"
                    className="flex-1 px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickAddCategory())}
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddCategory}
                    className="px-3 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddCategory(false)}
                    className="px-3 py-2 bg-[#101010] border border-gray-700 text-gray-300 rounded-lg hover:border-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={formData.categoryId}
                    onChange={(e) => handleInputChange('categoryId', e.target.value)}
                    className="flex-1 px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-colors"
                    disabled={loading}
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddCategory(true)}
                    className="px-3 py-2 bg-[#101010] border border-gray-700 text-[#FFCC00] rounded-lg hover:border-[#FFCC00] transition-colors"
                    title="Add new category"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Vendor */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Vendor</label>
              {showQuickAddVendor ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    placeholder="Vendor name"
                    className="flex-1 px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickAddVendor())}
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddVendor}
                    className="px-3 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddVendor(false)}
                    className="px-3 py-2 bg-[#101010] border border-gray-700 text-gray-300 rounded-lg hover:border-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={formData.vendorId}
                    onChange={(e) => handleInputChange('vendorId', e.target.value)}
                    className="flex-1 px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-colors"
                    disabled={loading}
                  >
                    <option value="">Select vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddVendor(true)}
                    className="px-3 py-2 bg-[#101010] border border-gray-700 text-[#FFCC00] rounded-lg hover:border-[#FFCC00] transition-colors"
                    title="Add new vendor"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Price <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Cost */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Cost (optional)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost}
                  onChange={(e) => handleInputChange('cost', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Stock Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Low Stock Threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Low Stock Threshold</label>
              <input
                type="number"
                min="0"
                value={formData.lowStockThreshold}
                onChange={(e) => handleInputChange('lowStockThreshold', parseInt(e.target.value) || 0)}
                placeholder="10"
                className="w-full px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
                disabled={loading}
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-colors"
                disabled={loading}
              >
                <option value="available">Available</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-[#101010] border border-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">
              <span className="font-medium text-gray-300">Note:</span> Stock quantity cannot be changed here.
              Use the stock adjustment feature to add or remove inventory.
            </p>
          </div>

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
              disabled={loading}
              className="px-6 py-2 bg-[#FFCC00] text-black font-medium rounded-lg hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Item'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
