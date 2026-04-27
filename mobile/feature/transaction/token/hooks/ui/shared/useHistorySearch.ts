import { useState, useCallback } from "react";

export function useHistorySearch() {
  const [searchQuery, setSearchQuery] = useState("");

  const hasSearchQuery = searchQuery.trim().length > 0;

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    hasSearchQuery,
    clearSearch,
  };
}
