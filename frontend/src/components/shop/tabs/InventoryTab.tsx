"use client";

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Package,
  Search,
  Filter,
  Edit,
  Trash2,
  MoreVertical,
  AlertTriangle,
  TrendingDown,
  DollarSign,
  Archive,
  RefreshCw,
  TrendingUp,
  History,
} from 'lucide-react';
import { inventoryApi } from '@/services/api/inventory';
import type {
  InventoryItemWithDetails,
  InventoryCategory,
  InventoryVendor,
  InventoryStats,
  InventoryFilters,
  InventoryStatus,
} from '@/types/inventory';
import { AddInventoryItemModal } from '../modals/AddInventoryItemModal';
import { EditInventoryItemModal } from '../modals/EditInventoryItemModal';
import { CategoryManagementModal } from '../modals/CategoryManagementModal';
import { VendorManagementModal } from '../modals/VendorManagementModal';
import { StockAdjustmentModal } from '../modals/StockAdjustmentModal';
import { AdjustmentHistoryModal } from '../modals/AdjustmentHistoryModal';
import { BulkActionsBar } from './BulkActionsBar';
import { BulkUpdateModal } from '../modals/BulkUpdateModal';

interface InventoryTabProps {
  shopId: string;
}

const ITEMS_PER_PAGE = 20;

export const InventoryTab: React.FC<InventoryTabProps> = ({ shopId }) => {
  // State
  const [items, setItems] = useState<InventoryItemWithDetails[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<InventoryStatus | ''>('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [sortBy, setSortBy] = useState<string>('newest');

  // Bulk selection
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [showAdjustStockModal, setShowAdjustStockModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItemWithDetails | null>(null);

  // Load data
  useEffect(() => {
    loadInventory();
    loadCategories();
    loadVendors();
    loadStats();
  }, [page, searchQuery, selectedCategory, selectedVendor, selectedStatus, showLowStock, showOutOfStock, sortBy]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const filters: InventoryFilters = {
        search: searchQuery || undefined,
        categoryId: selectedCategory || undefined,
        vendorId: selectedVendor || undefined,
        status: selectedStatus || undefined,
        lowStock: showLowStock || undefined,
        outOfStock: showOutOfStock || undefined,
        sortBy: sortBy as any,
      };

      const response = await inventoryApi.getItems(filters, page, ITEMS_PER_PAGE);
      setItems(response.items);
      setTotalPages(response.pagination.totalPages);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const cats = await inventoryApi.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadVendors = async () => {
    try {
      const vendr = await inventoryApi.getVendors();
      setVendors(vendr);
    } catch (error) {
      console.error('Failed to load vendors:', error);
    }
  };

  const loadStats = async () => {
    try {
      const statistics = await inventoryApi.getStats();
      setStats(statistics);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      await inventoryApi.deleteItem(itemId);
      toast.success('Item deleted successfully');
      loadInventory();
      loadStats();
      setShowDeleteModal(false);
      setSelectedItem(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete item');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const itemIds = Array.from(selectedItems);
      const deletedCount = await inventoryApi.bulkDeleteItems(itemIds);
      toast.success(`Successfully deleted ${deletedCount} item${deletedCount !== 1 ? 's' : ''}`);
      loadInventory();
      loadStats();
      setShowBulkDeleteModal(false);
      clearSelection();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete items');
    }
  };

  const getStatusBadge = (item: InventoryItemWithDetails) => {
    if (item.stockQuantity === 0) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400 flex items-center gap-1">
          <Archive className="w-3 h-3" />
          Out of Stock
        </span>
      );
    }
    if (item.stockQuantity <= item.lowStockThreshold) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Low Stock
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">
        In Stock
      </span>
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedVendor('');
    setSelectedStatus('');
    setShowLowStock(false);
    setShowOutOfStock(false);
    setSortBy('newest');
    setPage(1);
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item.id)));
    }
  };

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Inventory Management</h2>
          <p className="text-gray-400 mt-1">
            Manage your inventory items and track stock levels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="px-4 py-2 bg-[#101010] border border-gray-700 text-gray-300 rounded-lg hover:border-[#FFCC00] hover:text-[#FFCC00] transition-colors flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Categories
          </button>
          <button
            onClick={() => setShowVendorModal(true)}
            className="px-4 py-2 bg-[#101010] border border-gray-700 text-gray-300 rounded-lg hover:border-[#FFCC00] hover:text-[#FFCC00] transition-colors flex items-center gap-2"
          >
            <Package className="w-4 h-4" />
            Vendors
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors flex items-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Item
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Items</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.totalItems}</p>
              </div>
              <Package className="w-10 h-10 text-[#FFCC00]" />
            </div>
          </div>

          <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Value</p>
                <p className="text-2xl font-bold text-white mt-1">
                  ${Number(stats.totalValue || 0).toFixed(2)}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.lowStockItems}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-yellow-400" />
            </div>
          </div>

          <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Out of Stock</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{stats.outOfStockItems}</p>
              </div>
              <TrendingDown className="w-10 h-10 text-red-400" />
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#FFCC00]"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Vendor Filter */}
          <select
            value={selectedVendor}
            onChange={(e) => {
              setSelectedVendor(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
          >
            <option value="">All Vendors</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 bg-[#101010] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
            <option value="price_asc">Price (Low to High)</option>
            <option value="price_desc">Price (High to Low)</option>
            <option value="stock_asc">Stock (Low to High)</option>
            <option value="stock_desc">Stock (High to Low)</option>
          </select>
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-3 mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={(e) => {
                setShowLowStock(e.target.checked);
                setPage(1);
              }}
              className="w-4 h-4 rounded border-gray-700 bg-[#101010] text-[#FFCC00] focus:ring-[#FFCC00]"
            />
            <span className="text-sm text-gray-300">Low Stock Only</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOutOfStock}
              onChange={(e) => {
                setShowOutOfStock(e.target.checked);
                setPage(1);
              }}
              className="w-4 h-4 rounded border-gray-700 bg-[#101010] text-[#FFCC00] focus:ring-[#FFCC00]"
            />
            <span className="text-sm text-gray-300">Out of Stock Only</span>
          </label>

          {(searchQuery || selectedCategory || selectedVendor || selectedStatus || showLowStock || showOutOfStock) && (
            <button
              onClick={clearFilters}
              className="ml-auto text-sm text-[#FFCC00] hover:text-[#FFD700] flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00]"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
          <Package className="w-16 h-16 text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            No inventory items found
          </h3>
          <p className="text-gray-400 mb-6">
            {searchQuery || selectedCategory || selectedVendor
              ? 'Try adjusting your filters'
              : 'Start by adding your first inventory item'}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors flex items-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Your First Item
          </button>
        </div>
      ) : (
        <>
          {/* Bulk Actions Bar */}
          <BulkActionsBar
            selectedCount={selectedItems.size}
            onClearSelection={clearSelection}
            onBulkDelete={() => setShowBulkDeleteModal(true)}
            onBulkUpdateStatus={() => setShowBulkUpdateModal(true)}
          />

          {/* Table */}
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#101010] border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedItems.size === items.length && items.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-gray-700 bg-[#101010] text-[#FFCC00] focus:ring-[#FFCC00] cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#101010] transition-colors">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={() => handleSelectItem(item.id)}
                          className="w-4 h-4 rounded border-gray-700 bg-[#101010] text-[#FFCC00] focus:ring-[#FFCC00] cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {item.images && item.images.length > 0 ? (
                            <img
                              src={item.images[0]}
                              alt={item.name}
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <p className="text-white font-medium">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-gray-400 truncate max-w-xs">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-300">
                        {item.sku || '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-300">
                        {item.categoryName || '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-white font-medium">
                        ${item.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <span className={`font-medium ${
                            item.stockQuantity === 0 ? 'text-red-400' :
                            item.stockQuantity <= item.lowStockThreshold ? 'text-yellow-400' :
                            'text-white'
                          }`}>
                            {item.stockQuantity}
                          </span>
                          <span className="text-gray-500 ml-1">
                            / {item.lowStockThreshold} min
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {getStatusBadge(item)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setShowAdjustStockModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-green-400 hover:bg-gray-800 rounded transition-colors"
                            title="Adjust Stock"
                          >
                            <TrendingUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setShowHistoryModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded transition-colors"
                            title="View History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setShowEditModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-[#FFCC00] hover:bg-gray-800 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setShowDeleteModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 bg-[#1A1A1A] border border-gray-800 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-[#1A1A1A] border border-gray-800 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-white mb-4">Delete Item?</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete <span className="text-white font-medium">{selectedItem.name}</span>?
              This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedItem(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(selectedItem.id)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-red-500/50 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white">Delete Multiple Items?</h3>
            </div>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete{' '}
              <span className="text-white font-bold">{selectedItems.size}</span>{' '}
              {selectedItems.size === 1 ? 'item' : 'items'}? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-[#101010] border border-gray-700 text-gray-300 rounded-lg hover:border-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && <AddInventoryItemModal onClose={() => setShowAddModal(false)} onSuccess={loadInventory} />}
      {showEditModal && selectedItem && (
        <EditInventoryItemModal
          item={selectedItem}
          onClose={() => setShowEditModal(false)}
          onSuccess={loadInventory}
        />
      )}
      {showAdjustStockModal && selectedItem && (
        <StockAdjustmentModal
          item={selectedItem}
          onClose={() => setShowAdjustStockModal(false)}
          onSuccess={() => {
            loadInventory();
            loadStats();
          }}
        />
      )}
      {showHistoryModal && selectedItem && (
        <AdjustmentHistoryModal
          item={selectedItem}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
      {showCategoryModal && (
        <CategoryManagementModal
          onClose={() => setShowCategoryModal(false)}
          onUpdate={() => {
            loadCategories();
            loadInventory();
          }}
        />
      )}
      {showVendorModal && (
        <VendorManagementModal
          onClose={() => setShowVendorModal(false)}
          onUpdate={() => {
            loadVendors();
            loadInventory();
          }}
        />
      )}
      {showBulkUpdateModal && (
        <BulkUpdateModal
          selectedCount={selectedItems.size}
          selectedItemIds={Array.from(selectedItems)}
          onClose={() => setShowBulkUpdateModal(false)}
          onSuccess={() => {
            loadInventory();
            loadStats();
            clearSelection();
          }}
        />
      )}
    </div>
  );
};
