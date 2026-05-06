import { useState, useCallback, useEffect, useRef } from "react";

export function useCustomerSearch(debounceMs: number = 300) {
  const [searchText, setSearchText] = useState("");
  const [debouncedText, setDebouncedText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedText(searchText);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchText, debounceMs]);

  const hasSearchQuery = debouncedText.trim().length > 0;

  const clearSearch = useCallback(() => {
    setSearchText("");
    setDebouncedText("");
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return {
    searchText,
    setSearchText,
    debouncedSearchText: debouncedText,
    hasSearchQuery,
    clearSearch,
  };
}
