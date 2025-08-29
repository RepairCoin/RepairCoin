'use client';

import React, { useState, useEffect } from 'react';
import { 
  UserPlus,
  Edit,
  Ban,
  CheckCircle,
  Shield,
  Search,
  X
} from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { toast } from 'react-hot-toast';

interface Admin {
  id: string;
  address: string;
  name?: string;
  email?: string;
  role: string;
  status: 'active' | 'suspended';
  createdAt: string;
  lastLogin?: string;
  permissions?: string[];
}

interface AdminsTabProps {
  generateAdminToken: () => Promise<string | null>;
  onError: (error: string) => void;
}

export function AdminsTab({ generateAdminToken, onError }: AdminsTabProps) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Authentication required');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/admins`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // For now, we'll use mock data if the endpoint doesn't exist
        setAdmins(data.admins || getMockAdmins());
      } else if (response.status === 404) {
        // Use mock data if endpoint doesn't exist yet
        setAdmins(getMockAdmins());
      } else {
        throw new Error('Failed to load admins');
      }
    } catch (error) {
      console.error('Error loading admins:', error);
      // Use mock data for demonstration
      setAdmins(getMockAdmins());
    } finally {
      setLoading(false);
    }
  };

  const getMockAdmins = (): Admin[] => {
    const adminAddresses = (process.env.NEXT_PUBLIC_ADMIN_ADDRESSES || '')
      .split(',')
      .map(addr => addr.trim())
      .filter(addr => addr);

    return adminAddresses.map((address, index) => ({
      id: `admin-${index + 1}`,
      address,
      name: index === 0 ? 'Super Admin' : `Admin ${index + 1}`,
      email: `admin${index + 1}@repaircoin.com`,
      role: index === 0 ? 'super_admin' : 'admin',
      status: 'active',
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastLogin: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      permissions: index === 0 
        ? ['all'] 
        : ['manage_shops', 'manage_customers', 'view_analytics']
    }));
  };

  const handleCreateAdmin = async (adminData: Partial<Admin>) => {
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Authentication required');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/create-admin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adminData),
      });

      if (response.ok) {
        toast.success('Admin created successfully');
        setShowCreateModal(false);
        loadAdmins();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create admin');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create admin');
    }
  };

  const handleEditAdmin = async (adminId: string, updates: Partial<Admin>) => {
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Authentication required');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/admins/${adminId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        toast.success('Admin updated successfully');
        setShowEditModal(false);
        setSelectedAdmin(null);
        loadAdmins();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update admin');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update admin');
    }
  };

  const handleSuspendAdmin = async (adminId: string, suspend: boolean) => {
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Authentication required');
        return;
      }

      const endpoint = suspend 
        ? `/admin/admins/${adminId}/suspend`
        : `/admin/admins/${adminId}/unsuspend`;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast.success(`Admin ${suspend ? 'suspended' : 'unsuspended'} successfully`);
        loadAdmins();
      } else {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${suspend ? 'suspend' : 'unsuspend'} admin`);
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to ${suspend ? 'suspend' : 'unsuspend'} admin`);
    }
  };

  const filteredAdmins = admins.filter(admin => 
    admin.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: Column<Admin>[] = [
    {
      key: 'admin',
      header: 'ADMIN',
      accessor: (admin) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-yellow-400/10 rounded-full flex items-center justify-center">
            <Shield className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <p className="font-medium text-white">{admin.name || 'Unnamed Admin'}</p>
            <p className="text-xs text-gray-400 font-mono">
              {admin.address.slice(0, 6)}...{admin.address.slice(-4)}
            </p>
          </div>
        </div>
      ),
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'email',
      header: 'EMAIL',
      accessor: (admin) => (
        <span className="text-sm text-gray-300">{admin.email || '-'}</span>
      ),
      sortable: true,
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'role',
      header: 'ROLE',
      accessor: (admin) => (
        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-900/50 text-purple-400 border border-purple-700/50">
          {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
        </span>
      ),
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'status',
      header: 'STATUS',
      accessor: (admin) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          admin.status === 'active'
            ? 'bg-green-900/50 text-green-400 border border-green-700/50'
            : 'bg-red-900/50 text-red-400 border border-red-700/50'
        }`}>
          {admin.status}
        </span>
      ),
      sortable: true,
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'lastLogin',
      header: 'LAST LOGIN',
      accessor: (admin) => (
        <span className="text-sm text-gray-300">
          {admin.lastLogin 
            ? new Date(admin.lastLogin).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'Never'
          }
        </span>
      ),
      sortable: true,
      headerClassName: 'uppercase text-xs tracking-wider'
    },
    {
      key: 'actions',
      header: 'ACTIONS',
      accessor: (admin) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setSelectedAdmin(admin);
              setShowEditModal(true);
            }}
            className="p-1.5 bg-gray-700/30 text-gray-400 border border-gray-600/30 rounded-lg hover:bg-gray-700/50 hover:text-white transition-colors"
            title="Edit Admin"
          >
            <Edit className="w-4 h-4" />
          </button>
          {admin.role !== 'super_admin' && (
            <button
              onClick={() => handleSuspendAdmin(admin.id, admin.status === 'active')}
              className={`p-1.5 border rounded-lg transition-colors ${
                admin.status === 'active'
                  ? 'bg-red-900/30 text-red-400 border-red-700/30 hover:bg-red-900/50'
                  : 'bg-green-900/30 text-green-400 border-green-700/30 hover:bg-green-900/50'
              }`}
              title={admin.status === 'active' ? 'Suspend Admin' : 'Unsuspend Admin'}
            >
              {admin.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            </button>
          )}
        </div>
      ),
      headerClassName: 'uppercase text-xs tracking-wider'
    }
  ];

  return (
    <>
      <div className="space-y-6 p-6">
        {/* Header Section */}
        <DashboardHeader 
          title="Admin Management"
          subtitle="Manage admin users and their permissions"
          icon={Shield}
        />

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search admins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400/50"
            />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-yellow-400 text-black rounded-lg hover:bg-yellow-300 transition-colors font-medium"
          >
            <UserPlus className="w-5 h-5" />
            <span>Add Admin</span>
          </button>
        </div>

        {/* Admins Table */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50">
          <DataTable
            data={filteredAdmins}
            columns={columns}
            keyExtractor={(admin) => admin.id}
            loading={loading}
            loadingRows={5}
            emptyMessage="No admins found"
            emptyIcon={<Shield className="w-12 h-12 text-gray-500" />}
            headerClassName="bg-gray-900/30"
            className="text-gray-300"
          />
        </div>
      </div>

      {/* Create Admin Modal */}
      {showCreateModal && (
        <CreateAdminModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateAdmin}
        />
      )}

      {/* Edit Admin Modal */}
      {showEditModal && selectedAdmin && (
        <EditAdminModal
          admin={selectedAdmin}
          onClose={() => {
            setShowEditModal(false);
            setSelectedAdmin(null);
          }}
          onSubmit={(updates) => handleEditAdmin(selectedAdmin.id, updates)}
        />
      )}
    </>
  );
}

// Create Admin Modal Component
function CreateAdminModal({ 
  onClose, 
  onSubmit 
}: { 
  onClose: () => void; 
  onSubmit: (data: Partial<Admin>) => void;
}) {
  const [formData, setFormData] = useState({
    address: '',
    name: '',
    email: '',
    role: 'admin',
    permissions: [] as string[]
  });

  const availablePermissions = [
    { id: 'manage_shops', label: 'Manage Shops' },
    { id: 'manage_customers', label: 'Manage Customers' },
    { id: 'manage_treasury', label: 'Manage Treasury' },
    { id: 'view_analytics', label: 'View Analytics' },
    { id: 'manage_admins', label: 'Manage Admins' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Create New Admin</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Wallet Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400"
              placeholder="0x..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400"
              placeholder="Admin Name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-yellow-400"
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Permissions
            </label>
            <div className="space-y-2">
              {availablePermissions.map(perm => (
                <label key={perm.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(perm.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ 
                          ...formData, 
                          permissions: [...formData.permissions, perm.id] 
                        });
                      } else {
                        setFormData({ 
                          ...formData, 
                          permissions: formData.permissions.filter(p => p !== perm.id) 
                        });
                      }
                    }}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-yellow-400 focus:ring-yellow-400"
                  />
                  <span className="text-sm text-gray-300">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-yellow-400 text-black rounded-lg hover:bg-yellow-300 transition-colors font-medium"
            >
              Create Admin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Admin Modal Component
function EditAdminModal({ 
  admin,
  onClose, 
  onSubmit 
}: { 
  admin: Admin;
  onClose: () => void; 
  onSubmit: (data: Partial<Admin>) => void;
}) {
  const [formData, setFormData] = useState({
    name: admin.name || '',
    email: admin.email || '',
    role: admin.role,
    permissions: admin.permissions || []
  });

  const availablePermissions = [
    { id: 'manage_shops', label: 'Manage Shops' },
    { id: 'manage_customers', label: 'Manage Customers' },
    { id: 'manage_treasury', label: 'Manage Treasury' },
    { id: 'view_analytics', label: 'View Analytics' },
    { id: 'manage_admins', label: 'Manage Admins' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Edit Admin</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Wallet Address
            </label>
            <input
              type="text"
              value={admin.address}
              disabled
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400"
              placeholder="Admin Name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-yellow-400"
              disabled={admin.role === 'super_admin'}
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Permissions
            </label>
            <div className="space-y-2">
              {availablePermissions.map(perm => (
                <label key={perm.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(perm.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ 
                          ...formData, 
                          permissions: [...formData.permissions, perm.id] 
                        });
                      } else {
                        setFormData({ 
                          ...formData, 
                          permissions: formData.permissions.filter(p => p !== perm.id) 
                        });
                      }
                    }}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-yellow-400 focus:ring-yellow-400"
                  />
                  <span className="text-sm text-gray-300">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-yellow-400 text-black rounded-lg hover:bg-yellow-300 transition-colors font-medium"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}