import { useState } from 'react';
import { useActiveAccount } from "thirdweb/react";

interface CreateAdminTabProps {
  generateAdminToken: () => Promise<string | null>;
  onError: (error: string) => void;
  onSuccess: () => void;
}

export function CreateAdminTab({ generateAdminToken, onError, onSuccess }: CreateAdminTabProps) {
  const account = useActiveAccount();
  const [formData, setFormData] = useState({
    walletAddress: '',
    name: '',
    email: '',
    permissions: ['manage_customers', 'manage_shops', 'view_analytics']
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);

    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Failed to authenticate as admin');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/create-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create admin');
      }

      const result = await response.json();
      setSuccess('Admin created successfully!');
      setFormData({
        walletAddress: '',
        name: '',
        email: '',
        permissions: ['manage_customers', 'manage_shops', 'view_analytics']
      });
      
      setTimeout(() => {
        onSuccess();
        setSuccess(null);
      }, 2000);

    } catch (err) {
      console.error('Error creating admin:', err);
      onError(err instanceof Error ? err.message : 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePermissionChange = (permission: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, permission]
        : prev.permissions.filter(p => p !== permission)
    }));
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">Create New Admin</h2>
        <p className="text-gray-600 mt-1">Grant admin privileges to a wallet address</p>
      </div>
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wallet Address *
              </label>
              <input
                type="text"
                name="walletAddress"
                value={formData.walletAddress}
                onChange={handleInputChange}
                required
                placeholder="0x..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="John Doe"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="admin@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Permissions
            </label>
            <div className="space-y-3">
              {[
                { id: 'manage_customers', label: 'Manage Customers', desc: 'Create, edit, and suspend customer accounts' },
                { id: 'manage_shops', label: 'Manage Shops', desc: 'Approve, configure, and manage repair shops' },
                { id: 'manage_admins', label: 'Manage Admins', desc: 'Create and manage other admin accounts' },
                { id: 'view_analytics', label: 'View Analytics', desc: 'Access platform statistics and reports' },
                { id: 'mint_tokens', label: 'Mint Tokens', desc: 'Issue RepairCoin tokens to customers' }
              ].map((permission) => (
                <div key={permission.id} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={permission.id}
                    checked={formData.permissions.includes(permission.id)}
                    onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                    className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <div>
                    <label htmlFor={permission.id} className="text-sm font-medium text-gray-900">
                      {permission.label}
                    </label>
                    <p className="text-xs text-gray-500">{permission.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="text-sm text-green-700">{success}</div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
            >
              {loading ? 'Creating Admin...' : 'Create Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}