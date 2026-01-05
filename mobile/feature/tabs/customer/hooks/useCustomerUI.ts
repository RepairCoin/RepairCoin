import { useState, useCallback } from "react";

export function useCustomerUI() {
  const [searchText, setSearchText] = useState("");

  // Check if search is active
  const hasSearchQuery = searchText.trim().length > 0;

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchText("");
  }, []);

  return {
    // Search
    searchText,
    setSearchText,
    hasSearchQuery,
    clearSearch,
  };
}
