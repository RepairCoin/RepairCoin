'use client';

import React, { useState, useEffect } from 'react';
import apiClient from '@/utils/apiClient';
import { showToast } from '@/utils/toast';
import { DataTable } from '@/components/ui/DataTable';

interface Admin {
  id: number;
  walletAddress: string;
  name: string;
  email: string | null;
  permissions: string[];
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  lastLogin: string | null;
}

interface AdminFormData {
  walletAddress: string;
  name: string;
  email: string;
  permissions: string[];
}

const AVAILABLE_PERMISSIONS = [
  { value: 'manage_customers', label: 'Manage Customers' },
  { value: 'manage_shops', label: 'Manage Shops' },
  { value: 'manage_treasury', label: 'Manage Treasury' },
  { value: 'view_analytics', label: 'View Analytics' },
  { value: 'create_admin', label: 'Create Admins' },
  { value: 'manage_admins', label: 'Manage Admins' },
];

export default function AdminsTab() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [formData, setFormData] = useState<AdminFormData>({
    walletAddress: '',
    name: '',
    email: '',
    permissions: []
  });

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/admins', { role: 'admin' });
      setAdmins(response.data || []);
    } catch (error: any) {
      console.error('Error fetching admins:', error);
      showToast.error(error.response?.data?.error || 'Failed to fetch admins');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    try {
      await apiClient.post('/admin/create-admin', formData, { role: 'admin' });
      showToast.success('Admin created successfully');
      setShowCreateModal(false);
      setFormData({ walletAddress: '', name: '', email: '', permissions: [] });
      fetchAdmins();
    } catch (error: any) {
      showToast.error(error.response?.data?.error || 'Failed to create admin');
    }
  };

  const handleUpdateAdmin = async () => {
    if (!selectedAdmin) return;
    
    try {
      await apiClient.put(`/admin/admins/${selectedAdmin.id}`, formData, { role: 'admin' });
      showToast.success('Admin updated successfully');
      setShowEditModal(false);
      setSelectedAdmin(null);
      setFormData({ walletAddress: '', name: '', email: '', permissions: [] });
      fetchAdmins();
    } catch (error: any) {
      showToast.error(error.response?.data?.error || 'Failed to update admin');
    }
  };

  const handleDeleteAdmin = async (adminId: number) => {
    if (!confirm('Are you sure you want to delete this admin?')) return;
    
    try {
      await apiClient.delete(`/admin/admins/${adminId}`, { role: 'admin' });
      showToast.success('Admin deleted successfully');
      fetchAdmins();
    } catch (error: any) {
      showToast.error(error.response?.data?.error || 'Failed to delete admin');
    }
  };

  const handleDeactivateAdmin = async (adminId: number) => {
    try {
      await apiClient.post(`/admin/admins/${adminId}/deactivate`, undefined, { role: 'admin' });
      showToast.success('Admin deactivated successfully');
      fetchAdmins();
    } catch (error: any) {
      showToast.error(error.response?.data?.error || 'Failed to deactivate admin');
    }
  };

  const handleReactivateAdmin = async (adminId: number) => {
    try {
      await apiClient.post(`/admin/admins/${adminId}/reactivate`, undefined, { role: 'admin' });
      showToast.success('Admin reactivated successfully');
      fetchAdmins();
    } catch (error: any) {
      showToast.error(error.response?.data?.error || 'Failed to reactivate admin');
    }
  };

  const openEditModal = (admin: Admin) => {
    setSelectedAdmin(admin);
    setFormData({
      walletAddress: admin.walletAddress,
      name: admin.name,
      email: admin.email || '',
      permissions: admin.permissions
    });
    setShowEditModal(true);
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      accessor: (admin: Admin) => (
        <div>
          <div className="font-medium">{admin.name}</div>
          {admin.isSuperAdmin && (
            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
              Super Admin
            </span>
          )}
        </div>
      )
    },
    {
      key: 'walletAddress',
      header: 'Wallet Address',
      accessor: (admin: Admin) => (
        <div className="font-mono text-sm">
          {admin.walletAddress.slice(0, 6)}...{admin.walletAddress.slice(-4)}
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email',
      accessor: (admin: Admin) => admin.email || '-'
    },
    {
      key: 'isActive',
      header: 'Status',
      accessor: (admin: Admin) => (
        <span className={`px-2 py-1 rounded text-xs ${
          admin.isActive 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {admin.isActive ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      key: 'permissions',
      header: 'Permissions',
      accessor: (admin: Admin) => (
        <div className="flex flex-wrap gap-1">
          {admin.isSuperAdmin ? (
            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
              All Permissions
            </span>
          ) : admin.permissions.length > 0 ? (
            admin.permissions.slice(0, 2).map((perm, index) => (
              <span key={index} className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                {perm}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-500">No permissions</span>
          )}
          {!admin.isSuperAdmin && admin.permissions.length > 2 && (
            <span className="text-xs text-gray-500">+{admin.permissions.length - 2} more</span>
          )}
        </div>
      )
    },
    {
      key: 'lastLogin',
      header: 'Last Login',
      accessor: (admin: Admin) => admin.lastLogin 
        ? new Date(admin.lastLogin).toLocaleDateString()
        : 'Never'
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (admin: Admin) => (
        <div className="flex gap-2">
          {!admin.isSuperAdmin && (
            <>
              <button
                onClick={() => openEditModal(admin)}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Edit
              </button>
              {admin.isActive ? (
                <button
                  onClick={() => handleDeactivateAdmin(admin.id)}
                  className="text-yellow-600 hover:text-yellow-800 text-sm"
                >
                  Deactivate
                </button>
              ) : (
                <button
                  onClick={() => handleReactivateAdmin(admin.id)}
                  className="text-green-600 hover:text-green-800 text-sm"
                >
                  Reactivate
                </button>
              )}
              <button
                onClick={() => handleDeleteAdmin(admin.id)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Admin Management</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Create New Admin
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading admins...</div>
      ) : (
        <DataTable
          columns={columns}
          data={admins}
          keyExtractor={(admin) => admin.id.toString()}
          emptyMessage="No admins found"
        />
      )}

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Create New Admin</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Wallet Address *
                </label>
                <input
                  type="text"
                  value={formData.walletAddress}
                  onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="0x..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Admin Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Permissions *
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <label key={perm.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              permissions: [...formData.permissions, perm.value]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              permissions: formData.permissions.filter(p => p !== perm.value)
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleCreateAdmin}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                Create Admin
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ walletAddress: '', name: '', email: '', permissions: [] });
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {showEditModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Edit Admin</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Wallet Address
                </label>
                <input
                  type="text"
                  value={formData.walletAddress}
                  disabled
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Admin Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Permissions *
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <label key={perm.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              permissions: [...formData.permissions, perm.value]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              permissions: formData.permissions.filter(p => p !== perm.value)
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleUpdateAdmin}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                Update Admin
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedAdmin(null);
                  setFormData({ walletAddress: '', name: '', email: '', permissions: [] });
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}