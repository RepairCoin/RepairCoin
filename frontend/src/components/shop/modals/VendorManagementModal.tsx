// frontend/src/components/shop/modals/VendorManagementModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Loader2, Store, Mail, Phone, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { inventoryApi } from '@/services/api/inventory';
import type { InventoryVendor, CreateVendorData, UpdateVendorData } from '@/types/inventory';

interface VendorManagementModalProps {
  onClose: () => void;
  onUpdate?: () => void;
}

export const VendorManagementModal: React.FC<VendorManagementModalProps> = ({ onClose, onUpdate }) => {
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<UpdateVendorData>({});
  const [newVendorData, setNewVendorData] = useState<CreateVendorData>({ name: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const data = await inventoryApi.getVendors();
      setVendors(data);
    } catch (error) {
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newVendorData.name?.trim()) {
      toast.error('Vendor name is required');
      return;
    }

    setActionLoading(true);
    try {
      const newVendor = await inventoryApi.createVendor({
        name: newVendorData.name.trim(),
        contactName: newVendorData.contactName?.trim() || undefined,
        email: newVendorData.email?.trim() || undefined,
        phone: newVendorData.phone?.trim() || undefined,
        address: newVendorData.address?.trim() || undefined,
        notes: newVendorData.notes?.trim() || undefined,
      });
      setVendors([...vendors, newVendor]);
      setNewVendorData({ name: '' });
      setShowAddForm(false);
      toast.success('Vendor created successfully');
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create vendor');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (vendorId: string) => {
    if (!editData.name?.trim()) {
      toast.error('Vendor name is required');
      return;
    }

    setActionLoading(true);
    try {
      const updated = await inventoryApi.updateVendor(vendorId, {
        name: editData.name.trim(),
        contactName: editData.contactName?.trim() || undefined,
        email: editData.email?.trim() || undefined,
        phone: editData.phone?.trim() || undefined,
        address: editData.address?.trim() || undefined,
        notes: editData.notes?.trim() || undefined,
      });
      setVendors(vendors.map(v => v.id === vendorId ? updated : v));
      setEditingId(null);
      toast.success('Vendor updated successfully');
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update vendor');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (vendorId: string, vendorName: string) => {
    if (!confirm(`Are you sure you want to delete "${vendorName}"? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(true);
    try {
      await inventoryApi.deleteVendor(vendorId);
      setVendors(vendors.filter(v => v.id !== vendorId));
      toast.success('Vendor deleted successfully');
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete vendor');
    } finally {
      setActionLoading(false);
    }
  };

  const startEdit = (vendor: InventoryVendor) => {
    setEditingId(vendor.id);
    setEditData({
      name: vendor.name,
      contactName: vendor.contactName || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      notes: vendor.notes || '',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] rounded-lg w-full max-w-3xl border border-gray-800 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FFCC00]/20 flex items-center justify-center">
              <Store className="w-5 h-5 text-[#FFCC00]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Manage Vendors</h2>
              <p className="text-sm text-gray-400">Manage your suppliers and vendors</p>
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
          {/* Add New Vendor Form */}
          {showAddForm && (
            <div className="bg-[#101010] border border-gray-700 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Vendor Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newVendorData.name}
                    onChange={(e) => setNewVendorData({ ...newVendorData, name: e.target.value })}
                    placeholder="e.g., TechParts Inc."
                    className="w-full px-4 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
                    disabled={actionLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Contact Name</label>
                  <input
                    type="text"
                    value={newVendorData.contactName || ''}
                    onChange={(e) => setNewVendorData({ ...newVendorData, contactName: e.target.value })}
                    placeholder="e.g., John Smith"
                    className="w-full px-4 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
                    disabled={actionLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={newVendorData.email || ''}
                    onChange={(e) => setNewVendorData({ ...newVendorData, email: e.target.value })}
                    placeholder="vendor@example.com"
                    className="w-full px-4 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
                    disabled={actionLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={newVendorData.phone || ''}
                    onChange={(e) => setNewVendorData({ ...newVendorData, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-4 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
                    disabled={actionLoading}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Address</label>
                <input
                  type="text"
                  value={newVendorData.address || ''}
                  onChange={(e) => setNewVendorData({ ...newVendorData, address: e.target.value })}
                  placeholder="123 Main St, City, State, ZIP"
                  className="w-full px-4 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
                  disabled={actionLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                <textarea
                  value={newVendorData.notes || ''}
                  onChange={(e) => setNewVendorData({ ...newVendorData, notes: e.target.value })}
                  placeholder="Additional notes about this vendor..."
                  rows={2}
                  className="w-full px-4 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors resize-none"
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
                  Add Vendor
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewVendorData({ name: '' });
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
              Add New Vendor
            </button>
          )}

          {/* Vendors List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#FFCC00] animate-spin" />
            </div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No vendors yet</p>
              <p className="text-sm mt-1">Create your first vendor to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="bg-[#101010] border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                >
                  {editingId === vendor.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editData.name}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          placeholder="Vendor name"
                          className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded text-white focus:outline-none focus:border-[#FFCC00]"
                          disabled={actionLoading}
                        />
                        <input
                          type="text"
                          value={editData.contactName || ''}
                          onChange={(e) => setEditData({ ...editData, contactName: e.target.value })}
                          placeholder="Contact name"
                          className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]"
                          disabled={actionLoading}
                        />
                        <input
                          type="email"
                          value={editData.email || ''}
                          onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                          placeholder="Email"
                          className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]"
                          disabled={actionLoading}
                        />
                        <input
                          type="tel"
                          value={editData.phone || ''}
                          onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                          placeholder="Phone"
                          className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]"
                          disabled={actionLoading}
                        />
                      </div>
                      <input
                        type="text"
                        value={editData.address || ''}
                        onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                        placeholder="Address"
                        className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]"
                        disabled={actionLoading}
                      />
                      <textarea
                        value={editData.notes || ''}
                        onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                        placeholder="Notes"
                        rows={2}
                        className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] resize-none"
                        disabled={actionLoading}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(vendor.id)}
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
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Store className="w-5 h-5 text-[#FFCC00]" />
                          <h3 className="text-white font-medium">{vendor.name}</h3>
                        </div>
                        <div className="space-y-1 text-sm text-gray-400">
                          {vendor.contactName && (
                            <p className="flex items-center gap-2">
                              <span className="text-gray-500">Contact:</span> {vendor.contactName}
                            </p>
                          )}
                          {vendor.email && (
                            <p className="flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              {vendor.email}
                            </p>
                          )}
                          {vendor.phone && (
                            <p className="flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              {vendor.phone}
                            </p>
                          )}
                          {vendor.address && (
                            <p className="flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              {vendor.address}
                            </p>
                          )}
                          {vendor.notes && (
                            <p className="mt-2 text-gray-500 italic">{vendor.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => startEdit(vendor)}
                          disabled={actionLoading}
                          className="p-2 text-gray-400 hover:text-[#FFCC00] transition-colors"
                          title="Edit vendor"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(vendor.id, vendor.name)}
                          disabled={actionLoading}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete vendor"
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
