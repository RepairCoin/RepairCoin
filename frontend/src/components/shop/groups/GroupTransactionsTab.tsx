"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { TrendingUp, TrendingDown, History, ChevronLeft, ChevronRight } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";

interface GroupTransactionsTabProps {
  groupId: string;
  tokenSymbol: string;
  refreshKey?: number;
}

export default function GroupTransactionsTab({
  groupId,
  tokenSymbol,
  refreshKey = 0,
}: GroupTransactionsTabProps) {
  const [transactions, setTransactions] = useState<shopGroupsAPI.AffiliateGroupTokenTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState<"all" | "earn" | "redeem">("all");

  useEffect(() => {
    loadTransactions();
  }, [groupId, page, filterType, refreshKey]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const result = await shopGroupsAPI.getGroupTransactions(groupId, {
        page,
        limit: 20,
        type: filterType === "all" ? undefined : filterType,
      });

      console.log("📦 Transactions result:", result);
      console.log("📦 Transactions items:", result?.items);
      console.log("📦 Is array?:", Array.isArray(result));

      // Handle both response formats
      if (Array.isArray(result)) {
        // Backend returned array directly
        setTransactions(result);
        setTotalPages(1);
      } else {
        // Backend returned { items: [], pagination: {} }
        setTransactions(result?.items || []);
        setTotalPages(result?.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Failed to load transactions");
      setTransactions([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-[#101010] rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-[#FFCC00] font-semibold">Transaction History</h3>
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setFilterType("all");
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterType === "all"
                ? "bg-[#FFCC00] text-[#101010]"
                : "bg-[#1e1f22] text-white hover:bg-[#2a2b2f]"
            }`}
          >
            All
          </button>
          <button
            onClick={() => {
              setFilterType("earn");
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterType === "earn"
                ? "bg-green-600 text-white"
                : "bg-[#1e1f22] text-white hover:bg-[#2a2b2f]"
            }`}
          >
            Issued
          </button>
          <button
            onClick={() => {
              setFilterType("redeem");
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterType === "redeem"
                ? "bg-orange-600 text-white"
                : "bg-[#1e1f22] text-white hover:bg-[#2a2b2f]"
            }`}
          >
            Redeemed
          </button>
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCC00] mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading transactions...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12">
          <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No transactions yet</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-[#1e1f22] rounded-lg p-4 hover:bg-[#2a2b2f] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Type and Amount */}
                    <div className="flex items-center gap-3 mb-2">
                      {tx.type === "earn" ? (
                        <div className="w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-orange-600/20 rounded-lg flex items-center justify-center">
                          <TrendingDown className="w-4 h-4 text-orange-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-white">
                          {tx.type === "earn" ? "+" : "-"}
                          {tx.amount} {tokenSymbol}
                        </p>
                        <p className="text-xs text-gray-400">
                          {tx.type === "earn" ? "Issued" : "Redeemed"}
                        </p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="ml-11 space-y-1">
                      <p className="text-sm text-gray-300">
                        <span className="text-gray-500">Customer:</span>{" "}
                        {formatAddress(tx.customerAddress)}
                      </p>
                      <p className="text-sm text-gray-300">
                        <span className="text-gray-500">Shop:</span> {tx.shopId}
                      </p>
                      {tx.reason && (
                        <p className="text-sm text-gray-400 italic">
                          <span className="text-gray-500">Reason:</span> {tx.reason}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">{formatDate(tx.createdAt)}</p>
                    </div>
                  </div>

                  {/* Transaction ID */}
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-mono">
                      {tx.id.slice(0, 12)}...
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-gray-800">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <span className="text-gray-400 text-sm">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
