"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { TrendingUp, TrendingDown, History } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";
import { LoadingSpinner, Pagination, EmptyState, FilterTabs, SectionHeader } from "./shared";
import { formatDateTime, formatAddress, formatTransactionId } from "./utils/formatters";
import { TRANSACTIONS_PER_PAGE } from "./constants";
import type { TransactionFilterType, FilterOption } from "./types";

interface GroupTransactionsTabProps {
  groupId: string;
  tokenSymbol: string;
  refreshKey?: number;
}

const FILTER_OPTIONS: FilterOption<TransactionFilterType>[] = [
  { value: "all", label: "All", activeColor: "bg-[#FFCC00]" },
  { value: "earn", label: "Issued", activeColor: "bg-green-600" },
  { value: "redeem", label: "Redeemed", activeColor: "bg-orange-600" },
];

export default function GroupTransactionsTab({
  groupId,
  tokenSymbol,
  refreshKey = 0,
}: GroupTransactionsTabProps) {
  const [transactions, setTransactions] = useState<shopGroupsAPI.AffiliateGroupTokenTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState<TransactionFilterType>("all");

  useEffect(() => {
    loadTransactions();
  }, [groupId, page, filterType, refreshKey]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const result = await shopGroupsAPI.getGroupTransactions(groupId, {
        page,
        limit: TRANSACTIONS_PER_PAGE,
        type: filterType === "all" ? undefined : filterType,
      });

      // Handle both response formats
      if (Array.isArray(result)) {
        setTransactions(result);
        setTotalPages(1);
      } else {
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

  const handleFilterChange = (value: TransactionFilterType) => {
    setFilterType(value);
    setPage(1);
  };

  return (
    <div className="bg-[#101010] rounded-xl p-4 sm:p-6">
      <SectionHeader
        icon={History}
        title="Transaction History"
        action={
          <FilterTabs
            options={FILTER_OPTIONS}
            value={filterType}
            onChange={handleFilterChange}
          />
        }
      />

      {loading ? (
        <LoadingSpinner message="Loading transactions..." />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={History}
          title="No transactions yet"
        />
      ) : (
        <>
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-[#1e1f22] rounded-lg p-3 sm:p-4 hover:bg-[#2a2b2f] transition-colors"
              >
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Type and Amount */}
                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                      {tx.type === "earn" ? (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-orange-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <TrendingDown className="w-4 h-4 text-orange-500" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-white text-sm sm:text-base truncate">
                          {tx.type === "earn" ? "+" : "-"}
                          {tx.amount} {tokenSymbol}
                        </p>
                        <p className="text-xs text-gray-400">
                          {tx.type === "earn" ? "Issued" : "Redeemed"}
                        </p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="sm:ml-11 space-y-1">
                      <p className="text-xs sm:text-sm text-gray-300 break-all">
                        <span className="text-gray-500">Customer:</span>{" "}
                        {formatAddress(tx.customerAddress)}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-300 break-all">
                        <span className="text-gray-500">Shop:</span> {tx.shopId}
                      </p>
                      {tx.reason && (
                        <p className="text-xs sm:text-sm text-gray-400 italic break-words">
                          <span className="text-gray-500">Reason:</span> {tx.reason}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">{formatDateTime(tx.createdAt)}</p>
                    </div>
                  </div>

                  {/* Transaction ID */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] sm:text-xs text-gray-500 font-mono">
                      {formatTransactionId(tx.id)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            showPageNumbers={false}
          />
        </>
      )}
    </div>
  );
}
