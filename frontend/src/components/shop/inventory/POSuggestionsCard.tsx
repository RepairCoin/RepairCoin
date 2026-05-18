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

  useEffect(() => {
    loadSuggestions();
  }, [shopId]);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const response = await inventoryApi.getSuggestions(shopId, {
        status: "pending",
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
        toast.info("No purchase order suggestions needed at this time");
      }
    } catch (error) {
      console.error("Error generating suggestions:", error);
      toast.error("Failed to generate suggestions");
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (suggestionId: string) => {
    try {
      setProcessingId(suggestionId);
      await inventoryApi.approveSuggestion(suggestionId);

      toast.success("Suggestion approved! You can now create a purchase order for this item.");

      // Remove approved suggestion from list
      setSuggestions(suggestions.filter((s) => s.id !== suggestionId));

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

      // Remove rejected suggestion from list
      setSuggestions(suggestions.filter((s) => s.id !== suggestionId));
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
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center h-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCC00]"></div>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">No Purchase Order Suggestions</h3>
              <p className="text-sm text-gray-600">
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
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Sparkles className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              Smart Purchase Order Suggestions
              <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                {suggestions.length}
              </span>
            </h3>
            <p className="text-sm text-gray-600">
              AI-powered recommendations based on usage analytics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
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
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Item Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">{suggestion.itemName}</h4>
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
                  <p className="text-sm text-gray-700 mb-3">{suggestion.reason}</p>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Current Stock</p>
                      <p className="text-sm font-semibold text-gray-900">{suggestion.currentStock}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Suggested Quantity</p>
                      <p className="text-sm font-semibold text-green-600">
                        {suggestion.suggestedQuantity}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Avg Usage/Day</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {suggestion.avgDailyUsage.toFixed(1)}
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
                            suggestion.daysUntilStockout <= 7 ? "text-red-600" : "text-gray-900"
                          }`}
                        >
                          {suggestion.daysUntilStockout}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Vendor */}
                  {suggestion.vendorName && (
                    <div className="mt-2 text-xs text-gray-500">
                      Vendor: <span className="font-medium">{suggestion.vendorName}</span>
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex flex-col gap-2">
                  {rejectingId === suggestion.id ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Reason for rejection..."
                        className="w-full px-2 py-1.5 text-sm border border-red-300 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
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
                          className="flex-1 px-3 py-1.5 bg-white border border-gray-300 text-sm rounded hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApprove(suggestion.id)}
                        disabled={processingId === suggestion.id}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ThumbsUp className="w-4 h-4" />
                        {processingId === suggestion.id ? "Processing..." : "Approve"}
                      </button>
                      <button
                        onClick={() => setRejectingId(suggestion.id)}
                        disabled={processingId === suggestion.id}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ThumbsDown className="w-4 h-4" />
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Info */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-purple-200">
          <p className="text-xs text-gray-600">
            <strong>How it works:</strong> Suggestions are generated based on your last 30 days of usage
            data. Urgency levels are calculated based on estimated days until stockout. Approved
            suggestions can be converted to purchase orders.
          </p>
        </div>
      )}
    </div>
  );
}
