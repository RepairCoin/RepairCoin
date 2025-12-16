"use client";

import React, { useState, useEffect } from "react";
import { DataTable, Column } from "@/components/ui/DataTable";
import apiClient from '@/services/api/client';

// Icon components
const PlusIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4v16m8-8H4"
    />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const ChartBarIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);

const XCircleIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

interface PromoCode {
  id: number;
  code: string;
  name: string;
  description?: string;
  bonus_type: "fixed" | "percentage";
  bonus_value: number;
  max_bonus?: number;
  start_date: string;
  end_date: string;
  total_usage_limit?: number;
  per_customer_limit: number;
  times_used: number;
  total_bonus_issued: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PromoCodeFormData {
  code: string;
  name: string;
  description: string;
  bonus_type: "fixed" | "percentage";
  bonus_value: string;
  max_bonus: string;
  start_date: string;
  end_date: string;
  total_usage_limit: string;
  per_customer_limit: string;
}

interface PromoCodesTabProps {
  shopId: string;
}

export default function PromoCodesTab({ shopId }: PromoCodesTabProps) {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPromoCode, setSelectedPromoCode] = useState<PromoCode | null>(
    null
  );
  const [showStats, setShowStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PromoCodeFormData>({
    code: "",
    name: "",
    description: "",
    bonus_type: "fixed",
    bonus_value: "",
    max_bonus: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    total_usage_limit: "",
    per_customer_limit: "1",
  });

  useEffect(() => {
    if (shopId) {
      fetchPromoCodes();
    }
  }, [shopId]);

  const fetchPromoCodes = async () => {
    if (!shopId) return;

    try {
      setLoading(true);

      const data = await apiClient.get(`/shops/${shopId}/promo-codes`);
      setPromoCodes(data.data || []);
    } catch (err) {
      console.error("Error fetching promo codes:", err);
      setError("Failed to load promo codes");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;

    try {
      setError(null);

      const payload = {
        code: formData.code.toUpperCase(),
        name: formData.name,
        description: formData.description || undefined,
        bonus_type: formData.bonus_type,
        bonus_value: parseFloat(formData.bonus_value),
        max_bonus:
          formData.bonus_type === "percentage" && formData.max_bonus
            ? parseFloat(formData.max_bonus)
            : undefined,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        total_usage_limit: formData.total_usage_limit
          ? parseInt(formData.total_usage_limit)
          : undefined,
        per_customer_limit: parseInt(formData.per_customer_limit) || 1,
      };

      const data = await apiClient.post(`/shops/${shopId}/promo-codes`, payload);

      setPromoCodes([data.data, ...promoCodes]);
      setShowCreateForm(false);
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create promo code"
      );
    }
  };

  const handleDeactivatePromoCode = async (promoCodeId: number) => {
    if (!shopId) return;

    if (!confirm("Are you sure you want to deactivate this promo code?")) {
      return;
    }

    try {
      await apiClient.delete(`/shops/${shopId}/promo-codes/${promoCodeId}`);

      // Update local state
      setPromoCodes(
        promoCodes.map((pc) =>
          pc.id === promoCodeId ? { ...pc, is_active: false } : pc
        )
      );
    } catch (err) {
      setError("Failed to deactivate promo code");
    }
  };

  const formatDateShort = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      bonus_type: "fixed",
      bonus_value: "",
      max_bonus: "",
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      total_usage_limit: "",
      per_customer_limit: "1",
    });
  };

  const getPromoCodeStatus = (promoCode: PromoCode) => {
    if (!promoCode.is_active)
      return { status: "Deactivated", color: "text-gray-500" };

    const now = new Date();
    const start = new Date(promoCode.start_date);
    const end = new Date(promoCode.end_date);

    if (now < start) return { status: "Scheduled", color: "text-blue-600" };
    if (now > end) return { status: "Expired", color: "text-red-600" };
    if (
      promoCode.total_usage_limit &&
      promoCode.times_used >= promoCode.total_usage_limit
    ) {
      return { status: "Limit Reached", color: "text-orange-600" };
    }
    return { status: "Active", color: "text-green-600" };
  };

  // Define columns for DataTable
  const promoCodeColumns: Column<PromoCode>[] = [
    {
      key: "code",
      header: "Code",
      accessor: (item) => (
        <div className="text-sm font-medium text-gray-100">{item.code}</div>
      ),
      sortable: true,
    },
    {
      key: "name",
      header: "Name",
      accessor: (item) => (
        <div>
          <div className="text-sm text-gray-100">{item.name}</div>
          {item.description && (
            <div className="text-xs text-gray-400">{item.description}</div>
          )}
        </div>
      ),
      sortable: true,
    },
    {
      key: "bonus",
      header: "Bonus",
      accessor: (item) => (
        <div className="text-sm text-gray-100">
          {item.bonus_type === "fixed"
            ? `${item.bonus_value} RCN`
            : `${item.bonus_value}%`}
          {item.bonus_type === "percentage" && item.max_bonus && (
            <span className="text-gray-400">
              {" "}
              (max {item.max_bonus} RCN)
            </span>
          )}
        </div>
      ),
    },
    {
      key: "usage",
      header: "Usage",
      accessor: (item) => (
        <div>
          <div className="text-sm text-gray-100">
            {item.times_used}
            {item.total_usage_limit && (
              <span className="text-gray-400">/{item.total_usage_limit}</span>
            )}
          </div>
          <div className="text-xs text-gray-400">
            {item.total_bonus_issued} RCN issued
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      accessor: (item) => {
        const { status, color } = getPromoCodeStatus(item);
        return <span className={`text-sm font-medium ${color}`}>{status}</span>;
      },
    },
    {
      key: "period",
      header: "Valid Period",
      accessor: (item) => (
        <div className="text-sm text-gray-100">
          {formatDateShort(item.start_date)} - {formatDateShort(item.end_date)}
        </div>
      ),
      sortable: true,
    },
    {
      key: "actions",
      header: "Actions",
      accessor: (item) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPromoCode(item);
              setShowStats(true);
            }}
            className="text-blue-500 hover:text-blue-400 transition-colors"
          >
            <ChartBarIcon className="h-5 w-5" />
          </button>
          {item.is_active && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeactivatePromoCode(item.id);
              }}
              className="text-red-500 hover:text-red-400 transition-colors"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      ),
      headerClassName: "text-right",
      className: "text-right",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#212121] rounded-3xl">
        <div
          className="w-full flex items-center justify-between px-4 md:px-8 py-4 text-white rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="flex gap-2 items-center">
            <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
              Promo Codes
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-black text-white px-4 py-2 rounded-3xl hover:bg-[#212121] transition-colors flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Create Promo Code
          </button>
        </div>

        {error && !showCreateForm && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <DataTable<PromoCode>
          data={promoCodes}
          columns={promoCodeColumns}
          keyExtractor={(item) => item.id.toString()}
          emptyMessage="No promo codes yet. Create your first promo code to get started."
          className="mb-6"
          showPagination={promoCodes.length > 10}
          itemsPerPage={10}
        />
      </div>

      {/* Create Promo Code Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Create Promo Code
              </h3>

              <form onSubmit={handleCreatePromoCode} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="SUMMER20"
                      required
                      maxLength={20}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Summer Special"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Get extra RCN on your summer repairs!"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bonus Type
                    </label>
                    <select
                      value={formData.bonus_type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bonus_type: e.target.value as "fixed" | "percentage",
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bonus Value
                    </label>
                    <input
                      type="number"
                      value={formData.bonus_value}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bonus_value: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder={
                        formData.bonus_type === "fixed" ? "10" : "20"
                      }
                      min="0.01"
                      step="0.01"
                      max={
                        formData.bonus_type === "percentage" ? "100" : undefined
                      }
                      required
                    />
                  </div>

                  {formData.bonus_type === "percentage" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Bonus (RCN)
                      </label>
                      <input
                        type="number"
                        value={formData.max_bonus}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            max_bonus: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="50"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) =>
                        setFormData({ ...formData, end_date: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min={formData.start_date}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Usage Limit (Optional)
                    </label>
                    <input
                      type="number"
                      value={formData.total_usage_limit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          total_usage_limit: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="100"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Per Customer Limit
                    </label>
                    <input
                      type="number"
                      value={formData.per_customer_limit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          per_customer_limit: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="1"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      resetForm();
                      setError(null);
                    }}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create Promo Code
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {showStats && selectedPromoCode && (
        <PromoCodeStats
          promoCode={selectedPromoCode}
          shopId={shopId || ""}
          onClose={() => {
            setShowStats(false);
            setSelectedPromoCode(null);
          }}
        />
      )}
    </div>
  );
}

function PromoCodeStats({
  promoCode,
  shopId,
  onClose,
}: {
  promoCode: PromoCode;
  shopId: string;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Helper function for formatting dates
  const formatDateShort = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const url = `/shops/${shopId}/promo-codes/${promoCode.id}/stats`;
      console.log("Fetching promo code stats from:", url);

      const data = await apiClient.get(url);
      console.log("Stats received:", data);
      setStats(data.data || data);
    } catch (err) {
      console.error("Error fetching stats:", err);
      // Set fallback stats to show UI
      setStats({
        stats: {
          total_uses: promoCode.times_used || 0,
          unique_customers: 0,
          total_bonus_issued: promoCode.total_bonus_issued || 0,
          average_bonus: promoCode.times_used > 0
            ? (promoCode.total_bonus_issued || 0) / promoCode.times_used
            : 0,
          uses_by_day: []
        }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Promo Code Statistics
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <XCircleIcon className="h-6 w-6" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : stats ? (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">
                  {promoCode.code} - {promoCode.name}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Total Uses</p>
                    <p className="text-xl font-semibold">
                      {stats.stats.total_uses}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Unique Customers</p>
                    <p className="text-xl font-semibold">
                      {stats.stats.unique_customers}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Bonus Issued</p>
                    <p className="text-xl font-semibold">
                      {stats.stats.total_bonus_issued} RCN
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Average Bonus</p>
                    <p className="text-xl font-semibold">
                      {stats.stats.average_bonus.toFixed(2)} RCN
                    </p>
                  </div>
                </div>
              </div>

              {stats.stats.uses_by_day &&
                stats.stats.uses_by_day.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      Recent Usage (Last 30 Days)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Date
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Uses
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Bonus Issued
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {stats.stats.uses_by_day.map((day: any) => (
                            <tr key={day.date}>
                              <td className="px-4 py-2 text-sm">
                                {formatDateShort(day.date)}
                              </td>
                              <td className="px-4 py-2 text-sm">{day.uses}</td>
                              <td className="px-4 py-2 text-sm">
                                {day.bonus_issued} RCN
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <p className="text-center text-gray-500">
              Failed to load statistics
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
