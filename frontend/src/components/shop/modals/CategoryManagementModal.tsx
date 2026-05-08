// frontend/src/components/shop/modals/CategoryManagementModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Loader2, Tag, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { inventoryApi } from '@/services/api/inventory';
import type { InventoryCategory, CreateCategoryData } from '@/types/inventory';

interface CategoryManagementModalProps {
  onClose: () => void;
  onUpdate?: () => void;
}

export const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({ onClose, onUpdate }) => {
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await inventoryApi.getCategories();
      setCategories(data);
    } catch (error) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    setActionLoading(true);
    try {
      const newCategory = await inventoryApi.createCategory({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
      });
      setCategories([...categories, newCategory]);
      setNewCategoryName('');
      setNewCategoryDescription('');
      setShowAddForm(false);
      toast.success('Category created successfully');
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create category');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (categoryId: string) => {
    if (!editName.trim()) {
      toast.error('Category name is required');
      return;
    }

    setActionLoading(true);
    try {
      const updated = await inventoryApi.updateCategory(categoryId, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setCategories(categories.map(c => c.id === categoryId ? updated : c));
      setEditingId(null);
      toast.success('Category updated successfully');
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update category');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Are you sure you want to delete "${categoryName}"? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(true);
    try {
      await inventoryApi.deleteCategory(categoryId);
      setCategories(categories.filter(c => c.id !== categoryId));
      toast.success('Category deleted successfully');
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete category');
    } finally {
      setActionLoading(false);
    }
  };

  const startEdit = (category: InventoryCategory) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditDescription(category.description || '');
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] rounded-lg w-full max-w-2xl border border-gray-800 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FFCC00]/20 flex items-center justify-center">
              <Tag className="w-5 h-5 text-[#FFCC00]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Manage Categories</h2>
              <p className="text-sm text-gray-400">Organize your inventory items</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={actionLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Add New Category Form */}
          {showAddForm && (
            <div className="bg-[#101010] border border-gray-700 rounded-lg p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Category Name</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Phone Parts"
                  className="w-full px-4 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
                  disabled={actionLoading}
                  onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description (optional)</label>
                <input
                  type="text"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder="e.g., Replacement parts for smartphones"
                  className="w-full px-4 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
                  disabled={actionLoading}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAdd}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Category
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewCategoryName('');
                    setNewCategoryDescription('');
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#1A1A1A] border border-gray-700 text-gray-300 rounded-lg hover:border-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Add New Button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full px-4 py-3 bg-[#101010] border-2 border-dashed border-gray-700 rounded-lg text-gray-400 hover:border-[#FFCC00] hover:text-[#FFCC00] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add New Category
            </button>
          )}

          {/* Categories List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#FFCC00] animate-spin" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No categories yet</p>
              <p className="text-sm mt-1">Create your first category to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="bg-[#101010] border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                >
                  {editingId === category.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded text-white focus:outline-none focus:border-[#FFCC00]"
                        disabled={actionLoading}
                      />
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Description (optional)"
                        className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]"
                        disabled={actionLoading}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(category.id)}
                          disabled={actionLoading}
                          className="px-3 py-1 bg-[#FFCC00] text-black rounded hover:bg-[#FFD700] transition-colors text-sm disabled:opacity-50"
                        >
                          {actionLoading ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={actionLoading}
                          className="px-3 py-1 bg-[#1A1A1A] border border-gray-700 text-gray-300 rounded hover:border-gray-600 transition-colors text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-medium">{category.name}</h3>
                        {category.description && (
                          <p className="text-sm text-gray-400 mt-1">{category.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(category)}
                          disabled={actionLoading}
                          className="p-2 text-gray-400 hover:text-[#FFCC00] transition-colors"
                          title="Edit category"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(category.id, category.name)}
                          disabled={actionLoading}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete category"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 p-4">
          <button
            onClick={onClose}
            className="w-full px-6 py-2 bg-[#101010] border border-gray-700 text-gray-300 rounded-lg hover:border-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
