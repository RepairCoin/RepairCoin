import { useState, useCallback } from "react";

export function useCustomerSearch() {
  const [searchText, setSearchText] = useState("");

  const hasSearchQuery = searchText.trim().length > 0;

  const clearSearch = useCallback(() => {
    setSearchText("");
  }, []);

  return {
    searchText,
    setSearchText,
    hasSearchQuery,
    clearSearch,
  };
}
