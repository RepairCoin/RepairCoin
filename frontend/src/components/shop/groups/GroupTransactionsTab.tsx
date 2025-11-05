"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { TrendingUp, TrendingDown, History, ChevronLeft, ChevronRight } from "lucide-react";
import * as shopGroupsAPI from "@/services/api/shopGroups";

interface GroupTransactionsTabProps {
  groupId: string;
  tokenSymbol: string;
}

export default function GroupTransactionsTab({
  groupId,
  tokenSymbol,
}: GroupTransactionsTabProps) {
  const [transactions, setTransactions] = useState<shopGroupsAPI.GroupTokenTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState<"all" | "earn" | "redeem">("all");

  useEffect(() => {
    loadTransactions();
  }, [groupId, page, filterType]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const result = await shopGroupsAPI.getGroupTransactions(groupId, {
        page,
        limit: 20,
        type: filterType === "all" ? undefined : filterType,
      });

      console.log("📦 Transactions result:", result);

      setTransactions(result?.items || []);
      setTotalPages(result?.pagination?.totalPages || 1);
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
    <div className="bg-gray-800 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <History className="w-6 h-6" />
          Transaction History
        </h3>

        {/* Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setFilterType("all");
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === "all"
                ? "bg-[#FFCC00] text-black"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            All
          </button>
          <button
            onClick={() => {
              setFilterType("earn");
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === "earn"
                ? "bg-green-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Issued
          </button>
          <button
            onClick={() => {
              setFilterType("redeem");
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === "redeem"
                ? "bg-orange-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Redeemed
          </button>
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCC00] mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading transactions...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8">
          <History className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No transactions yet</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.transactionId}
                className="bg-gray-900 rounded-lg p-4 hover:bg-gray-850 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Type and Amount */}
                    <div className="flex items-center gap-3 mb-2">
                      {tx.type === "earn" ? (
                        <div className="w-10 h-10 bg-green-600/20 rounded-full flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-green-500" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-orange-600/20 rounded-full flex items-center justify-center">
                          <TrendingDown className="w-5 h-5 text-orange-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-white">
                          {tx.type === "earn" ? "+" : "-"}
                          {tx.amount} {tokenSymbol}
                        </p>
                        <p className="text-sm text-gray-400">
                          {tx.type === "earn" ? "Issued" : "Redeemed"}
                        </p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="ml-13 space-y-1">
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
                      {tx.transactionId.slice(0, 12)}...
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-700">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <span className="text-gray-400">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
