"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Mail,
  Clock,
  Edit3,
  Trash2,
  Copy,
  AlertCircle,
  UserPlus,
  Search,
  User
} from "lucide-react";
import apiClient from "@/utils/apiClient";
import { showToast } from "@/utils/toast";
import { DataTable } from "@/components/ui/DataTable";
import { DashboardHeader } from "@/components/ui/DashboardHeader";

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
  {
    value: "manage_customers",
    label: "Manage Customers",
    icon: "👥",
    color: "blue",
  },
  { value: "manage_shops", label: "Manage Shops", icon: "🏪", color: "green" },
  {
    value: "manage_treasury",
    label: "Manage Treasury",
    icon: "💰",
    color: "yellow",
  },
  {
    value: "view_analytics",
    label: "View Analytics",
    icon: "📊",
    color: "purple",
  },
  { value: "create_admin", label: "Create Admins", icon: "➕", color: "pink" },
  { value: "manage_admins", label: "Manage Admins", icon: "⚙️", color: "gray" },
];

export default function AdminsTab() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState<AdminFormData>({
    walletAddress: "",
    name: "",
    email: "",
    permissions: [],
  });

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/admin/admins", { role: "admin" });
      setAdmins(response.data || []);
    } catch (error: any) {
      console.error("Error fetching admins:", error);
      showToast.error(error.response?.data?.error || "Failed to fetch admins");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    try {
      await apiClient.post("/admin/create-admin", formData, { role: "admin" });
      showToast.success("Admin created successfully");
      setShowCreateModal(false);
      setFormData({ walletAddress: "", name: "", email: "", permissions: [] });
      fetchAdmins();
    } catch (error: any) {
      showToast.error(error.response?.data?.error || "Failed to create admin");
    }
  };

  const handleUpdateAdmin = async () => {
    if (!selectedAdmin) return;

    try {
      await apiClient.put(`/admin/admins/${selectedAdmin.id}`, formData, {
        role: "admin",
      });
      showToast.success("Admin updated successfully");
      setShowEditModal(false);
      setSelectedAdmin(null);
      setFormData({ walletAddress: "", name: "", email: "", permissions: [] });
      fetchAdmins();
    } catch (error: any) {
      showToast.error(error.response?.data?.error || "Failed to update admin");
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;

    try {
      await apiClient.delete(`/admin/admins/${selectedAdmin.id}`, {
        role: "admin",
      });
      showToast.success("Admin deleted successfully");
      setShowDeleteModal(false);
      setSelectedAdmin(null);
      fetchAdmins();
    } catch (error: any) {
      showToast.error(error.response?.data?.error || "Failed to delete admin");
    }
  };


  const openEditModal = (admin: Admin) => {
    setSelectedAdmin(admin);
    setFormData({
      walletAddress: admin.walletAddress,
      name: admin.name,
      email: admin.email || "",
      permissions: admin.permissions,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (admin: Admin) => {
    setSelectedAdmin(admin);
    setShowDeleteModal(true);
  };

  const copyWalletAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    showToast.success("Wallet address copied!");
  };

  // Filter admins based on search term
  const filteredAdmins = admins.filter((admin) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      admin.name.toLowerCase().includes(search) ||
      admin.email?.toLowerCase().includes(search) ||
      admin.walletAddress.toLowerCase().includes(search) ||
      admin.id.toString().includes(search)
    );
  });

  // Define columns for DataTable
  const columns = [
    {
      key: "admin",
      header: "Admin",
      sortable: true,
      accessor: (admin: Admin) => (
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
              admin.isSuperAdmin
                ? "bg-gradient-to-br from-purple-500 to-pink-500"
                : "bg-gradient-to-br from-blue-500 to-cyan-500"
            }`}
          >
            {admin.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-200">{admin.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <code className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-400 font-mono">
                {admin.walletAddress.slice(0, 6)}...
                {admin.walletAddress.slice(-4)}
              </code>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyWalletAddress(admin.walletAddress);
                }}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                title="Copy wallet address"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            {admin.isSuperAdmin && (
              <span className="inline-flex items-center gap-1 mt-1 text-xs bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded-full">
                <Shield className="w-3 h-3" />
                Super Admin
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "email",
      header: "Contact",
      sortable: true,
      accessor: (admin: Admin) => (
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-500" />
          <span className="text-gray-300 text-sm">
            {admin.email || (
              <span className="text-gray-500 italic">No email</span>
            )}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (admin: Admin) => (
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              admin.isActive ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              admin.isActive
                ? "bg-green-900/30 text-green-400"
                : "bg-red-900/30 text-red-400"
            }`}
          >
            {admin.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      ),
    },
    {
      key: "permissions",
      header: "Permissions",
      accessor: (admin: Admin) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {admin.isSuperAdmin ? (
            <span className="text-xs bg-purple-900/30 text-purple-400 px-2.5 py-1 rounded-full">
              All Permissions
            </span>
          ) : admin.permissions.length > 0 ? (
            <>
              {admin.permissions.slice(0, 2).map((perm, index) => {
                const permission = AVAILABLE_PERMISSIONS.find(
                  (p) => p.value === perm
                );
                return (
                  <span
                    key={index}
                    className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded"
                  >
                    {permission?.icon} {permission?.label || perm}
                  </span>
                );
              })}
              {admin.permissions.length > 2 && (
                <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded">
                  +{admin.permissions.length - 2} more
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-gray-500 italic">No permissions</span>
          )}
        </div>
      ),
    },
    {
      key: "lastLogin",
      header: "Last Active",
      sortable: true,
      accessor: (admin: Admin) => (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock className="w-4 h-4" />
          {admin.lastLogin ? (
            new Date(admin.lastLogin).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          ) : (
            <span className="italic">Never</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      headerClassName: "text-right",
      className: "text-right",
      accessor: (admin: Admin) => (
        <div className="relative">
          {!admin.isSuperAdmin ? (
            <div className="flex justify-end items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(admin);
                }}
                className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded transition-colors"
                title="Edit"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openDeleteModal(admin);
                }}
                className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-gray-500 italic px-2">Protected</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="">
      {/* Header with gradient background */}
      <DashboardHeader
        title="Admin Management"
        subtitle="Manage all admin applications and active admin"
        icon={User}
      />

      {/* Data Table */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50">
        {/* Controls */}
        <div className="p-6 border-b border-gray-700/50">
          {/* Search, Filter and Export */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, ID, email, or wallet address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400"
              />
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00] transition-all shadow-lg rounded-3xl"
            >
              <UserPlus className="w-4 h-4" />
              Create Admin
            </button>
          </div>
        </div>
        <DataTable
          data={filteredAdmins}
          columns={columns}
          keyExtractor={(admin) => admin.id.toString()}
          loading={loading}
          loadingRows={5}
          emptyMessage="No admins found"
          emptyIcon={<AlertCircle className="w-12 h-12 text-gray-400" />}
          className=""
          headerClassName="bg-gray-900/60 border-gray-800"
          rowClassName="border-gray-800 hover:bg-gray-800/30"
        />
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg transform transition-all">
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white">
                {showCreateModal ? "Create New Admin" : "Edit Admin"}
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                {showCreateModal
                  ? "Add a new administrator to the platform"
                  : "Update administrator information"}
              </p>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Wallet Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.walletAddress}
                  onChange={(e) =>
                    setFormData({ ...formData, walletAddress: e.target.value })
                  }
                  disabled={showEditModal}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="0x..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Admin Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Permissions <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-700 rounded-lg p-3 bg-gray-800">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <label
                      key={perm.value}
                      className="flex items-center p-2 hover:bg-gray-700 rounded cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              permissions: [
                                ...formData.permissions,
                                perm.value,
                              ],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              permissions: formData.permissions.filter(
                                (p) => p !== perm.value
                              ),
                            });
                          }
                        }}
                        className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                      />
                      <span className="ml-3 flex items-center gap-2">
                        <span>{perm.icon}</span>
                        <span className="text-gray-200">{perm.label}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 flex gap-3">
              <button
                onClick={
                  showCreateModal ? handleCreateAdmin : handleUpdateAdmin
                }
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2.5 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-medium"
              >
                {showCreateModal ? "Create Admin" : "Update Admin"}
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedAdmin(null);
                  setFormData({
                    walletAddress: "",
                    name: "",
                    email: "",
                    permissions: [],
                  });
                }}
                className="flex-1 bg-gray-800 text-gray-300 py-2.5 rounded-lg hover:bg-gray-700 transition-all font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-md transform transition-all">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-900/30 rounded-full">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Delete Admin</h3>
                  <p className="text-gray-400 text-sm">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <p className="text-gray-300 mb-6">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-white">
                  {selectedAdmin.name}
                </span>
                ? They will lose all access to the admin panel.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAdmin}
                  className="flex-1 bg-red-600 text-white py-2.5 rounded-lg hover:bg-red-700 transition-all font-medium"
                >
                  Delete Admin
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedAdmin(null);
                  }}
                  className="flex-1 bg-gray-800 text-gray-300 py-2.5 rounded-lg hover:bg-gray-700 transition-all font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
