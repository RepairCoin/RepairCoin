"use client";

import { useState, useEffect } from "react";
import { inventoryApi } from "@/services/api/inventory";
import type { POSuggestion } from "@/types/inventory";
import { toast } from "react-hot-toast";
import {
  AlertTriangle,
  CheckCircle,
  X,
  TrendingDown,
  Package,
  Clock,
  Sparkles,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Truck,
  Star,
  Award,
  Zap,
} from "lucide-react";

interface POSuggestionsCardProps {
  shopId: string;
  onSuggestionActioned?: () => void;
}

export function POSuggestionsCard({ shopId, onSuggestionActioned }: POSuggestionsCardProps) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<POSuggestion[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSuggestions();
  }, [shopId, statusFilter]);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const response = await inventoryApi.getSuggestions(shopId, {
        status: statusFilter,
      });
      setSuggestions(response.suggestions);
    } catch (error) {
      console.error("Error loading PO suggestions:", error);
      toast.error("Failed to load purchase order suggestions");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const response = await inventoryApi.generateSuggestions(shopId);
      setSuggestions(response.suggestions);

      if (response.count > 0) {
        toast.success(`Generated ${response.count} new purchase order suggestions!`);
        setExpanded(true);
      } else {
        toast("No purchase order suggestions needed at this time");
      }
    } catch (error) {
      console.error("Error generating suggestions:", error);
      toast.error("Failed to generate suggestions");
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (suggestionId: string, autoCreatePO: boolean = false) => {
    try {
      setProcessingId(suggestionId);
      const response = await inventoryApi.approveSuggestion(suggestionId, { autoCreatePO });

      console.log('Approve response:', response); // Debug log

      if (autoCreatePO && response.purchaseOrderId) {
        toast.success(`Suggestion approved and PO #${response.purchaseOrderId.slice(0, 8)} created!`);
      } else if (autoCreatePO) {
        toast.success(`Suggestion approved!`);
      } else {
        toast.success("Suggestion approved!");
      }

      // Reload suggestions to get fresh data
      await loadSuggestions();

      onSuggestionActioned?.();
    } catch (error) {
      console.error("Error approving suggestion:", error);
      toast.error("Failed to approve suggestion");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (suggestionId: string) => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    try {
      setProcessingId(suggestionId);
      await inventoryApi.rejectSuggestion(suggestionId, {
        reason: rejectionReason,
      });

      toast.success("Suggestion rejected");

      // Reload suggestions to get fresh data
      await loadSuggestions();
      setRejectingId(null);
      setRejectionReason("");

      onSuggestionActioned?.();
    } catch (error) {
      console.error("Error rejecting suggestion:", error);
      toast.error("Failed to reject suggestion");
    } finally {
      setProcessingId(null);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "critical":
        return "bg-red-900/50 text-red-400 border-red-700";
      case "high":
        return "bg-orange-900/50 text-orange-400 border-orange-700";
      case "medium":
        return "bg-yellow-900/50 text-yellow-400 border-yellow-700";
      case "low":
        return "bg-blue-900/50 text-blue-400 border-blue-700";
      default:
        return "bg-gray-800 text-gray-300 border-gray-700";
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case "critical":
      case "high":
        return <AlertTriangle className="w-4 h-4" />;
      case "medium":
        return <TrendingDown className="w-4 h-4" />;
      case "low":
        return <Package className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const toggleVendorComparison = (suggestionId: string) => {
    setExpandedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(suggestionId)) {
        next.delete(suggestionId);
      } else {
        next.add(suggestionId);
      }
      return next;
    });
  };

  const getPerformanceColor = (score?: number) => {
    if (!score) return "text-gray-400";
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-orange-400";
  };

  if (loading) {
    return (
      <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6">
        <div className="flex items-center justify-center h-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCC00]"></div>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 rounded-lg border border-green-800 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-900/30 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">No Purchase Order Suggestions</h3>
              <p className="text-sm text-gray-400">
                All inventory levels are healthy. Click "Generate" to check for new suggestions.
              </p>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-900/30 rounded-lg">
            <Sparkles className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              Smart Purchase Order Suggestions
              <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                {suggestions.length}
              </span>
            </h3>
            <p className="text-sm text-gray-400">
              AI-powered recommendations based on usage analytics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "pending" | "approved" | "rejected")}
            className="px-3 py-1.5 bg-[#1a1a1a] border border-gray-700 text-white rounded-lg text-sm font-medium hover:bg-[#252525] transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-gray-700 text-white rounded-lg hover:bg-[#252525] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400"
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Suggestions List */}
      {expanded && (
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Item Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-white">{suggestion.itemName}</h4>
                    {suggestion.itemSku && (
                      <span className="text-xs text-gray-500">SKU: {suggestion.itemSku}</span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getUrgencyColor(
                        suggestion.urgency
                      )}`}
                    >
                      {getUrgencyIcon(suggestion.urgency)}
                      {suggestion.urgency.toUpperCase()}
                    </span>
                  </div>

                  {/* Reason */}
                  <p className="text-sm text-gray-300 mb-3">{suggestion.reason}</p>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Current Stock</p>
                      <p className="text-sm font-semibold text-white">{suggestion.currentStock.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Suggested Quantity</p>
                      <p className="text-sm font-semibold text-green-400">
                        {suggestion.suggestedQuantity.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Avg Usage/Day</p>
                      <p className="text-sm font-semibold text-white">
                        {suggestion.avgDailyUsage.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </p>
                    </div>
                    {suggestion.daysUntilStockout && (
                      <div>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Days Until Stockout
                        </p>
                        <p
                          className={`text-sm font-semibold ${
                            suggestion.daysUntilStockout <= 7 ? "text-red-400" : "text-white"
                          }`}
                        >
                          {suggestion.daysUntilStockout.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Vendor */}
                  {suggestion.vendorName && (
                    <div className="mt-2 text-xs text-gray-500">
                      Vendor: <span className="font-medium text-gray-400">{suggestion.vendorName}</span>
                    </div>
                  )}

                  {/* Vendor Comparison Section */}
                  {suggestion.vendorComparisons && suggestion.vendorComparisons.length > 1 && (
                    <div className="mt-3 border-t border-gray-800 pt-3">
                      <button
                        onClick={() => toggleVendorComparison(suggestion.id)}
                        className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        {expandedVendors.has(suggestion.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        Compare {suggestion.vendorComparisons.length} Vendors
                        <Zap className="w-3 h-3" />
                      </button>

                      {expandedVendors.has(suggestion.id) && (
                        <div className="mt-3 space-y-2">
                          {suggestion.vendorComparisons.map((vendor) => {
                            const isRecommended = vendor.vendorId === suggestion.recommendedVendorId;

                            return (
                              <div
                                key={vendor.vendorId}
                                className={`relative bg-[#252525] rounded-lg border p-3 transition-colors ${
                                  isRecommended
                                    ? "border-purple-500 bg-purple-900/10"
                                    : "border-gray-700 hover:border-gray-600"
                                }`}
                              >
                                {/* Recommended Badge */}
                                {isRecommended && (
                                  <div className="absolute -top-2 -right-2">
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full shadow-lg">
                                      <Star className="w-3 h-3 fill-current" />
                                      Recommended
                                    </div>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                  {/* Vendor Name */}
                                  <div className="md:col-span-2">
                                    <p className="text-xs text-gray-500 mb-1">Vendor</p>
                                    <p className="font-semibold text-white flex items-center gap-2">
                                      {vendor.vendorName}
                                      {vendor.isPreferred && (
                                        <span title="Preferred Vendor" aria-label="Preferred Vendor">
                                          <Award className="w-3 h-3 text-yellow-400" />
                                        </span>
                                      )}
                                    </p>
                                  </div>

                                  {/* Unit Cost & Total */}
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Unit Cost</p>
                                    <p className="text-sm font-semibold text-white">
                                      ${vendor.unitCost.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      Total: ${vendor.totalCost.toFixed(2)}
                                    </p>
                                    {vendor.isBestValue && (
                                      <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-green-900/30 text-green-400 text-xs rounded">
                                        <DollarSign className="w-3 h-3" />
                                        Best Value
                                      </span>
                                    )}
                                  </div>

                                  {/* Lead Time */}
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Lead Time</p>
                                    <p className="text-sm font-semibold text-white flex items-center gap-1">
                                      <Truck className="w-3 h-3" />
                                      {vendor.leadTimeDays} days
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      {new Date(vendor.estimatedDeliveryDate).toLocaleDateString()}
                                    </p>
                                    {vendor.isFastestDelivery && (
                                      <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-blue-900/30 text-blue-400 text-xs rounded">
                                        <Zap className="w-3 h-3" />
                                        Fastest
                                      </span>
                                    )}
                                  </div>

                                  {/* Performance Score */}
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Performance</p>
                                    {vendor.historicalPerformanceScore ? (
                                      <>
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 bg-gray-700 rounded-full h-2">
                                            <div
                                              className={`h-2 rounded-full transition-all ${
                                                vendor.historicalPerformanceScore >= 80
                                                  ? "bg-green-500"
                                                  : vendor.historicalPerformanceScore >= 60
                                                  ? "bg-yellow-500"
                                                  : "bg-orange-500"
                                              }`}
                                              style={{ width: `${vendor.historicalPerformanceScore}%` }}
                                            />
                                          </div>
                                          <span
                                            className={`text-sm font-semibold ${getPerformanceColor(
                                              vendor.historicalPerformanceScore
                                            )}`}
                                          >
                                            {vendor.historicalPerformanceScore}
                                          </span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">Based on history</p>
                                      </>
                                    ) : (
                                      <p className="text-xs text-gray-400">No history</p>
                                    )}
                                  </div>
                                </div>

                                {/* Notes */}
                                {vendor.notes && (
                                  <div className="mt-2 pt-2 border-t border-gray-700">
                                    <p className="text-xs text-gray-400">{vendor.notes}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Comparison Footer */}
                          <div className="mt-2 pt-2 border-t border-gray-700">
                            <p className="text-xs text-gray-500">
                              <strong className="text-gray-400">Performance scores</strong> are calculated from the last 12 months:
                              on-time delivery (40%), order completion (30%), and cancellation rate penalty (-20%).
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex flex-col gap-2">
                  {statusFilter === "pending" ? (
                    rejectingId === suggestion.id ? (
                      <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 space-y-2">
                        <textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Reason for rejection..."
                          className="w-full px-2 py-1.5 text-sm bg-[#1a1a1a] border border-red-600 text-white rounded focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none placeholder-gray-500"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReject(suggestion.id)}
                            disabled={processingId === suggestion.id}
                            className="flex-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => {
                              setRejectingId(null);
                              setRejectionReason("");
                            }}
                            className="flex-1 px-3 py-1.5 bg-[#1a1a1a] border border-gray-700 text-white text-sm rounded hover:bg-[#252525] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApprove(suggestion.id, false)}
                          disabled={processingId === suggestion.id}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          {processingId === suggestion.id ? "Processing..." : "Approve"}
                        </button>
                        <button
                          onClick={() => handleApprove(suggestion.id, true)}
                          disabled={processingId === suggestion.id}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          title="Approve and automatically create purchase order"
                        >
                          <Package className="w-4 h-4" />
                          {processingId === suggestion.id ? "Processing..." : "Create PO"}
                        </button>
                        <button
                          onClick={() => setRejectingId(suggestion.id)}
                          disabled={processingId === suggestion.id}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-gray-700 text-gray-300 rounded-lg hover:bg-[#252525] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          Reject
                        </button>
                      </>
                    )
                  ) : statusFilter === "approved" ? (
                    <>
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 border border-green-700 rounded-lg text-sm text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        Approved
                      </div>
                      {!suggestion.purchaseOrderId && (
                        <button
                          onClick={() => handleApprove(suggestion.id, true)}
                          disabled={processingId === suggestion.id}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          title="Create purchase order from this approved suggestion"
                        >
                          <Package className="w-4 h-4" />
                          {processingId === suggestion.id ? "Creating..." : "Create PO"}
                        </button>
                      )}
                      {suggestion.purchaseOrderId && (
                        <div className="px-3 py-2 bg-blue-900/20 border border-blue-700 rounded-lg text-sm text-blue-400">
                          <Package className="w-4 h-4 inline mr-1" />
                          PO Created
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-900/20 border border-red-700 rounded-lg text-sm text-red-400">
                      <X className="w-4 h-4" />
                      Rejected
                      {suggestion.rejectionReason && (
                        <div className="mt-1 text-xs text-gray-500">
                          {suggestion.rejectionReason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Info */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-purple-700/50">
          <p className="text-xs text-gray-400">
            <strong className="text-gray-300">How it works:</strong> Suggestions are generated based on your last 30 days of usage
            data. Urgency levels are calculated based on estimated days until stockout. Approved
            suggestions can be converted to purchase orders.
          </p>
        </div>
      )}
    </div>
  );
}
