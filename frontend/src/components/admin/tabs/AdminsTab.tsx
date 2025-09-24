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
  User,
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
  role?: string;
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
  role: 'admin' | 'moderator';
}

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
    role: "admin",
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
      await apiClient.post("/admin/admins/create", formData, { role: "admin" });
      showToast.success(`${formData.role === 'admin' ? 'Admin' : 'Moderator'} created successfully`);
      setShowCreateModal(false);
      setFormData({ walletAddress: "", name: "", email: "", role: "admin" });
      fetchAdmins();
    } catch (error: any) {
      showToast.error(error.response?.data?.error || "Failed to create admin");
    }
  };

  const handleUpdateAdmin = async () => {
    if (!selectedAdmin) return;

    try {
      await apiClient.put(`/admin/admins/${selectedAdmin.walletAddress}`, formData, {
        role: "admin",
      });
      showToast.success("Admin updated successfully");
      setShowEditModal(false);
      setSelectedAdmin(null);
      setFormData({ walletAddress: "", name: "", email: "", role: "admin" });
      fetchAdmins();
    } catch (error: any) {
      showToast.error(error.response?.data?.error || "Failed to update admin");
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;

    try {
      await apiClient.delete(`/admin/admins/${selectedAdmin.walletAddress}`, {
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
      role: admin.role as 'admin' | 'moderator' || (admin.isSuperAdmin ? 'admin' : 'moderator'),
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
          <div>
            <p className="font-medium text-gray-200">{admin.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: "walletAddress",
      header: "Wallet Address",
      sortable: true,
      accessor: (admin: Admin) => (
        <div className="flex items-center gap-2">
          <span className="text-gray-300 text-sm">
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
      key: "role",
      header: "Role",
      accessor: (admin: Admin) => (
        <div className="flex items-center">
          {admin.isSuperAdmin ? (
            <span className="text-xs bg-purple-900/30 text-purple-400 px-2.5 py-1 rounded-full font-medium">
              Super Admin
            </span>
          ) : admin.role === 'moderator' ? (
            <span className="text-xs bg-yellow-900/30 text-yellow-400 px-2.5 py-1 rounded-full font-medium">
              Moderator
            </span>
          ) : (
            <span className="text-xs bg-blue-900/30 text-blue-400 px-2.5 py-1 rounded-full font-medium">
              Admin
            </span>
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
      />

      {/* Data Table */}
      <div className="bg-[#212121] rounded-3xl lg:col-span-3 h-auto">
        <div
          className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
            Monitor Admins
          </p>
        </div>
        {/* Controls */}
        <div className="p-6 border-b border-gray-700/50">
          {/* Search, Filter and Export */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by name, ID, email, or wallet address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          className=""
          headerClassName="bg-gray-900/60 border-gray-800"
          rowClassName="border-gray-800 hover:bg-gray-800/30"
          showPagination={true}
          itemsPerPage={10}
          paginationClassName="pb-4"
        />
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg transform transition-all">
            <div
              className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-3xl"
              style={{
                backgroundImage: `url('/img/cust-ref-widget3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                {showCreateModal ? "Create New Admin" : "Edit Admin"}
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
                  className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as 'admin' | 'moderator' })
                  }
                  className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="admin">Admin - Full control (except admin management)</option>
                  <option value="moderator">Moderator - Read-only access</option>
                </select>
                <div className="mt-2 p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-400">
                    {formData.role === 'admin' 
                      ? "✅ Can manage customers, shops, treasury, and all operations except creating/deleting admins"
                      : "👁️ Can only view data across all sections (read-only access)"
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 flex gap-3">
              <button
                onClick={
                  showCreateModal ? handleCreateAdmin : handleUpdateAdmin
                }
                className="flex-1 bg-[#FFCC00] to-blue-600 text-black py-2.5 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-medium"
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
                    role: "admin",
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
          <div className="bg-[#212121] border border-gray-800 rounded-xl shadow-2xl w-full max-w-md transform transition-all">
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
