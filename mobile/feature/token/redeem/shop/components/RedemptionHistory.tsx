import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { RedemptionHistoryItem } from "../../hooks";

interface RedemptionHistoryProps {
  transactions: RedemptionHistoryItem[];
  isLoading: boolean;
}

const ITEMS_PER_PAGE = 3;

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${dateStr}, ${timeStr}`;
};

const getStatusStyle = (status: RedemptionHistoryItem["status"]) => {
  switch (status) {
    case "confirmed":
      return { badge: "bg-[#22C55E]", text: "text-white", label: "Completed" };
    case "pending":
      return { badge: "bg-yellow-500", text: "text-black", label: "Pending" };
    default:
      return { badge: "bg-red-500", text: "text-white", label: "Failed" };
  }
};

export const RedemptionHistory: React.FC<RedemptionHistoryProps> = ({
  transactions,
  isLoading,
}) => {
  const [showHistory, setShowHistory] = useState(true);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(transactions.length / ITEMS_PER_PAGE));

  const pageItems = useMemo(
    () =>
      transactions.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [transactions, page]
  );

  return (
    <View className="px-5 pb-6">
      <View className="bg-[#101010] rounded-2xl border border-gray-800 overflow-hidden">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-800">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="schedule" size={20} color="#FFCC00" />
            <Text className="text-lg font-semibold text-[#FFCC00]">
              Redemption History
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowHistory((prev) => !prev)}>
            <Text className="text-[#FFCC00] text-sm font-medium">
              {showHistory ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>
        </View>

        {showHistory && (
          <View className="px-4 py-4">
            {isLoading ? (
              <View className="py-6 items-center">
                <ActivityIndicator color="#FFCC00" size="large" />
              </View>
            ) : transactions.length === 0 ? (
              <Text className="text-center text-gray-500 py-6">
                No redemptions yet
              </Text>
            ) : (
              <View>
                {pageItems.map((tx, index) => {
                  const statusStyle = getStatusStyle(tx.status);
                  const isLast = index === pageItems.length - 1;
                  return (
                    <View
                      key={tx.id}
                      className={`flex-row justify-between items-start py-4 ${
                        isLast ? "" : "border-b border-gray-800"
                      }`}
                    >
                      {/* Left: customer + meta */}
                      <View className="flex-1 min-w-0 pl-4 border-l-2 border-[#FFCC00] mr-3">
                        <Text className="font-semibold text-white" numberOfLines={1}>
                          {tx.customerName}
                        </Text>
                        {!!tx.customerAddress && (
                          <Text
                            className="text-sm text-gray-500 mt-0.5"
                            numberOfLines={1}
                          >
                            {tx.customerAddress.slice(0, 18)}...
                          </Text>
                        )}
                        <Text className="text-sm text-gray-500 mt-1">
                          {formatTimestamp(tx.timestamp)}
                        </Text>
                      </View>

                      {/* Right: amount + status */}
                      <View className="items-end">
                        <Text className="font-bold text-[#FFCC00] text-lg">
                          {tx.amount} RCN
                        </Text>
                        <View
                          className={`flex-row items-center gap-1 px-3 py-1 rounded-full mt-2 ${statusStyle.badge}`}
                        >
                          {tx.status === "confirmed" && (
                            <MaterialIcons
                              name="check-circle"
                              size={12}
                              color="#fff"
                            />
                          )}
                          <Text
                            className={`text-xs font-semibold ${statusStyle.text}`}
                          >
                            {statusStyle.label}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}

                {/* Pagination */}
                {transactions.length > ITEMS_PER_PAGE && (
                  <View className="flex-row items-center justify-center gap-6 pt-5 mt-2">
                    <TouchableOpacity
                      onPress={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page === 1}
                      className="flex-row items-center gap-1"
                    >
                      <MaterialIcons
                        name="chevron-left"
                        size={18}
                        color={page === 1 ? "#4B5563" : "#9CA3AF"}
                      />
                      <Text
                        className={`text-sm ${
                          page === 1 ? "text-gray-600" : "text-gray-400"
                        }`}
                      >
                        Previous
                      </Text>
                    </TouchableOpacity>

                    <View className="px-4 py-1.5 bg-gray-800 rounded">
                      <Text className="text-white text-sm font-medium">
                        {page}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() =>
                        setPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      disabled={page >= totalPages}
                      className="flex-row items-center gap-1"
                    >
                      <Text
                        className={`text-sm ${
                          page >= totalPages ? "text-gray-600" : "text-gray-400"
                        }`}
                      >
                        Next
                      </Text>
                      <MaterialIcons
                        name="chevron-right"
                        size={18}
                        color={page >= totalPages ? "#4B5563" : "#9CA3AF"}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
};
