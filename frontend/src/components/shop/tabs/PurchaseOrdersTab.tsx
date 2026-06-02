"use client";

import { useState, useEffect } from "react";
import { inventoryApi } from "@/services/api/inventory";
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseOrderStats,
  InventoryVendor,
} from "@/types/inventory";
import { toast } from "react-hot-toast";
import {
  Plus,
  FileText,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  PackageCheck,
  Ban
} from "lucide-react";
import { CreatePurchaseOrderModal } from "./modals/CreatePurchaseOrderModal";
import { PurchaseOrderDetailModal } from "./modals/PurchaseOrderDetailModal";
import { ReceiveItemsModal } from "./modals/ReceiveItemsModal";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface PurchaseOrdersTabProps {
  shopId: string;
}

export function PurchaseOrdersTab({ shopId }: PurchaseOrdersTabProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [stats, setStats] = useState<PurchaseOrderStats | null>(null);
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | "all">("all");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    loadData();
  }, [shopId, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [posData, statsData, vendorsData] = await Promise.all([
        inventoryApi.getPurchaseOrders(shopId, statusFilter === "all" ? undefined : statusFilter),
        inventoryApi.getPurchaseOrderStats(shopId),
        inventoryApi.getVendors(),
      ]);
      setPurchaseOrders(posData);
      setStats(statsData);
      setVendors(vendorsData);
    } catch (error) {
      console.error("Error loading purchase orders:", error);
      toast.error("Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    loadData();
    toast.success("Purchase order created successfully");
  };

  const handleViewDetails = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowDetailModal(true);
  };

  const handleReceiveItems = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowReceiveModal(true);
  };

  const handleReceiveSuccess = () => {
    setShowReceiveModal(false);
    setSelectedPO(null);
    loadData();
    toast.success("Items received successfully");
  };

  const handleCancelPO = async (po: PurchaseOrder) => {
    if (!confirm(`Are you sure you want to cancel PO ${po.poNumber}?`)) return;

    try {
      await inventoryApi.cancelPurchaseOrder(shopId, po.id);
      toast.success("Purchase order cancelled");
      loadData();
    } catch (error) {
      console.error("Error cancelling PO:", error);
      toast.error("Failed to cancel purchase order");
    }
  };

  const handleDeletePO = async (po: PurchaseOrder) => {
    if (po.status !== "draft") {
      toast.error("Only draft purchase orders can be deleted");
      return;
    }

    if (!confirm(`Are you sure you want to delete PO ${po.poNumber}? This action cannot be undone.`)) return;

    try {
      await inventoryApi.deletePurchaseOrder(shopId, po.id);
      toast.success("Purchase order deleted");
      loadData();
    } catch (error) {
      console.error("Error deleting PO:", error);
      toast.error("Failed to delete purchase order");
    }
  };

  const getStatusBadge = (status: PurchaseOrderStatus) => {
    const styles: Record<PurchaseOrderStatus, { bg: string; text: string; icon: typeof FileText }> = {
      draft: { bg: "bg-gray-800", text: "text-gray-300", icon: FileText },
      sent: { bg: "bg-blue-900/50", text: "text-blue-400", icon: Clock },
      confirmed: { bg: "bg-purple-900/50", text: "text-purple-400", icon: CheckCircle },
      partially_received: { bg: "bg-orange-900/50", text: "text-orange-400", icon: Package },
      received: { bg: "bg-green-900/50", text: "text-green-400", icon: PackageCheck },
      cancelled: { bg: "bg-red-900/50", text: "text-red-400", icon: XCircle },
    };

    const style = styles[status];
    const Icon = style.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        <Icon className="w-3.5 h-3.5" />
        {status.replace("_", " ").toUpperCase()}
      </span>
    );
  };

  const filteredPOs = purchaseOrders.filter((po) => {
    const matchesSearch =
      po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.vendorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00]"></div>
      </div>
    );
  }

  return (
    <div className="bg-[#101010] rounded-xl p-6 space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Orders</p>
                <p className="text-2xl font-bold text-white">{stats.totalOrders || 0}</p>
              </div>
              <FileText className="w-8 h-8 text-gray-500" />
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Spending</p>
                <p className="text-2xl font-bold text-white">${parseFloat(String(stats.totalSpending || 0)).toFixed(2)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Pending Orders</p>
                <p className="text-2xl font-bold text-orange-500">{stats.pendingOrders || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Received Orders</p>
                <p className="text-2xl font-bold text-green-500">{stats.receivedOrders || 0}</p>
              </div>
              <PackageCheck className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Avg Order Value</p>
                <p className="text-2xl font-bold text-white">${parseFloat(String(stats.averageOrderValue || 0)).toFixed(2)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>
      )}

      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pb-4 border-b border-gray-800">
        <div>
          <h2 className="text-2xl font-bold text-white">Purchase Orders</h2>
          <p className="text-sm text-gray-400 mt-1">Manage your inventory purchase orders</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Create Purchase Order
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by PO number, vendor, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#1a1a1a] border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-[#FFCC00] placeholder-gray-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | "all")}
            className="px-4 py-2 bg-[#1a1a1a] border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-[#FFCC00]"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="confirmed">Confirmed</option>
            <option value="partially_received">Partially Received</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Purchase Orders List */}
      {filteredPOs.length === 0 ? (
        <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-12 text-center">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Purchase Orders Found</h3>
          <p className="text-gray-400 mb-6">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Create your first purchase order to start tracking inventory restocking"}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Create Purchase Order
            </button>
          )}
        </div>
      ) : (
        <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0a0a0a] border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    PO Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Expected Delivery
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredPOs.map((po) => (
                  <tr key={po.id} className="hover:bg-[#252525] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{po.poNumber}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(po.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">{po.vendorName || "N/A"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(po.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">{po.items.length} items</div>
                      <div className="text-xs text-gray-500">
                        {po.items.reduce((sum, item) => sum + item.quantityOrdered, 0)} units
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">${parseFloat(po.total as any).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">
                        {po.expectedDeliveryDate
                          ? new Date(po.expectedDeliveryDate).toLocaleDateString()
                          : "Not set"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-2 hover:bg-[#252525] rounded-lg transition-colors outline-none">
                          <MoreVertical className="w-5 h-5 text-gray-400" />
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                          align="end"
                          className="w-48 bg-[#1a1a1a] border border-gray-700 text-gray-300 p-0"
                        >
                          <DropdownMenuItem
                            onClick={() => handleViewDetails(po)}
                            className="gap-2 px-4 py-2 text-sm text-gray-300 rounded-none cursor-pointer focus:bg-[#252525] focus:text-gray-300"
                          >
                            <Eye className="w-4 h-4" />
                            View Details
                          </DropdownMenuItem>

                          {(po.status === "confirmed" || po.status === "partially_received") && (
                            <DropdownMenuItem
                              onClick={() => handleReceiveItems(po)}
                              className="gap-2 px-4 py-2 text-sm text-green-400 rounded-none cursor-pointer focus:bg-[#252525] focus:text-green-400"
                            >
                              <PackageCheck className="w-4 h-4" />
                              Receive Items
                            </DropdownMenuItem>
                          )}

                          {po.status !== "received" && po.status !== "cancelled" && (
                            <DropdownMenuItem
                              onClick={() => handleCancelPO(po)}
                              className="gap-2 px-4 py-2 text-sm text-orange-400 rounded-none cursor-pointer focus:bg-[#252525] focus:text-orange-400"
                            >
                              <Ban className="w-4 h-4" />
                              Cancel Order
                            </DropdownMenuItem>
                          )}

                          {po.status === "draft" && (
                            <>
                              <DropdownMenuSeparator className="bg-gray-700 my-0" />
                              <DropdownMenuItem
                                onClick={() => handleDeletePO(po)}
                                className="gap-2 px-4 py-2 text-sm text-red-400 rounded-none cursor-pointer focus:bg-[#252525] focus:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreatePurchaseOrderModal
          shopId={shopId}
          vendors={vendors}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {showDetailModal && selectedPO && (
        <PurchaseOrderDetailModal
          purchaseOrder={selectedPO}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedPO(null);
          }}
          onRefresh={loadData}
        />
      )}

      {showReceiveModal && selectedPO && (
        <ReceiveItemsModal
          shopId={shopId}
          purchaseOrder={selectedPO}
          onClose={() => {
            setShowReceiveModal(false);
            setSelectedPO(null);
          }}
          onSuccess={handleReceiveSuccess}
        />
      )}
    </div>
  );
}
