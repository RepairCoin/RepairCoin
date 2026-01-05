import { useState, useCallback } from "react";
import { StatusFilter, DateFilter } from "../types";

export const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

export const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];

export function useHistoryUI() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  // Check if any filter is active
  const hasActiveFilters = statusFilter !== "all" || dateFilter !== "all";

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setDateFilter("all");
  }, []);

  return {
    // Search
    searchQuery,
    setSearchQuery,
    // Filters
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    hasActiveFilters,
    clearFilters,
  };
}
