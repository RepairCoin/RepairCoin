"use client";

import React, { useState, useEffect } from "react";
import { Tag, Plus, Trash2, BarChart3, X } from "lucide-react";
import apiClient from '@/services/api/client';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCC00]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#101010] rounded-xl overflow-hidden">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center gap-3">
            <Tag className="w-5 h-5 sm:w-6 sm:h-6 text-[#FFCC00]" />
            <h2 className="text-sm sm:text-base font-semibold text-[#FFCC00]">
              Your Shop&apos;s Promo Codes
            </h2>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-[#FFCC00] text-black px-3 sm:px-4 py-2 rounded-md hover:bg-[#FFD633] transition-colors flex items-center justify-center gap-2 text-sm font-medium w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Create Promo Code
          </button>
        </div>

        {error && !showCreateForm && (
          <div className="mx-4 sm:mx-6 mb-4 p-3 sm:p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Desktop Table - Hidden on mobile */}
        <div className="hidden lg:block overflow-x-auto">
          {/* Table Header */}
          <div className="bg-black">
            <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_0.8fr_1.2fr_0.8fr] gap-4 px-6 py-3">
              <div className="text-xs font-semibold text-white tracking-wider">CODE</div>
              <div className="text-xs font-semibold text-white tracking-wider">NAME</div>
              <div className="text-xs font-semibold text-white tracking-wider">BONUS</div>
              <div className="text-xs font-semibold text-white tracking-wider">USAGE</div>
              <div className="text-xs font-semibold text-white tracking-wider">STATUS</div>
              <div className="text-xs font-semibold text-white tracking-wider">VALID PERIOD</div>
              <div className="text-xs font-semibold text-white tracking-wider text-right">ACTIONS</div>
            </div>
          </div>

          {/* Table Body */}
          {promoCodes.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No promo codes yet. Create your first promo code to get started.
            </div>
          ) : (
            <div className="divide-y divide-[#303236]">
              {promoCodes.map((promoCode) => {
                const { status } = getPromoCodeStatus(promoCode);
                return (
                  <div
                    key={promoCode.id}
                    className="grid grid-cols-[1fr_1.5fr_1fr_1fr_0.8fr_1.2fr_0.8fr] gap-4 px-6 py-4 hover:bg-[#1a1a1a] transition-colors"
                  >
                    {/* Code */}
                    <div className="text-sm font-semibold text-white">
                      {promoCode.code}
                    </div>

                    {/* Name & Description */}
                    <div>
                      <div className="text-sm font-semibold text-white">{promoCode.name}</div>
                      {promoCode.description && (
                        <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                          {promoCode.description}
                        </div>
                      )}
                    </div>

                    {/* Bonus */}
                    <div className="text-sm font-semibold text-white">
                      {promoCode.bonus_type === "fixed"
                        ? `${promoCode.bonus_value} RCN`
                        : `${promoCode.bonus_value}%`}
                      {promoCode.bonus_type === "percentage" && promoCode.max_bonus && (
                        <span className="text-gray-400 font-normal">
                          {" "}(max {promoCode.max_bonus} RCN)
                        </span>
                      )}
                    </div>

                    {/* Usage */}
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {promoCode.times_used}
                        {promoCode.total_usage_limit && (
                          <span className="text-gray-400 font-normal">/{promoCode.total_usage_limit}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {promoCode.total_bonus_issued} RCN Issued
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <span className={`text-sm font-semibold ${
                        status === "Active" ? "text-[#11E326]" :
                        status === "Expired" ? "text-red-500" :
                        status === "Scheduled" ? "text-blue-400" :
                        status === "Limit Reached" ? "text-orange-400" :
                        "text-gray-500"
                      }`}>
                        {status}
                      </span>
                    </div>

                    {/* Valid Period */}
                    <div className="text-sm text-white">
                      {formatDateShort(promoCode.start_date)} - {formatDateShort(promoCode.end_date)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => {
                          setSelectedPromoCode(promoCode);
                          setShowStats(true);
                        }}
                        className="text-[#FFCC00] hover:text-[#FFD633] transition-colors"
                        title="View Statistics"
                      >
                        <BarChart3 className="w-5 h-5" />
                      </button>
                      {promoCode.is_active && (
                        <button
                          onClick={() => handleDeactivatePromoCode(promoCode.id)}
                          className="text-red-500 hover:text-red-400 transition-colors"
                          title="Deactivate"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile Card Layout - Shown on mobile/tablet */}
        <div className="lg:hidden">
          {promoCodes.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-500 text-sm">
              No promo codes yet. Create your first promo code to get started.
            </div>
          ) : (
            <div className="divide-y divide-[#303236]">
              {promoCodes.map((promoCode) => {
                const { status } = getPromoCodeStatus(promoCode);
                return (
                  <div
                    key={promoCode.id}
                    className="p-4 hover:bg-[#1a1a1a] transition-colors"
                  >
                    {/* Card Header - Code, Status, Actions */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold text-[#FFCC00]">
                            {promoCode.code}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            status === "Active" ? "bg-[#11E326]/20 text-[#11E326]" :
                            status === "Expired" ? "bg-red-500/20 text-red-500" :
                            status === "Scheduled" ? "bg-blue-400/20 text-blue-400" :
                            status === "Limit Reached" ? "bg-orange-400/20 text-orange-400" :
                            "bg-gray-500/20 text-gray-500"
                          }`}>
                            {status}
                          </span>
                        </div>
                        <div className="text-sm text-white mt-1">{promoCode.name}</div>
                        {promoCode.description && (
                          <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                            {promoCode.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            setSelectedPromoCode(promoCode);
                            setShowStats(true);
                          }}
                          className="p-2 bg-[#1a1a1a] rounded-lg text-[#FFCC00] hover:bg-[#252525] transition-colors"
                          title="View Statistics"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        {promoCode.is_active && (
                          <button
                            onClick={() => handleDeactivatePromoCode(promoCode.id)}
                            className="p-2 bg-[#1a1a1a] rounded-lg text-red-500 hover:bg-[#252525] transition-colors"
                            title="Deactivate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Card Body - Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#1a1a1a] rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-0.5">Bonus</p>
                        <p className="text-sm font-semibold text-white">
                          {promoCode.bonus_type === "fixed"
                            ? `${promoCode.bonus_value} RCN`
                            : `${promoCode.bonus_value}%`}
                          {promoCode.bonus_type === "percentage" && promoCode.max_bonus && (
                            <span className="text-gray-400 font-normal text-xs">
                              {" "}(max {promoCode.max_bonus})
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="bg-[#1a1a1a] rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-0.5">Usage</p>
                        <p className="text-sm font-semibold text-white">
                          {promoCode.times_used}
                          {promoCode.total_usage_limit && (
                            <span className="text-gray-400 font-normal">/{promoCode.total_usage_limit}</span>
                          )}
                          <span className="text-xs text-gray-400 font-normal block">
                            {promoCode.total_bonus_issued} RCN issued
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Valid Period */}
                    <div className="mt-3 pt-3 border-t border-[#303236]">
                      <p className="text-xs text-gray-400">
                        Valid: <span className="text-white">{formatDateShort(promoCode.start_date)} - {formatDateShort(promoCode.end_date)}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Promo Code Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-[#101010] border border-gray-800 rounded-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-[#FFCC00]">
                  Create Promo Code
                </h3>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                    setError(null);
                  }}
                  className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleCreatePromoCode} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-900/20 border border-red-500 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
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
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                      placeholder="SUMMER20"
                      required
                      maxLength={20}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                      placeholder="Summer Special"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                    rows={2}
                    placeholder="Get extra RCN on your summer repairs!"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
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
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
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
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
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
                      <label className="block text-sm font-medium text-gray-400 mb-2">
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
                        className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                        placeholder="50"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) =>
                        setFormData({ ...formData, end_date: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                      min={formData.start_date}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
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
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                      placeholder="100"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
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
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                      min="1"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      resetForm();
                      setError(null);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2.5 bg-[#FFCC00] text-black font-medium rounded-lg hover:bg-[#FFD633] transition-colors text-sm"
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
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-[#101010] border border-gray-800 rounded-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex justify-between items-start mb-4 sm:mb-6">
            <h3 className="text-base sm:text-lg font-semibold text-[#FFCC00]">
              Promo Code Statistics
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48 sm:h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCC00]"></div>
            </div>
          ) : stats ? (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-[#1a1a1a] rounded-xl p-3 sm:p-5 border border-gray-800">
                <h4 className="font-semibold text-white mb-3 sm:mb-4 text-sm sm:text-base">
                  {promoCode.code} - {promoCode.name}
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <div className="bg-[#101010] rounded-lg p-2.5 sm:p-3">
                    <p className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1">Total Uses</p>
                    <p className="text-lg sm:text-xl font-bold text-white">
                      {stats.stats.total_uses}
                    </p>
                  </div>
                  <div className="bg-[#101010] rounded-lg p-2.5 sm:p-3">
                    <p className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1">Unique Customers</p>
                    <p className="text-lg sm:text-xl font-bold text-white">
                      {stats.stats.unique_customers}
                    </p>
                  </div>
                  <div className="bg-[#101010] rounded-lg p-2.5 sm:p-3">
                    <p className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1">Total Bonus Issued</p>
                    <p className="text-lg sm:text-xl font-bold text-[#FFCC00]">
                      {stats.stats.total_bonus_issued} RCN
                    </p>
                  </div>
                  <div className="bg-[#101010] rounded-lg p-2.5 sm:p-3">
                    <p className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1">Average Bonus</p>
                    <p className="text-lg sm:text-xl font-bold text-white">
                      {stats.stats.average_bonus.toFixed(2)} RCN
                    </p>
                  </div>
                </div>
              </div>

              {stats.stats.uses_by_day &&
                stats.stats.uses_by_day.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-white mb-2 sm:mb-3 text-sm sm:text-base">
                      Recent Usage (Last 30 Days)
                    </h4>
                    <div className="overflow-x-auto rounded-lg border border-gray-800">
                      <table className="min-w-full">
                        <thead className="bg-black">
                          <tr>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-white uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-white uppercase tracking-wider">
                              Uses
                            </th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-white uppercase tracking-wider">
                              Bonus Issued
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-[#1a1a1a] divide-y divide-gray-800">
                          {stats.stats.uses_by_day.map((day: any) => (
                            <tr key={day.date} className="hover:bg-[#222222]">
                              <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-white">
                                {formatDateShort(day.date)}
                              </td>
                              <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-white">{day.uses}</td>
                              <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[#FFCC00]">
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
            <p className="text-center text-gray-500 text-sm">
              Failed to load statistics
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
